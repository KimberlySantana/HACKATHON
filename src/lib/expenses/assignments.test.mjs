import test from "node:test";
import assert from "node:assert/strict";
import { assignEveryone, getUnassignedItems, toggleAssignedMember } from "./assignments.ts";

test("finds items with no valid current group member assignment", () => {
  const items = [
    { id: "assigned", assignedMemberIds: ["member-1"] },
    { id: "empty", assignedMemberIds: [] },
    { id: "stale", assignedMemberIds: ["removed-member"] },
  ];

  assert.deepEqual(getUnassignedItems(items, ["member-1", "member-2"]).map(({ id }) => id), ["empty", "stale"]);
});

test("does not assign members or mutate the item list", () => {
  const items = [{ id: "unassigned", assignedMemberIds: [] }];
  const before = structuredClone(items);

  getUnassignedItems(items, ["member-1"]);

  assert.deepEqual(items, before);
});

test("one-tap selection toggles one member and everyone selects the current group", () => {
  assert.deepEqual(toggleAssignedMember(["a"], "b"), ["a", "b"]);
  assert.deepEqual(toggleAssignedMember(["a", "b"], "a"), ["b"]);
  assert.deepEqual(assignEveryone(["a", "b", "a"]), ["a", "b"]);
});
