"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, Plus, Trash2, UsersRound } from "lucide-react";
import type { Member } from "@/types";
import type { SavedGroup } from "@/lib/groups/storage";
import { cancelGroupForm, getUserDisplayName, groupDetailsHref, normalizeMemberName, validateGroupDraft } from "@/lib/groups/form";
import { canLeaveWithUnsavedChanges } from "@/lib/forms/navigation";
import { useSavedGroups } from "@/components/groups/use-saved-groups";
import { useAuth } from "@/components/groups/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormErrorToast } from "@/components/ui/form-error-toast";

interface GroupFormProps { groupId?: string; onCancel?: () => void; onDirtyChange?: (dirty: boolean) => void; }

export function GroupForm({ groupId, onCancel, onDirtyChange }: GroupFormProps) {
  const router = useRouter();
  const { groups, loading, storageError, saveGroups, deleteGroup } = useSavedGroups();
  const { user } = useAuth();
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [ready, setReady] = useState(!groupId);
  const [dirty, setDirty] = useState(false);
  const [invalidField, setInvalidField] = useState<string | null>(null);

  function markDirty() { setDirty(true); onDirtyChange?.(true); }

  const currentGroup = groupId ? groups.find((entry) => entry.group.id === groupId) : undefined;

  const initializedGroup = useRef<string | null>(null);
  const initializedCurrentUser = useRef(false);

  useEffect(() => {
    if (!groupId || loading) return;
    if (currentGroup && initializedGroup.current !== groupId) {
      setName(currentGroup.group.name);
      setMembers(currentGroup.members);
      setFormError(null);
      setDirty(false);
      onDirtyChange?.(false);
      initializedGroup.current = groupId;
    }
    setReady(true);
  }, [currentGroup, groupId, loading]);

  useEffect(() => {
    if (groupId || loading || initializedCurrentUser.current || !user) return;
    initializedCurrentUser.current = true;
    const displayName = getUserDisplayName(user);
    if (displayName) setMembers([{ id: `draft-${crypto.randomUUID()}`, name: displayName }]);
  }, [groupId, loading, user]);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteOpen && !dialog.open) dialog.showModal();
    if (!deleteOpen && dialog.open) dialog.close();
  }, [deleteOpen]);

  function addMember() { setMembers((current) => [...current, { id: crypto.randomUUID(), name: "" }]); }
  function renameMember(memberId: string, nextName: string) { setMembers((current) => current.map((member) => member.id === memberId ? { ...member, name: nextName } : member)); }
  function removeMember(memberId: string) { setMembers((current) => current.filter((member) => member.id !== memberId)); }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Enter a group name.");
      setInvalidField("group-name");
      document.getElementById("group-name")?.focus();
      return;
    }
    const memberError = groupId ? null : validateGroupDraft(trimmedName, members);
    if (memberError) {
      setFormError(memberError);
      const blankIndex = members.findIndex((member) => !member.name.trim());
      const duplicateIndex = members.findIndex((member, index) => members.findIndex((candidate) => normalizeMemberName(candidate.name) === normalizeMemberName(member.name)) !== index);
      const field = blankIndex >= 0 ? `member-${members[blankIndex].id}` : duplicateIndex >= 0 ? `member-${members[duplicateIndex].id}` : "group-name";
      setInvalidField(field);
      document.getElementById(field)?.focus();
      return;
    }
    const activeMembers = (groupId ? currentGroup?.members ?? [] : members).map((member) => ({
      ...member,
      id: member.id.startsWith("draft-") ? crypto.randomUUID() : member.id,
      name: member.name.trim(),
    }));


    const previous = currentGroup;
    const groupIdToSave = previous?.group.id ?? crypto.randomUUID();
    const savedGroup: SavedGroup = {
      group: { id: groupIdToSave, name: trimmedName, memberIds: activeMembers.map((member) => member.id), createdAt: previous?.group.createdAt ?? new Date().toISOString() },
      members: activeMembers,
    };
    const nextGroups = previous ? groups.map((entry) => entry.group.id === groupIdToSave ? savedGroup : entry) : [savedGroup, ...groups];

    setSaving(true);
    try {
      const saveError = await saveGroups(nextGroups);
      if (saveError) { setFormError(saveError); return; }
      setDirty(false);
      onDirtyChange?.(false);
      router.push(previous ? `${groupDetailsHref(groupIdToSave)}?updated=1` : groupDetailsHref(groupIdToSave, true));
    } finally { setSaving(false); }
  }

  function handleCancel() {
    if (!canLeaveWithUnsavedChanges(dirty, () => window.confirm("Discard your unsaved group changes?"))) return;
    cancelGroupForm({
      reset: () => { setName(""); setMembers([]); setFormError(null); setDirty(false); onDirtyChange?.(false); },
      onCancel,
      groupId,
      navigate: (path) => router.push(path),
    });
  }

  async function confirmDelete() {
    if (!groupId || !currentGroup) return;
    if (!deleteConfirmation.trim()) {
      setDeleteError("Please enter the group name to confirm deletion.");
      document.getElementById("confirm-group-name")?.focus();
      return;
    }
    if (deleteConfirmation.trim() !== currentGroup.group.name) {
      setDeleteError("The group name does not match. Check the spelling and try again.");
      document.getElementById("confirm-group-name")?.focus();
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteGroup(groupId);
      setDeleteOpen(false);
      router.push("/groups");
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "The group could not be deleted. Your saved data was preserved.");
    } finally { setDeleting(false); }
  }

  if (loading || (groupId && !ready)) return <div role="status" className="animate-pulse rounded-2xl border border-border bg-white p-6"><span className="block h-4 w-28 rounded bg-surface-muted"/><span className="mt-3 block h-8 w-3/4 rounded bg-surface-muted"/><span className="mt-6 block h-11 rounded-xl bg-surface-muted"/></div>;

  if (groupId && ready && !currentGroup) return <Card className="p-6"><h2 className="text-lg font-semibold">Group not found</h2><p className="mt-2 text-sm text-muted">It may have been removed or isn’t available in this browser.</p><Link href="/groups" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={15} aria-hidden="true"/>Back to groups</Link></Card>;

  return <>
  <form id="create-group" noValidate onSubmit={handleSubmit} className="rounded-2xl border border-border bg-white p-5 sm:p-7">
    <div className="flex items-start gap-3 border-b border-[#edf1ed] pb-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf1ec] text-primary"><UsersRound size={19} aria-hidden="true" /></span>
      <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#87928b]">GROUP DETAILS</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]">{groupId ? "Edit your group" : "Create a group"}</h2><p className="mt-1 text-sm leading-5 text-muted">A trip, a shared home, dinner out — give your group a name.</p></div>
    </div>

    {storageError && !formError && <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-[#eadbb7] bg-warning-soft p-3 text-sm leading-5 text-[#75511e]"><CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />{storageError}</p>}

    <div className="mt-5">
      <label htmlFor="group-name" className="mb-1.5 block text-sm font-semibold">Group name</label>
      <Input id="group-name" name="groupName" value={name} onChange={(event) => { setName(event.target.value); setFormError(null); setInvalidField(null); markDirty(); }} placeholder="e.g. Weekend in Portland" maxLength={60} autoComplete="off" aria-required="true" aria-invalid={invalidField === "group-name"} className={invalidField === "group-name" ? "border-danger ring-2 ring-danger/15" : ""} />
    </div>

    {!groupId ? <section className="mt-7" aria-labelledby="create-members-heading">
      <div className="flex items-end justify-between gap-3">
        <div><h3 id="create-members-heading" className="text-sm font-semibold">People <span className="font-normal text-muted">(optional)</span></h3><p className="mt-1 text-xs leading-5 text-muted">Add names now or invite people to the list later.</p></div>
        <Button type="button" variant="outline" size="sm" onClick={() => { addMember(); setFormError(null); setInvalidField(null); markDirty(); }} className="min-h-11"><Plus size={15} aria-hidden="true" />Add person</Button>
      </div>
      <div className="mt-3 space-y-2.5">
        {members.map((member, index) => <div key={member.id} className="flex items-center gap-2 rounded-xl border border-border bg-[#fcfdfb] p-2">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eaf1ec] text-xs font-bold text-primary">{member.name.trim() ? member.name.trim().slice(0, 1).toUpperCase() : index + 1}</span>
          <label htmlFor={`member-${member.id}`} className="sr-only">Person {index + 1} name</label>
          <Input id={`member-${member.id}`} value={member.name} onChange={(event) => { renameMember(member.id, event.target.value); setFormError(null); setInvalidField(null); markDirty(); }} placeholder={`Person ${index + 1}`} maxLength={50} autoComplete="off" aria-invalid={invalidField === `member-${member.id}`} className={`h-10 border-transparent bg-transparent shadow-none hover:border-border focus:bg-white ${invalidField === `member-${member.id}` ? "border-danger ring-2 ring-danger/15" : ""}`} />
          <Button type="button" variant="ghost" size="icon" onClick={() => { removeMember(member.id); setFormError(null); setInvalidField(null); markDirty(); }} aria-label={`Remove person ${member.name || index + 1}`} className="h-11 w-11 shrink-0 text-[#839087] hover:bg-danger-soft hover:text-danger"><Trash2 size={16} aria-hidden="true" /></Button>
        </div>)}
        {members.length === 0 && <p className="rounded-xl border border-dashed border-border bg-[#fcfdfb] px-4 py-4 text-sm text-muted">You can create the group without members and add people later.</p>}
      </div>
    </section> : <p className="mt-5 rounded-xl bg-[#f7f9f6] px-4 py-3 text-sm leading-5 text-muted">Manage people in the member list on this group page. Adding someone won’t change existing expense shares.</p>}

    {formError?.startsWith("Can’t remove") && <p className="mt-4 text-sm text-danger">{formError} <Link href={`/groups/${encodeURIComponent(groupId!)}/settlement`} className="font-semibold underline underline-offset-2">Open settlement</Link> to review the saved expense.</p>}

    <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={handleCancel} disabled={saving || deleting} className="min-h-11">Cancel</Button>
      <Button type="submit" size="lg" disabled={saving}>{saving ? "Saving group…" : groupId ? "Save group" : "Create group"}<ArrowRight size={16} aria-hidden="true" /></Button>
    </div>
    {groupId && <details className="mt-8 border-t border-border pt-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"><span>Group settings</span><span aria-hidden="true">···</span></summary>
      <div className="mt-2 rounded-xl bg-[#fcfdfb] p-4"><p className="text-sm text-muted">Manage this group’s saved details and records.</p><Button type="button" variant="outline" disabled={saving || deleting} onClick={() => { setDeleteConfirmation(""); setDeleteError(null); setDeleteOpen(true); }} className="mt-3 min-h-11 border-[#e8b1a5] text-danger hover:bg-danger-soft">Delete group</Button></div>
    </details>}
  </form>

  {groupId && currentGroup && <dialog ref={deleteDialogRef} aria-labelledby="confirm-delete-title" aria-describedby="confirm-delete-description" onCancel={(event) => { event.preventDefault(); if (!deleting) { setDeleteOpen(false); setDeleteError(null); } }} onClick={(event) => { if (event.target === event.currentTarget && !deleting) { setDeleteOpen(false); setDeleteError(null); } }} className="m-auto max-h-[min(90dvh,42rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-border bg-white p-0 text-foreground shadow-2xl backdrop:bg-[#18251f]/45">
    <div className="p-5 sm:p-6">
      <h2 id="confirm-delete-title" className="text-lg font-semibold">Delete “{currentGroup.group.name}”?</h2>
      <p id="confirm-delete-description" className="mt-2 text-sm leading-6 text-muted">{user ? "This permanently deletes the group, its members, and its cloud expenses. Import or remove browser-only copies first; they are not included in the cloud delete." : "This permanently deletes the group and its browser-saved expenses."} This action can’t be undone.</p>
      <label htmlFor="confirm-group-name" className="mt-5 block text-sm font-semibold">Type <span className="font-bold">{currentGroup.group.name}</span> to confirm</label>
      {deleteError && <p id="delete-group-error" role="alert" aria-live="assertive" className="mt-2 rounded-xl border border-[#e8b1a5] bg-[#fff1ee] px-3.5 py-3 text-sm font-medium leading-5 text-[#a64531]">{deleteError}</p>}
      <Input id="confirm-group-name" value={deleteConfirmation} onChange={(event) => { const value = event.target.value; setDeleteConfirmation(value); if (deleteError) setDeleteError(value.trim() === currentGroup.group.name ? null : value.trim() ? "The group name does not match. Check the spelling and try again." : "Please enter the group name to confirm deletion."); }} autoComplete="off" aria-invalid={Boolean(deleteError || (deleteConfirmation && deleteConfirmation.trim() !== currentGroup.group.name))} aria-describedby={deleteError ? "delete-group-error" : undefined} className={`mt-2 ${deleteError || (deleteConfirmation && deleteConfirmation.trim() !== currentGroup.group.name) ? "border-danger ring-2 ring-danger/15" : ""}`} />
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={deleting} onClick={() => { setDeleteOpen(false); setDeleteError(null); }}>Cancel</Button>
        <Button type="button" variant="danger" disabled={deleting} onClick={() => void confirmDelete()}>{deleting ? "Deleting group…" : "Delete group permanently"}</Button>
      </div>
    </div>
  </dialog>}
  <FormErrorToast message={formError && !formError.startsWith("Can’t remove") ? formError : null} />
  </>;
}
