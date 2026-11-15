import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../../app/api/receipt/scan/route.ts", import.meta.url), "utf8");
const client = await readFile(new URL("../../app/scan/scan-workspace.tsx", import.meta.url), "utf8");
const serverClient = await readFile(new URL("../supabase/server.ts", import.meta.url), "utf8");
const authProvider = await readFile(new URL("../../components/groups/auth-provider.tsx", import.meta.url), "utf8");
const { getScanErrorTranslationKey } = await import("./scan-errors.ts");

test("scanner authenticates and reserves durable quota before calling OpenAI", () => {
  assert.ok(route.indexOf("supabase.auth.getUser(accessToken)") < route.indexOf("request.formData()"));
  assert.match(route, /if \(!accessToken\) return scannerError\("AUTH_REQUIRED"/);
  assert.match(route, /scannerError\("AUTH_INVALID"/);
  assert.match(route, /scannerError\("AUTH_UNAVAILABLE"/);
  assert.ok(route.indexOf('supabase.rpc("reserve_receipt_scan")') < route.indexOf("client.responses.create"));
  assert.ok(route.indexOf('status: 401') < route.indexOf("client.responses.create"));
  assert.doesNotMatch(client, /OPENAI_API_KEY|service_role|secret key/i);
  assert.match(route, /process\.env\.OPENAI_API_KEY/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(client, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(serverClient, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(client, /formData\.append\("groupId", groupId\)/);
  assert.match(route, /\.eq\("owner_id", userId\)/);
  assert.ok(route.indexOf('supabase.from("groups")') < route.indexOf('supabase.rpc("reserve_receipt_scan")'));
  assert.match(authProvider, /supabase\.auth\.getUser\(data\.session\.access_token\)/);
  assert.match(authProvider, /supabase\.auth\.refreshSession\(\)/);
});

test("scanner enforces request byte limits before multipart parsing", () => {
  assert.ok(route.indexOf("validateScanContentLength") < route.indexOf("request.formData()"));
  assert.match(route, /validateScanImage/);
  assert.match(route, /validateScanTotalSize/);
});

test("auth, quota, provider configuration, and network failures have distinct messages", () => {
  assert.equal(getScanErrorTranslationKey("AUTH_REQUIRED"), "error.notAuthenticated");
  assert.equal(getScanErrorTranslationKey("AUTH_INVALID"), "error.authInvalid");
  assert.equal(getScanErrorTranslationKey("AUTH_UNAVAILABLE"), "error.authUnavailable");
  assert.equal(getScanErrorTranslationKey("GROUP_FORBIDDEN"), "error.groupForbidden");
  assert.equal(getScanErrorTranslationKey("GROUP_CHECK_FAILED"), "error.groupCheckFailed");
  assert.equal(getScanErrorTranslationKey("QUOTA_NOT_CONFIGURED"), "error.quotaUnavailable");
  assert.equal(getScanErrorTranslationKey("QUOTA_CHECK_FAILED"), "error.quotaCheckFailed");
  assert.equal(getScanErrorTranslationKey("QUOTA_EXCEEDED"), "error.quotaExceeded");
  assert.equal(getScanErrorTranslationKey("OPENAI_NOT_CONFIGURED"), "error.keyUnavailable");
  assert.equal(getScanErrorTranslationKey("SCAN_FAILED"), "error.tryAgain");
  assert.equal(getScanErrorTranslationKey("UNEXPECTED"), undefined);
});

test("camera and file upload choices use the shared explicit scan pipeline", () => {
  assert.match(client, /accept="image\/\*" capture="environment"/);
  assert.match(client, /accept="image\/\*" onChange=/);
  assert.match(client, /onClick=\{\(\) => void scanReceipts\(selectedFiles\)\}/);
  assert.doesNotMatch(client, /void scanReceipts\(nextFiles\)/);
});
