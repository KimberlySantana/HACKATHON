"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, UsersRound } from "lucide-react";
import { GroupForm } from "@/components/groups/group-form";
import { GroupList } from "@/components/groups/group-list";
import { Button } from "@/components/ui/button";
import { canLeaveWithUnsavedChanges } from "@/lib/forms/navigation";

export function GroupsWorkspace() {
  const [createOpen, setCreateOpen] = useState(false);
  const [createDirty, setCreateDirty] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (createOpen && !dialog.open) dialog.showModal();
    if (!createOpen && dialog.open) dialog.close();
  }, [createOpen]);

  function closeCreate(confirmDraft = true) {
    if (confirmDraft && !canLeaveWithUnsavedChanges(createDirty, () => window.confirm("Discard your unsaved group changes?"))) return;
    setCreateOpen(false);
    setCreateDirty(false);
  }

  return <>
    <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:gap-10">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf1ec] text-primary"><UsersRound size={18} aria-hidden="true" /></span>
            <div><h2 className="text-sm font-semibold">One space per shared plan</h2><p className="mt-1 text-sm leading-5 text-muted">Add people now or later, then keep expenses organized in one place.</p></div>
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)} className="min-h-11 shrink-0"><Plus size={16} aria-hidden="true" />Create group</Button>
        </div>
        <p className="flex items-start gap-2 px-1 text-xs leading-5 text-muted"><span aria-hidden="true">↳</span> Group totals come from the expenses you add. No example balances are mixed with your data.</p>
      </div>
      <GroupList onCreate={() => setCreateOpen(true)} />
    </div>

    <dialog
      ref={dialogRef}
      aria-label="Create a group"
      onCancel={(event) => { event.preventDefault(); closeCreate(); }}
      onClick={(event) => { if (event.target === event.currentTarget) closeCreate(); }}
      className="m-auto max-h-[min(92dvh,48rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-border bg-[#fbfaf7] p-0 text-foreground shadow-2xl backdrop:bg-[#18251f]/45"
    >
      <div className="p-4 sm:p-6">{createOpen && <GroupForm onDirtyChange={setCreateDirty} onCancel={() => closeCreate(false)} />}</div>
    </dialog>
  </>;
}
