import assert from "node:assert/strict";
import test from "node:test";
import { appendMemberToGroup, cancelGroupForm, getUserDisplayName, groupDetailsHref, groupExpenseHref, groupSaveError, groupScannerHref, validateGroupDraft } from "./form.ts";

const group = {
  group: { id: "g1", name: "Cabin weekend", memberIds: ["m1"], createdAt: "2026-11-14T00:00:00.000Z" },
  members: [{ id: "m1", name: "Maya" }],
};

test("group names are required while members are optional", () => {
  assert.match(validateGroupDraft("   ", []), /name/i);
  assert.equal(validateGroupDraft("Cabin weekend", []), null);
});

test("group creation rejects blank and duplicate member names", () => {
  assert.match(validateGroupDraft("Trip", [{ id: "1", name: " " }]), /blank row/i);
  assert.match(validateGroupDraft("Trip", [{ id: "1", name: "Maya" }, { id: "2", name: " maya " }]), /different name/i);
  assert.equal(validateGroupDraft("Trip", [{ id: "1", name: "Maya" }, { id: "2", name: "Jules" }]), null);
});

test("uses a known display name and does not invent one", () => {
  assert.equal(getUserDisplayName({ user_metadata: { full_name: "  Taylor Reed " } }), "Taylor Reed");
  assert.equal(getUserDisplayName({ user_metadata: {} }), "");
  assert.equal(getUserDisplayName(null), "");
});

test("adding a member preserves existing group data and does not touch expense records", () => {
  const expenses = [{ id: "e1", items: [{ assignedMemberIds: ["m1"] }] }];
  const beforeExpenses = structuredClone(expenses);
  const updated = appendMemberToGroup(group, "Jules", "m2");
  assert.notEqual(typeof updated, "string");
  assert.deepEqual(updated.group.memberIds, ["m1", "m2"]);
  assert.deepEqual(updated.members.map((member) => member.name), ["Maya", "Jules"]);
  assert.deepEqual(expenses, beforeExpenses);
  assert.equal(appendMemberToGroup(group, " maya ", "m3"), "That person is already in this group.");
});

test("cancel resets the draft and closes creation without navigating or saving", () => {
  let reset = false;
  let closed = false;
  let navigated = "";
  cancelGroupForm({ reset: () => { reset = true; }, onCancel: () => { closed = true; }, navigate: (path) => { navigated = path; } });
  assert.equal(reset, true);
  assert.equal(closed, true);
  assert.equal(navigated, "");
});

test("successful creation navigates to the new group details page", () => {
  assert.equal(groupDetailsHref("group / one", true), "/groups/group%20%2F%20one?created=1");
});

test("expense actions keep the current group context", () => {
  assert.equal(groupExpenseHref("group / one"), "/groups/group%20%2F%20one/expenses/new");
  assert.equal(groupScannerHref("group / one"), "/scan?groupId=group%20%2F%20one");
});

test("cloud failures remain visible instead of being presented as local success", () => {
  const error = groupSaveError(new TypeError("Failed to fetch"));
  assert.match(error, /couldn’t reach Supabase/i);
  assert.match(error, /No new browser copy was created/);
  assert.match(groupSaveError({ code: "42501" }), /signed in to the account that owns this group/i);
});
