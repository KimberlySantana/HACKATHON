import assert from "node:assert/strict";
import test from "node:test";
import { deleteCloudExpense, loadCloudExpenses, mapCloudExpenseRows, saveCloudExpense, toCloudExpensePayload } from "./cloud.ts";

const expense = {
  id: "expense-1", groupId: "group-1", description: "Dinner", paidByMemberId: "member-a",
  taxCents: 3, tipCents: 2, createdAt: "2026-11-14T12:00:00.000Z",
  items: [{ id: "item-1", name: "Toast", quantity: 1, unitPriceCents: 101, assignedMemberIds: ["member-a", "member-b"] }],
};

test("cloud payload stores integer cents and deterministic item split rows", () => {
  const payload = toCloudExpensePayload(expense, ["member-a", "member-b"]);
  assert.equal(payload.tax_cents, 3);
  assert.equal(payload.items[0].unit_price_cents, 101);
  assert.deepEqual(payload.items[0].splits, [
    { member_id: "member-a", amount_cents: 51 },
    { member_id: "member-b", amount_cents: 50 },
  ]);
});

test("cloud rows round-trip into settlement-compatible expense records", () => {
  const loaded = mapCloudExpenseRows(
    [{ id: "expense-1", group_id: "group-1", description: "Dinner", paid_by_member_id: "member-a", tax_cents: "3", tip_cents: "2", created_at: expense.createdAt }],
    [{ id: "item-1", expense_id: "expense-1", group_id: "group-1", name: "Toast", note: "Gluten-free", quantity: 1, unit_price_cents: "101", sort_order: 0 }],
    [{ expense_item_id: "item-1", group_id: "group-1", member_id: "member-b", amount_cents: "50" }, { expense_item_id: "item-1", group_id: "group-1", member_id: "member-a", amount_cents: "51" }],
    ["member-a", "member-b"],
  );
  assert.equal(loaded[0].taxCents, 3);
  assert.deepEqual(loaded[0].items[0].assignedMemberIds, ["member-a", "member-b"]);
  assert.deepEqual(loaded[0].items[0].memberSharesCents, { "member-a": 51, "member-b": 50 });
  assert.equal(loaded[0].items[0].note, "Gluten-free");
});

test("cloud payload saves and clears optional item notes without changing split amounts", () => {
  const noted = { ...expense, items: [{ ...expense.items[0], note: "No onions" }] };
  const payloadWithNote = toCloudExpensePayload(noted, ["member-a", "member-b"]);
  assert.equal(payloadWithNote.items[0].note, "No onions");
  assert.deepEqual(payloadWithNote.items[0].splits, [
    { member_id: "member-a", amount_cents: 51 },
    { member_id: "member-b", amount_cents: 50 },
  ]);
  const payloadAfterClear = toCloudExpensePayload({ ...expense, items: [{ ...expense.items[0], note: undefined }] }, ["member-a", "member-b"]);
  assert.equal(payloadAfterClear.items[0].note, null);
});

test("cloud loading selects and restores the item note column", async () => {
  const selections = [];
  const dataByTable = {
    expenses: [{ id: "expense-1", group_id: "group-1", description: "Dinner", paid_by_member_id: "member-a", tax_cents: 3, tip_cents: 2, created_at: expense.createdAt }],
    expense_items: [{ id: "item-1", expense_id: "expense-1", group_id: "group-1", name: "Toast", note: "Cut in half", quantity: 1, unit_price_cents: 101, sort_order: 0 }],
    item_splits: [{ expense_item_id: "item-1", group_id: "group-1", member_id: "member-a", amount_cents: 51 }, { expense_item_id: "item-1", group_id: "group-1", member_id: "member-b", amount_cents: 50 }],
  };
  const client = { from(table) {
    const query = {
      select(columns) { selections.push([table, columns]); return query; },
      eq() { return query; },
      in() { return query; },
      order() { return Promise.resolve({ data: dataByTable[table], error: null }); },
      then(resolve, reject) { return Promise.resolve({ data: dataByTable[table], error: null }).then(resolve, reject); },
    };
    return query;
  } };
  const loaded = await loadCloudExpenses(client, "group-1", ["member-a", "member-b"]);
  assert.ok(selections.some(([table, columns]) => table === "expense_items" && columns.includes("note")));
  assert.equal(loaded[0].items[0].note, "Cut in half");
});

test("create-only imports use the atomic RPC and cannot opt into updates", async () => {
  let call;
  const client = { rpc: async (...args) => { call = args; return { data: "expense-1", error: null }; } };
  await saveCloudExpense(client, expense, ["member-a", "member-b"], false);
  assert.equal(call[0], "save_expense");
  assert.equal(call[1].p_allow_update, false);
  assert.equal(call[1].p_expense.id, expense.id);
});

test("editing uses the atomic save RPC to update the same expense ID", async () => {
  const calls = [];
  const client = {
    rpc: async (...args) => { calls.push(args); return { data: expense.id, error: null }; },
    from: () => { throw new Error("An edit must not delete the old expense before saving."); },
  };
  const updated = { ...expense, description: "Updated dinner", items: [{ ...expense.items[0], name: "Updated toast", note: "No salt" }] };
  const result = await saveCloudExpense(client, updated, ["member-a", "member-b"]);
  assert.equal(result, expense.id);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "save_expense");
  assert.equal(calls[0][1].p_allow_update, true);
  assert.equal(calls[0][1].p_expense.id, expense.id);
  assert.equal(calls[0][1].p_expense.description, "Updated dinner");
  assert.equal(calls[0][1].p_expense.items[0].name, "Updated toast");
  assert.equal(calls[0][1].p_expense.items[0].note, "No salt");
  await saveCloudExpense(client, { ...updated, items: [{ ...updated.items[0], note: undefined }] }, ["member-a", "member-b"]);
  assert.equal(calls[1][1].p_expense.items[0].note, null);
});

test("cloud deletion targets one group-owned expense row", async () => {
  const clauses = [];
  const query = {
    eq: (column, value) => { clauses.push([column, value]); return query; },
    select: async (columns) => ({ data: [{ id: "expense-1" }], error: null, columns }),
  };
  const client = { from: (table) => ({ delete: () => { clauses.push(["table", table]); return query; } }) };
  await deleteCloudExpense(client, "expense-1", "group-1");
  assert.deepEqual(clauses, [["table", "expenses"], ["id", "expense-1"], ["group_id", "group-1"]]);
});
