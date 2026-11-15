import test from "node:test";
import assert from "node:assert/strict";
import { getAuthStatusMessage } from "./auth-status.ts";

test("classifies an absent session as signed out, not an outage", () => {
  assert.match(getAuthStatusMessage({ name: "AuthSessionMissingError" }), /No active sign-in session/);
});

test("distinguishes expired credentials, network failures, rate limits, and Auth outages", () => {
  assert.match(getAuthStatusMessage({ status: 401 }), /expired or invalid/);
  assert.match(getAuthStatusMessage(new TypeError("fetch failed")), /Couldn’t reach Supabase Auth/);
  assert.match(getAuthStatusMessage({ status: 429 }), /rate-limiting/);
  assert.match(getAuthStatusMessage({ status: 503 }), /temporarily unavailable/);
});
