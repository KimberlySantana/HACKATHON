import assert from "node:assert/strict";
import test from "node:test";
import { hasExplicitPayer } from "./validation.ts";

test("requires an explicitly selected payer from this group", () => {
  assert.equal(hasExplicitPayer("", ["amy", "bella"]), false);
  assert.equal(hasExplicitPayer("other", ["amy", "bella"]), false);
  assert.equal(hasExplicitPayer("bella", ["amy", "bella"]), true);
});
