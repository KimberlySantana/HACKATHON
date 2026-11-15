/** Require the payer to be deliberately selected from the current group. */
export function hasExplicitPayer(payerId: string, groupMemberIds: string[]): boolean {
  return payerId.length > 0 && groupMemberIds.includes(payerId);
}
