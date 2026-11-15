import assert from "node:assert/strict";
import test from "node:test";
import { canLeaveWithUnsavedChanges } from "./navigation.ts";

test("leaving a clean form does not prompt", () => {
  let prompted = false;
  assert.equal(canLeaveWithUnsavedChanges(false, () => { prompted = true; return false; }), true);
  assert.equal(prompted, false);
});

test("dirty forms can be kept or discarded based on the confirmation", () => {
  assert.equal(canLeaveWithUnsavedChanges(true, () => false), false);
  assert.equal(canLeaveWithUnsavedChanges(true, () => true), true);
});
