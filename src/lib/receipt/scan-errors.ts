export const scanErrorTranslationKeys = {
  AUTH_REQUIRED: "error.notAuthenticated",
  AUTH_INVALID: "error.authInvalid",
  AUTH_UNAVAILABLE: "error.authUnavailable",
  GROUP_FORBIDDEN: "error.groupForbidden",
  GROUP_CHECK_FAILED: "error.groupCheckFailed",
  OPENAI_NOT_CONFIGURED: "error.keyUnavailable",
  QUOTA_NOT_CONFIGURED: "error.quotaUnavailable",
  QUOTA_CHECK_FAILED: "error.quotaCheckFailed",
  QUOTA_EXCEEDED: "error.quotaExceeded",
  SCAN_FAILED: "error.tryAgain",
} as const;

export type ScanErrorCode = keyof typeof scanErrorTranslationKeys;
export type ScanErrorTranslationKey = (typeof scanErrorTranslationKeys)[ScanErrorCode];

export function getScanErrorTranslationKey(code: string | undefined): ScanErrorTranslationKey | undefined {
  if (!code || !Object.hasOwn(scanErrorTranslationKeys, code)) return undefined;
  return scanErrorTranslationKeys[code as ScanErrorCode];
}
