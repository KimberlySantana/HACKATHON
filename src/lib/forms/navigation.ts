/** Return false when a user declines to discard an in-progress form. */
export function canLeaveWithUnsavedChanges(hasUnsavedChanges: boolean, confirmDiscard: () => boolean): boolean {
  return !hasUnsavedChanges || confirmDiscard();
}
