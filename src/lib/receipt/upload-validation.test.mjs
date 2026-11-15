import assert from "node:assert/strict";
import test from "node:test";
import { MAX_SCAN_FILE_BYTES, MAX_SCAN_REQUEST_BYTES, MAX_SCAN_TOTAL_FILE_BYTES, validateScanContentLength, validateScanImage, validateScanTotalSize } from "./upload-validation.ts";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = new TextEncoder().encode("RIFFxxxxWEBP");

test("scanner request size respects the Vercel payload ceiling with headroom", () => {
  assert.equal(validateScanContentLength(String(MAX_SCAN_REQUEST_BYTES)), null);
  assert.match(validateScanContentLength(String(MAX_SCAN_REQUEST_BYTES + 1)), /under 4 MB/);
  assert.equal(validateScanContentLength(null), null);
  assert.match(validateScanContentLength("not-a-size"), /invalid size header/);
});

test("each supported image type must match its file signature and size cap", () => {
  assert.equal(validateScanImage("image/jpeg", jpeg.length, jpeg, "Receipt"), null);
  assert.equal(validateScanImage("image/png", png.length, png, "Receipt"), null);
  assert.equal(validateScanImage("image/webp", webp.length, webp, "Receipt"), null);
  assert.match(validateScanImage("image/png", jpeg.length, jpeg, "Receipt") ?? "", /did not match/);
  assert.match(validateScanImage("image/gif", 20, jpeg, "Receipt") ?? "", /JPEG, PNG, or WEBP/);
  assert.match(validateScanImage("image/jpeg", MAX_SCAN_FILE_BYTES + 1, jpeg, "Receipt") ?? "", /1.7 MB/);
});

test("multiple images stay below the combined body budget", () => {
  assert.equal(validateScanTotalSize(MAX_SCAN_TOTAL_FILE_BYTES), null);
  assert.match(validateScanTotalSize(MAX_SCAN_TOTAL_FILE_BYTES + 1) ?? "", /3.5 MB/);
});
