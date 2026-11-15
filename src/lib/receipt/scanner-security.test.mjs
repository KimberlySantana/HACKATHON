import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../../app/api/receipt/scan/route.ts", import.meta.url), "utf8");
const client = await readFile(new URL("../../app/scan/scan-workspace.tsx", import.meta.url), "utf8");

test("scanner authenticates and reserves durable quota before calling OpenAI", () => {
  assert.ok(route.indexOf("supabase.auth.getUser()") < route.indexOf("request.formData()"));
  assert.ok(route.indexOf('supabase.rpc("reserve_receipt_scan")') < route.indexOf("client.responses.create"));
  assert.ok(route.indexOf('status: 401') < route.indexOf("client.responses.create"));
  assert.doesNotMatch(client, /OPENAI_API_KEY|service_role|secret key/i);
  assert.match(route, /process\.env\.OPENAI_API_KEY/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY/);
});

test("scanner enforces request byte limits before multipart parsing", () => {
  assert.ok(route.indexOf("validateScanContentLength") < route.indexOf("request.formData()"));
  assert.match(route, /validateScanImage/);
  assert.match(route, /validateScanTotalSize/);
});
