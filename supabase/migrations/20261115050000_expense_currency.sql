-- Add currency after the note RPC migration so the replacement keeps note persistence.
alter table public.expenses
  add column if not exists currency text not null default 'USD' check (currency in ('USD', 'EUR', 'CNY', 'KRW'));

-- Keep the already deployed note column reproducible and idempotent.
alter table public.expense_items
  add column if not exists note text;

-- Recreate the existing atomic save function with note persistence. The
-- SECURITY INVOKER mode and authenticated-only grant preserve the caller's RLS.
create or replace function public.save_expense(p_expense jsonb, p_allow_update boolean default true)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_expense_id uuid;
  v_group_id uuid;
  v_payer_id uuid;
  v_description text;
  v_currency text;
  v_tax_cents bigint;
  v_tip_cents bigint;
  v_created_at timestamptz;
  v_item jsonb;
  v_split jsonb;
  v_item_id uuid;
  v_item_name text;
  v_item_note text;
  v_quantity integer;
  v_unit_price_cents bigint;
  v_sort_order integer := 0;
  v_split_total numeric;
  v_item_total numeric;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign-in is required to save an expense.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_expense) is distinct from 'object'
    or jsonb_typeof(p_expense -> 'items') is distinct from 'array'
    or jsonb_array_length(coalesce(p_expense -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'Expense payload must include at least one item.' using errcode = '22023';
  end if;

  v_expense_id := (p_expense ->> 'id')::uuid;
  v_group_id := (p_expense ->> 'group_id')::uuid;
  v_payer_id := (p_expense ->> 'paid_by_member_id')::uuid;
  v_description := btrim(p_expense ->> 'description');
  v_currency := upper(coalesce(nullif(btrim(p_expense ->> 'currency'), ''), 'USD'));
  v_tax_cents := coalesce((p_expense ->> 'tax_cents')::bigint, 0);
  v_tip_cents := coalesce((p_expense ->> 'tip_cents')::bigint, 0);
  v_created_at := coalesce((p_expense ->> 'created_at')::timestamptz, now());

  if v_description is null or char_length(v_description) not between 1 and 80
    or v_currency not in ('USD', 'EUR', 'CNY', 'KRW')
    or v_tax_cents < 0 or v_tip_cents < 0 then
    raise exception 'Expense description, currency, tax, or tip is invalid.' using errcode = '22023';
  end if;

  if coalesce(p_allow_update, false) then
    insert into public.expenses (id, group_id, paid_by_member_id, description, currency, tax_cents, tip_cents, created_at)
    values (v_expense_id, v_group_id, v_payer_id, v_description, v_currency, v_tax_cents, v_tip_cents, v_created_at)
    on conflict (id) do update set
      group_id = excluded.group_id,
      paid_by_member_id = excluded.paid_by_member_id,
      description = excluded.description,
      currency = excluded.currency,
      tax_cents = excluded.tax_cents,
      tip_cents = excluded.tip_cents;
  else
    -- Import mode remains create-only and cannot overwrite an existing cloud row.
    insert into public.expenses (id, group_id, paid_by_member_id, description, currency, tax_cents, tip_cents, created_at)
    values (v_expense_id, v_group_id, v_payer_id, v_description, v_currency, v_tax_cents, v_tip_cents, v_created_at);
  end if;

  delete from public.expense_items
  where expense_id = v_expense_id and group_id = v_group_id;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_expense -> 'items') as entries(value)
  loop
    v_item_id := (v_item ->> 'id')::uuid;
    v_item_name := btrim(v_item ->> 'name');
    v_item_note := nullif(btrim(v_item ->> 'note'), '');
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price_cents := (v_item ->> 'unit_price_cents')::bigint;
    v_split_total := 0;
    v_item_total := v_quantity::numeric * v_unit_price_cents::numeric;

    if v_item -> 'note' is not null
      and jsonb_typeof(v_item -> 'note') not in ('string', 'null') then
      raise exception 'Expense item note must be text.' using errcode = '22023';
    end if;
    if v_item_name is null or char_length(v_item_name) not between 1 and 80
      or v_item_note is not null and char_length(v_item_note) > 500
      or v_quantity not between 1 and 999 or v_unit_price_cents < 0
      or jsonb_typeof(v_item -> 'splits') is distinct from 'array'
      or jsonb_array_length(v_item -> 'splits') = 0 then
      raise exception 'Expense item, note, or item splits are invalid.' using errcode = '22023';
    end if;

    insert into public.expense_items (id, expense_id, group_id, name, note, quantity, unit_price_cents, sort_order)
    values (v_item_id, v_expense_id, v_group_id, v_item_name, v_item_note, v_quantity, v_unit_price_cents,
      coalesce((v_item ->> 'sort_order')::integer, v_sort_order));

    for v_split in select value from pg_catalog.jsonb_array_elements(v_item -> 'splits') as entries(value)
    loop
      v_split_total := v_split_total + (v_split ->> 'amount_cents')::bigint;
      insert into public.item_splits (expense_item_id, group_id, member_id, amount_cents)
      values (v_item_id, v_group_id, (v_split ->> 'member_id')::uuid, (v_split ->> 'amount_cents')::bigint);
    end loop;

    if v_split_total <> v_item_total then
      raise exception 'Item split amounts must equal the item total.' using errcode = '22023';
    end if;
    v_sort_order := v_sort_order + 1;
  end loop;

  return v_expense_id;
end;
$function$;

revoke all on function public.save_expense(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.save_expense(jsonb, boolean) to authenticated;
