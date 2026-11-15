"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CircleAlert, Plus, Trash2, UsersRound } from "lucide-react";
import { useSavedGroups } from "@/components/groups/use-saved-groups";
import { appendMemberToGroup } from "@/lib/groups/form";
import { Button } from "@/components/ui/button";
import { FormErrorToast } from "@/components/ui/form-error-toast";

export function GroupMembersPanel({ groupId }: { groupId: string }) {
  const { groups, loading, storageError, saveGroups } = useSavedGroups();
  const [addOpen, setAddOpen] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [invalidInput, setInvalidInput] = useState(false);
  const saved = groups.find((entry) => entry.group.id === groupId);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saved) return;
    setError(null);
    setSuccess(null);
    const updated = appendMemberToGroup(saved, memberName, crypto.randomUUID());
    if (typeof updated === "string") { setError(updated); setInvalidInput(true); inputRef.current?.focus(); return; }
    setSaving(true);
    try {
      const nextGroups = groups.map((entry) => entry.group.id === groupId ? updated : entry);
      const saveError = await saveGroups(nextGroups);
      if (saveError) { setError(saveError); return; }
      setMemberName("");
      setAddOpen(false);
      setSuccess(`${updated.members[updated.members.length - 1]?.name} is now in the group and can be included in future expenses.`);
    } finally { setSaving(false); }
  }

  async function removeMember(memberId: string, memberName: string) {
    if (!saved) return;
    setError(null);
    setSuccess(null);
    const nextMembers = saved.members.filter((member) => member.id !== memberId);
    const next = { ...saved, members: nextMembers, group: { ...saved.group, memberIds: nextMembers.map((member) => member.id) } };
    setSaving(true);
    try {
      const saveError = await saveGroups(groups.map((entry) => entry.group.id === groupId ? next : entry));
      if (saveError) { setError(saveError); return; }
      setSuccess(`${memberName} was removed from the group.`);
    } finally { setSaving(false); }
  }

  if (loading) return <section aria-label="Group members" role="status" className="animate-pulse rounded-2xl border border-border bg-white p-5"><span className="block h-5 w-36 rounded bg-surface-muted"/><span className="mt-4 block h-10 rounded bg-surface-muted"/></section>;
  if (!saved) return <section role={storageError ? "alert" : "status"} className="rounded-2xl border border-border bg-white p-5 text-sm text-muted">{storageError ?? "This group is not available in this browser or account."}</section>;

  return <section aria-labelledby="group-members-title" className="rounded-2xl border border-border bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf1ec] text-primary"><UsersRound size={18} aria-hidden="true" /></span><div><h2 id="group-members-title" className="text-base font-semibold">People in this group</h2><p className="mt-1 text-sm leading-5 text-muted">New people are included only in expenses you create or edit.</p></div></div>
      <Button type="button" variant="outline" onClick={() => { setAddOpen((open) => !open); setError(null); setSuccess(null); setMemberName(""); if (!addOpen) window.setTimeout(() => inputRef.current?.focus(), 0); }} disabled={saving} className="min-h-11"><Plus size={16} aria-hidden="true" />Add member</Button>
    </div>

    {storageError && !error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[#eadbb7] bg-warning-soft p-3 text-sm leading-5 text-[#75511e]"><CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{storageError}</p>}
    {success && <p role="status" className="mt-4 rounded-xl border border-[#cfe0d3] bg-[#f1f7f2] p-3 text-sm leading-5 text-primary">{success}</p>}

    {saved.members.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-border bg-[#fcfdfb] px-4 py-5 text-center"><p className="text-sm font-medium">No people added yet</p><p className="mt-1 text-xs leading-5 text-muted">Add the people who may share your next expense.</p></div> : <ul className="mt-5 divide-y divide-[#edf1ed]">
      {saved.members.map((member) => <li key={member.id} className="flex min-h-14 items-center gap-3 py-2"><span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eaf1ec] text-xs font-bold text-primary">{member.name.trim().slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{member.name}</span><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${member.name} from group`} disabled={saving} onClick={() => void removeMember(member.id, member.name)} className="h-11 w-11 shrink-0 text-muted hover:bg-danger-soft hover:text-danger"><Trash2 size={16} aria-hidden="true" /></Button></li>)}
    </ul>}

    {addOpen && <form noValidate onSubmit={addMember} className="mt-5 rounded-xl bg-[#f7f9f6] p-4">
      <label htmlFor="new-group-member" className="block text-sm font-semibold">Member name</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input ref={inputRef} id="new-group-member" value={memberName} onChange={(event) => { setMemberName(event.target.value); setError(null); setInvalidInput(false); }} maxLength={50} autoComplete="off" placeholder="e.g. Jordan" aria-invalid={invalidInput} className={`h-11 w-full rounded-xl border border-border bg-white px-3.5 text-base text-foreground shadow-sm outline-none placeholder:text-[#87928b] hover:border-[#c7d4ca] focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm ${invalidInput ? "border-danger ring-2 ring-danger/15" : ""}`} /><Button type="submit" disabled={saving} className="min-h-11">{saving ? "Saving…" : "Add member"}</Button><Button type="button" variant="outline" disabled={saving} onClick={() => { setAddOpen(false); setMemberName(""); setError(null); setInvalidInput(false); }} className="min-h-11">Cancel</Button></div>
    </form>}
    {error && !error.startsWith("Can’t remove") && <FormErrorToast message={error} />}
    {error?.startsWith("Can’t remove") && <p role="alert" className="mt-4 rounded-xl border border-[#f0d3cd] bg-danger-soft p-3 text-sm leading-5 text-danger">{error} <Link href={`/groups/${encodeURIComponent(groupId)}/settlement`} className="font-semibold underline underline-offset-2">Review settlement</Link> to fix the saved expense before removing this person.</p>}
  </section>;
}
