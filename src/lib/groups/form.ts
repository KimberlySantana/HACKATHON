import type { Member, Group } from "@/types";
import type { SavedGroup } from "./storage";

export function normalizeMemberName(name: string) {
  return name.trim().normalize("NFKC").toLocaleLowerCase();
}

export function validateGroupDraft(groupName: string, members: Member[]) {
  if (!groupName.trim()) return "Add a name so everyone can find this group.";
  if (members.some((member) => !member.name.trim())) return "Give each person a name, or remove the blank row.";
  const normalizedNames = members.map((member) => normalizeMemberName(member.name));
  if (new Set(normalizedNames).size !== normalizedNames.length) return "Each person needs a different name. Check for duplicates.";
  return null;
}

export function getUserDisplayName(user: { user_metadata?: unknown } | null) {
  if (!user || typeof user.user_metadata !== "object" || user.user_metadata === null) return "";
  const metadata = user.user_metadata as Record<string, unknown>;
  for (const key of ["full_name", "name", "display_name"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function appendMemberToGroup(group: SavedGroup, name: string, id: string): SavedGroup | string {
  const trimmedName = name.trim();
  if (!trimmedName) return "Enter a person's name.";
  if (group.members.some((member) => normalizeMemberName(member.name) === normalizeMemberName(trimmedName))) {
    return "That person is already in this group.";
  }
  const member: Member = { id, name: trimmedName };
  const updatedGroup: Group = { ...group.group, memberIds: [...group.group.memberIds, id] };
  return { group: updatedGroup, members: [...group.members, member] };
}

export function groupDetailsHref(groupId: string, created = false) {
  const path = `/groups/${encodeURIComponent(groupId)}`;
  return created ? `${path}?created=1` : path;
}

export function groupExpenseHref(groupId: string) {
  return `${groupDetailsHref(groupId)}/expenses/new`;
}

export function groupScannerHref(groupId: string) {
  return `/scan?groupId=${encodeURIComponent(groupId)}`;
}

export function cancelGroupForm(options: {
  reset: () => void;
  onCancel?: () => void;
  groupId?: string;
  navigate: (path: string) => void;
}) {
  options.reset();
  if (options.onCancel) options.onCancel();
  else if (options.groupId) options.navigate(groupDetailsHref(options.groupId));
  else options.navigate("/groups");
}

export function groupSaveError(cause: unknown) {
  const code = typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : "";
  if (code === "23503") return "Can’t remove this person yet. A saved expense still refers to them. Reassign or delete that expense first, then review the group again.";
  if (code === "42501") return "Supabase denied this group change. Confirm you’re signed in to the account that owns this group, then try again.";
  if (cause instanceof TypeError || (cause instanceof Error && /fetch|network|offline/i.test(cause.message))) {
    return "Splitzy couldn’t reach Supabase to finish the save. No new browser copy was created; earlier cloud writes may have completed. Refresh the group before retrying.";
  }
  return "Supabase could not finish this group change. No new browser copy was created; refresh to check whether earlier cloud writes completed.";
}
