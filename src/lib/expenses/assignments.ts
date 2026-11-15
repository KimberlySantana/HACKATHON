type AssignableItem = {
  id: string;
  assignedMemberIds: string[];
};

/** Toggle one member without changing the item's other assignments. */
export function toggleAssignedMember(memberIds: string[], memberId: string): string[] {
  return memberIds.includes(memberId)
    ? memberIds.filter((id) => id !== memberId)
    : [...memberIds, memberId];
}

/** Select every current group member for an item, preserving member order. */
export function assignEveryone(memberIds: string[]): string[] {
  return [...new Set(memberIds)];
}

/** Returns items with no assignment to a current group member. */
export function getUnassignedItems<T extends AssignableItem>(items: T[], memberIds: string[]): T[] {
  const validMemberIds = new Set(memberIds);
  return items.filter((item) => !item.assignedMemberIds.some((memberId) => validMemberIds.has(memberId)));
}
