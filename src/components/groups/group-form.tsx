"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Home, Plus, ReceiptText, Trash2, UsersRound } from "lucide-react";
import type { Member } from "@/types";
import type { SavedGroup } from "@/lib/groups/storage";
import { useSavedGroups } from "@/components/groups/use-saved-groups";
import { useLanguage } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface GroupFormProps { groupId?: string; }

export function GroupForm({ groupId }: GroupFormProps) {
  const { t } = useLanguage();
  const { groups, loading, storageError, saveGroups } = useSavedGroups();
  const [name, setName] = useState("");
  const [members, setMembers] = useState<Member[]>([{ id: "draft-member-1", name: "" }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedGroupId, setSavedGroupId] = useState<string | null>(null);
  const [ready, setReady] = useState(!groupId);
  const successRef = useRef<HTMLElement | null>(null);

  const currentGroup = groupId ? groups.find((entry) => entry.group.id === groupId) : undefined;

  useEffect(() => {
    if (!groupId || loading) return;
    if (currentGroup) {
      setName(currentGroup.group.name);
      setMembers(currentGroup.members);
      setFormError(null);
    }
    setReady(true);
  }, [currentGroup, groupId, loading]);

  useEffect(() => {
    if (!savedGroupId) return;
    const frame = window.requestAnimationFrame(() => {
      successRef.current?.scrollIntoView({ block: "center" });
      successRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [savedGroupId]);

  function addMember() { setMembers((current) => [...current, { id: crypto.randomUUID(), name: "" }]); }
  function renameMember(memberId: string, nextName: string) { setMembers((current) => current.map((member) => member.id === memberId ? { ...member, name: nextName } : member)); }
  function removeMember(memberId: string) { setMembers((current) => current.filter((member) => member.id !== memberId)); }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setFormError(null);
    setSavedGroupId(null);
    const trimmedName = name.trim();
    const activeMembers = members.filter((member) => member.name.trim()).map((member) => ({
      ...member,
      id: member.id.startsWith("draft-") ? crypto.randomUUID() : member.id,
      name: member.name.trim(),
    }));

    if (!trimmedName) { setFormError("Add a name so everyone can find this group."); return; }
    if (activeMembers.length === 0) { setFormError("Add at least one person to continue."); return; }

    const previous = currentGroup;
    const groupIdToSave = previous?.group.id ?? crypto.randomUUID();
    const savedGroup: SavedGroup = {
      group: { id: groupIdToSave, name: trimmedName, memberIds: activeMembers.map((member) => member.id), createdAt: previous?.group.createdAt ?? new Date().toISOString() },
      members: activeMembers,
    };
    const nextGroups = previous ? groups.map((entry) => entry.group.id === groupIdToSave ? savedGroup : entry) : [savedGroup, ...groups];

    setSaving(true);
    try {
      if (!await saveGroups(nextGroups)) { setFormError(t("groups.saveError")); return; }
      setSavedGroupId(groupIdToSave);
    } finally { setSaving(false); }
  }

  if (loading || (groupId && !ready)) return <div role="status" className="animate-pulse rounded-2xl border border-border bg-white p-6"><span className="block h-4 w-28 rounded bg-surface-muted"/><span className="mt-3 block h-8 w-3/4 rounded bg-surface-muted"/><span className="mt-6 block h-11 rounded-xl bg-surface-muted"/></div>;

  if (groupId && ready && !currentGroup) return <Card className="p-6"><h2 className="text-lg font-semibold">Group not found</h2><p className="mt-2 text-sm text-muted">It may have been removed or isn’t available in this browser.</p><Link href="/groups" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={15} aria-hidden="true"/>Back to groups</Link></Card>;

  if (savedGroupId) return <section ref={successRef} tabIndex={-1} role="status" aria-live="polite" aria-labelledby="group-save-success-title" aria-describedby="group-save-success-description" className="brand-card p-6 outline-none focus-visible:ring-4 focus-visible:ring-ring/15 sm:p-8">
    <div className="flex items-start gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-success-soft text-[#4d7a54]" aria-hidden="true"><CheckCircle2 size={25} /></span>
      <div>
        <p className="brand-kicker text-[#4d7a54]">{t("groups.savedLabel")}</p>
        <h2 id="group-save-success-title" className="mt-1 text-2xl font-extrabold tracking-[-0.04em]">{t("groups.saveSuccess")}</h2>
        <p id="group-save-success-description" className="mt-2 max-w-xl text-sm leading-6 text-muted">{t("groups.saveSuccessDescription")}</p>
      </div>
    </div>
    <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
      <Link href={`/scan?groupId=${encodeURIComponent(savedGroupId)}`} className="brand-button brand-button-coral min-h-12 w-full text-sm sm:w-auto"><ReceiptText size={16} aria-hidden="true" />{t("groups.nextScan")}<ArrowRight size={16} aria-hidden="true" /></Link>
      <Link href="/" className="brand-button brand-button-cream min-h-12 w-full text-sm sm:w-auto"><Home size={16} aria-hidden="true" />{t("groups.backOverview")}</Link>
    </div>
  </section>;

  return <form id="create-group" onSubmit={handleSubmit} className="brand-card p-5 sm:p-7">
    <div className="flex items-start gap-3 border-b border-[#edf1ed] pb-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf1ec] text-primary"><UsersRound size={19} aria-hidden="true" /></span>
      <div><p className="brand-kicker">GROUP DETAILS</p><h2 className="mt-1 text-xl font-extrabold tracking-[-0.035em]">{groupId ? "Edit your group" : "Create a group"}</h2><p className="mt-1 text-sm leading-5 text-muted">A trip, a shared home, dinner out — give your group a name.</p></div>
    </div>

    {storageError && <p role="alert" className="brand-alert brand-alert-warning mt-5 flex items-start gap-2"><CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />{storageError}</p>}

    <div className="mt-5">
      <label htmlFor="group-name" className="brand-label mb-1.5 block">Group name</label>
      <Input id="group-name" name="groupName" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Weekend in Portland" maxLength={60} autoComplete="off" />
    </div>

    <div className="mt-7 flex items-end justify-between gap-3">
      <div><h3 className="text-sm font-semibold">People in this group</h3><p className="mt-1 text-xs leading-5 text-muted">You can update the list any time.</p></div>
      <Button type="button" variant="outline" size="sm" onClick={addMember}><Plus size={15} aria-hidden="true" />Add person</Button>
    </div>

    <div className="mt-3 space-y-2.5">
      {members.map((member, index) => <div key={member.id} className="flex items-center gap-2 rounded-xl border border-border bg-[#fcfdfb] p-2">
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eaf1ec] text-xs font-bold text-primary">{member.name.trim() ? member.name.trim().slice(0, 1).toUpperCase() : index + 1}</span>
        <label htmlFor={`member-${member.id}`} className="sr-only">Person {index + 1} name</label>
        <Input id={`member-${member.id}`} value={member.name} onChange={(event) => renameMember(member.id, event.target.value)} placeholder={`Person ${index + 1}`} maxLength={50} autoComplete="off" className="h-10 border-transparent bg-transparent shadow-none hover:border-border focus:bg-white" />
        <Button type="button" variant="ghost" size="icon" onClick={() => removeMember(member.id)} aria-label={`Remove person ${member.name || index + 1}`} className="h-9 w-9 shrink-0 text-[#839087] hover:bg-danger-soft hover:text-danger"><Trash2 size={16} aria-hidden="true" /></Button>
      </div>)}
      {members.length === 0 && <p className="rounded-xl border border-dashed border-border bg-[#fcfdfb] px-4 py-4 text-sm text-muted">No people added yet. Add at least one person to continue.</p>}
    </div>

    {formError && <p role="alert" className="brand-alert brand-alert-danger mt-4 flex items-start gap-2"><CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{formError}</p>}

    <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
      <Link href={groupId ? `/groups/${encodeURIComponent(groupId)}` : "/"} className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-muted hover:bg-surface-muted hover:text-foreground">Cancel</Link>
      <Button type="submit" size="lg" disabled={saving}>{saving ? "Saving group…" : groupId ? "Save group" : "Create group"}<ArrowRight size={16} aria-hidden="true" /></Button>
    </div>
  </form>;
}
