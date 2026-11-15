import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../../../supabase/migrations/20261115032804_receipt_scan_usage_limits.sql", import.meta.url), "utf8");

test("scanner quota migration is owner-authenticated, bounded, and not service-role based", () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /SELECT auth\.uid\(\)/i);
  assert.match(migration, /global_count >= 100/i);
  assert.match(migration, /user_count >= 5/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.reserve_receipt_scan\(\) FROM PUBLIC, anon/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.reserve_receipt_scan\(\) TO authenticated/i);
  assert.match(migration, /SECURITY DEFINER/i);
  assert.match(migration, /SET search_path = ''/i);
});
