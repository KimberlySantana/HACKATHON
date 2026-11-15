-- Delete a group and its dependent records in a single owner-authorized transaction.
-- This function is additive; applying the migration itself does not delete any data.
create or replace function public.delete_group(p_group_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign-in is required to delete a group.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.groups
    where id = p_group_id and owner_id = (select auth.uid())
  ) then
    return false;
  end if;

  -- Remove expenses first because their payer/item split references restrict
  -- individual member deletion. The RPC runs as one transaction under RLS.
  delete from public.expenses where group_id = p_group_id;
  delete from public.group_members where group_id = p_group_id;
  delete from public.groups where id = p_group_id and owner_id = (select auth.uid());

  return found;
end;
$function$;

revoke all on function public.delete_group(uuid) from public, anon, authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
