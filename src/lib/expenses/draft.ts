export function expenseReturnHref(groupId: string, editing: boolean): string {
  const groupPath = `/groups/${encodeURIComponent(groupId)}`;
  return editing ? `${groupPath}/settlement` : groupPath;
}

export function removeDraftItem<T extends { id: string }>(items: T[], itemId: string): T[] {
  return items.filter((item) => item.id !== itemId);
}
