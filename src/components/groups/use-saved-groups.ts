"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/groups/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { GROUPS_STORAGE_KEY, parseSavedGroups, serializeSavedGroups, type SavedGroup } from "@/lib/groups/storage";
import { EXPENSES_STORAGE_KEY, EXPENSES_UPDATED_EVENT, getSavedExpenses, parseExpenses } from "@/lib/expenses/storage";
import { findReferencedMembers } from "@/lib/groups/member-references";
import { groupSaveError } from "@/lib/groups/form";

const GROUPS_UPDATED_EVENT = "splitzy:groups-updated";

function memberNames(memberIds: string[], members: SavedGroup["members"]) {
  return memberIds.map((id) => members.find((member) => member.id === id)?.name ?? "A group member").join(", ");
}

function groupDeleteError(cause: unknown) {
  const code = typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : "";
  if (code === "PGRST202" || code === "42883") return "Cloud group deletion is not enabled yet. Apply supabase/migrations/20261114222848_delete_group_atomic.sql, then try again. Nothing was deleted.";
  if (code === "42501") return "Supabase denied this deletion. Confirm you’re signed in to the account that owns this group. Nothing was deleted.";
  if (cause instanceof TypeError || (cause instanceof Error && /fetch|network|offline/i.test(cause.message))) return "Splitzy couldn’t reach Supabase. Nothing was deleted; try again when cloud access returns.";
  return "Supabase could not delete this group. Nothing was deleted; refresh the group and try again.";
}

export function useSavedGroups() {
  const { user, loading: authLoading } = useAuth();
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [hasLocalGroups, setHasLocalGroups] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const load = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    let local: SavedGroup[] = [];
    try {
      local = parseSavedGroups(window.localStorage.getItem(GROUPS_STORAGE_KEY));
      setHasLocalGroups(local.length > 0);
      if (user) {
        try {
          const { data: groupRows, error: groupError } = await supabase.from("groups").select("id,name,created_at").order("created_at", { ascending: false });
          if (groupError) throw groupError;
          const { data: memberRows, error: memberError } = await supabase.from("group_members").select("id,group_id,name,sort_order").order("sort_order");
          if (memberError) throw memberError;
          const loaded = (groupRows ?? []).map((row) => {
            const members = (memberRows ?? []).filter((member) => member.group_id === row.id).map((member) => ({ id: member.id, name: member.name }));
            return { group: { id: row.id, name: row.name, memberIds: members.map((member) => member.id), createdAt: row.created_at }, members } satisfies SavedGroup;
          });
          setGroups(loaded);
          setStorageError(null);
        } catch {
          setGroups(local);
          setStorageError("Supabase is unavailable. Showing groups saved in this browser until cloud access returns.");
        }
      } else setGroups(local);
      if (!user) setStorageError(null);
    } catch {
      setGroups([]);
      setStorageError("Splitzy could not read saved groups in this browser.");
    } finally { setLoading(false); }
  }, [authLoading, supabase, user]);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("storage", refresh);
    window.addEventListener(GROUPS_UPDATED_EVENT, refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener(GROUPS_UPDATED_EVENT, refresh); };
  }, [load]);

  const saveGroups = useCallback(async (nextGroups: SavedGroup[]): Promise<string | null> => {
    try {
      if (user) {
        const removals: Array<{ groupId: string; memberIds: string[]; members: SavedGroup["members"] }> = [];
        for (const previous of groups) {
          const next = nextGroups.find((entry) => entry.group.id === previous.group.id);
          if (!next) continue;
          const nextMemberIds = new Set(next.members.map((member) => member.id));
          const removed = previous.members.filter((member) => !nextMemberIds.has(member.id));
          if (removed.length) removals.push({ groupId: previous.group.id, memberIds: removed.map((member) => member.id), members: removed });
        }

        try {
          // Check both browser-only and cloud records before issuing any group writes.
          for (const removal of removals) {
            const localExpenses = getSavedExpenses(removal.groupId);
            const localReferences = findReferencedMembers(removal.memberIds, localExpenses);
            if (localReferences.length) {
              throw new Error(`Can’t remove ${memberNames(localReferences, removal.members)} yet. A browser-only expense still uses ${localReferences.length === 1 ? "this person" : "these people"}. Reassign or import that expense first.`);
            }

            const [{ data: payerRows, error: payerError }, { data: splitRows, error: splitError }] = await Promise.all([
              supabase.from("expenses").select("paid_by_member_id").eq("group_id", removal.groupId).in("paid_by_member_id", removal.memberIds).limit(1),
              supabase.from("item_splits").select("member_id").eq("group_id", removal.groupId).in("member_id", removal.memberIds).limit(1),
            ]);
            if (payerError) throw payerError;
            if (splitError) throw splitError;
            const cloudReferences = [...new Set([
              ...(payerRows ?? []).map((row) => row.paid_by_member_id as string),
              ...(splitRows ?? []).map((row) => row.member_id as string),
            ])];
            if (cloudReferences.length) {
              throw new Error(`Can’t remove ${memberNames(cloudReferences, removal.members)} yet. A saved cloud expense uses ${cloudReferences.length === 1 ? "this person" : "these people"}. Reassign or delete that expense first.`);
            }
          }

          for (const { group, members } of nextGroups) {
            const { error: groupError } = await supabase.from("groups").upsert({ id: group.id, name: group.name, created_at: group.createdAt, owner_id: user.id });
            if (groupError) throw groupError;
            const memberRows = members.map((member, sort_order) => ({ id: member.id, group_id: group.id, name: member.name, sort_order }));
            if (memberRows.length) { const { error } = await supabase.from("group_members").upsert(memberRows); if (error) throw error; }
            const keepIds = memberRows.map((member) => member.id);
            let query = supabase.from("group_members").delete().eq("group_id", group.id);
            if (keepIds.length) query = query.not("id", "in", `(${keepIds.join(",")})`);
            const { error: deleteError } = await query;
            if (deleteError) throw deleteError;
          }
          setGroups(nextGroups);
          setStorageError(null);
          window.dispatchEvent(new Event(GROUPS_UPDATED_EVENT));
          return null;
        } catch (cause) {
          const blockedByExpense = cause instanceof Error && cause.message.startsWith("Can’t remove");
          const message = blockedByExpense ? cause.message : groupSaveError(cause);
          // Re-read cloud state after a partial network failure; never disguise it as a local save.
          if (!blockedByExpense) await load();
          setStorageError(message);
          return message;
        }
      } else {
        for (const previous of groups) {
          const next = nextGroups.find((entry) => entry.group.id === previous.group.id);
          if (!next) continue;
          const nextMemberIds = new Set(next.members.map((member) => member.id));
          const removed = previous.members.filter((member) => !nextMemberIds.has(member.id));
          const referenced = findReferencedMembers(removed.map((member) => member.id), getSavedExpenses(previous.group.id));
          if (referenced.length) {
            const message = `Can’t remove ${memberNames(referenced, removed)} yet. A saved expense still uses ${referenced.length === 1 ? "this person" : "these people"}. Reassign or delete that expense first.`;
            setStorageError(message);
            return message;
          }
        }
        window.localStorage.setItem(GROUPS_STORAGE_KEY, serializeSavedGroups(nextGroups));
        setGroups(nextGroups);
        setHasLocalGroups(nextGroups.length > 0);
        window.dispatchEvent(new Event(GROUPS_UPDATED_EVENT));
      }
      setStorageError(null);
      return null;
    } catch (cause) {
      const message = user ? groupSaveError(cause) : "Your changes could not be saved in this browser. Check available storage and try again.";
      setStorageError(message);
      return message;
    }
  }, [groups, load, supabase, user]);

  const deleteGroup = useCallback(async (groupId: string) => {
    const localExpenses = getSavedExpenses(groupId);
    if (user && localExpenses.length > 0) {
      throw new Error("This group has browser-only expense copies. Import or remove those copies before deleting the cloud group; they have been preserved.");
    }

    if (user) {
      const { data, error } = await supabase.rpc("delete_group", { p_group_id: groupId });
      if (error) throw new Error(groupDeleteError(error));
      if (data !== true) throw new Error("The group was not found in your cloud account. Nothing was deleted.");
    }

    const previousGroups = window.localStorage.getItem(GROUPS_STORAGE_KEY);
    const previousExpenses = window.localStorage.getItem(EXPENSES_STORAGE_KEY);
    try {
      const remainingGroups = parseSavedGroups(previousGroups).filter((entry) => entry.group.id !== groupId);
      const remainingExpenses = parseExpenses(previousExpenses).filter((entry) => entry.groupId !== groupId);
      window.localStorage.setItem(GROUPS_STORAGE_KEY, serializeSavedGroups(remainingGroups));
      window.localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(remainingExpenses));
      setGroups((current) => current.filter((entry) => entry.group.id !== groupId));
      setHasLocalGroups(remainingGroups.length > 0);
      window.dispatchEvent(new Event(GROUPS_UPDATED_EVENT));
      window.dispatchEvent(new Event(EXPENSES_UPDATED_EVENT));
    } catch (cause) {
      try {
        if (previousGroups === null) window.localStorage.removeItem(GROUPS_STORAGE_KEY);
        else window.localStorage.setItem(GROUPS_STORAGE_KEY, previousGroups);
        if (previousExpenses === null) window.localStorage.removeItem(EXPENSES_STORAGE_KEY);
        else window.localStorage.setItem(EXPENSES_STORAGE_KEY, previousExpenses);
      } catch { /* Preserve the original failure for the confirmation dialog. */ }
      if (user) throw new Error("The cloud group was deleted, but this browser couldn’t clear its saved copy. Refresh the page before using local mode.");
      throw new Error("The group could not be deleted from this browser. Your saved data was preserved; check browser storage and try again.");
    }
  }, [supabase, user]);

  const importLocalGroups = useCallback(async () => {
    if (!user) return false;
    try {
      const local = parseSavedGroups(window.localStorage.getItem(GROUPS_STORAGE_KEY));
      const { data: existing, error } = await supabase.from("groups").select("id");
      if (error) throw error;
      const existingIds = new Set((existing ?? []).map((row) => row.id));
      const additions = local.filter((entry) => !existingIds.has(entry.group.id));
      for (const entry of additions) {
        const { error: groupError } = await supabase.from("groups").insert({ id: entry.group.id, name: entry.group.name, created_at: entry.group.createdAt, owner_id: user.id });
        if (groupError) throw groupError;
        if (entry.members.length) {
          const { error: membersError } = await supabase.from("group_members").insert(entry.members.map((member, sort_order) => ({ id: member.id, group_id: entry.group.id, name: member.name, sort_order })));
          if (membersError) throw membersError;
        }
      }
      await load();
      setStorageError(null);
      return true;
    } catch {
      setStorageError("Some browser groups could not be imported. Your local copy is preserved; retry after checking cloud storage.");
      return false;
    }
  }, [load, supabase, user]);

  return { groups, loading: loading || authLoading, storageError, refresh: load, saveGroups, deleteGroup, hasLocalGroups, importLocalGroups };
}
