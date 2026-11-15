export const MAX_SCAN_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_SCAN_FILE_BYTES = 1_750_000;
export const MAX_SCAN_TOTAL_FILE_BYTES = 3_500_000;

export type ScanImageMime = "image/jpeg" | "image/png" | "image/webp";

export function validateScanContentLength(value: string | null) {
  if (value === null) return null;
  if (!/^\d+$/.test(value)) return "The receipt upload request has an invalid size header.";
  if (Number(value) > MAX_SCAN_REQUEST_BYTES) return "The receipt upload request must be under 4 MB.";
  return null;
}

export function validateScanTotalSize(totalBytes: number) {
  return Number.isSafeInteger(totalBytes) && totalBytes >= 0 && totalBytes <= MAX_SCAN_TOTAL_FILE_BYTES
    ? null
    : "Receipt images must fit within a 3.5 MB combined upload limit.";
}

export function validateScanImage(type: string, size: number, bytes: Uint8Array, label: string) {
  const supported = new Set<ScanImageMime>(["image/jpeg", "image/png", "image/webp"]);
  if (!supported.has(type as ScanImageMime)) return `${label} must be a JPEG, PNG, or WEBP image.`;
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_SCAN_FILE_BYTES) return `${label} must be between 1 byte and 1.7 MB.`;

  const isJpeg = type === "image/jpeg" && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = type === "image/png" && bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  const isWebp = type === "image/webp" && bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  if (!isJpeg && !isPng && !isWebp) return `${label} content did not match its declared image type.`;
  return null;
}
