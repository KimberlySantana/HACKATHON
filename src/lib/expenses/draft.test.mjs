import assert from "node:assert/strict";
import test from "node:test";
import { expenseReturnHref, removeDraftItem } from "./draft.ts";

test("expense editor returns to the group when creating and settlement when editing", () => {
  assert.equal(expenseReturnHref("group / one", false), "/groups/group%20%2F%20one");
  assert.equal(expenseReturnHref("group / one", true), "/groups/group%20%2F%20one/settlement");
});

test("removing the final draft item is allowed and does not mutate the old list", () => {
  const items = [{ id: "one", name: "Tea" }];
  const remaining = removeDraftItem(items, "one");
  assert.deepEqual(remaining, []);
  assert.deepEqual(items, [{ id: "one", name: "Tea" }]);
  assert.deepEqual([...remaining, { id: "two", name: "Coffee" }], [{ id: "two", name: "Coffee" }]);
});
