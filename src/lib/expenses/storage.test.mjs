import assert from "node:assert/strict";
import test from "node:test";
import { deleteLocalExpense, EXPENSES_STORAGE_KEY, EXPENSES_UPDATED_EVENT, getSavedExpenses, saveExpense } from "./storage.ts";

const expense = (id, groupId) => ({
  id, groupId, description: id, paidByMemberId: "member-1", taxCents: 0, tipCents: 0,
  createdAt: "2026-11-14T12:00:00.000Z", items: [],
});

test("guest deletion persists in local storage and is visible after reloading saved expenses", () => {
  const originalWindow = globalThis.window;
  const store = new Map([[EXPENSES_STORAGE_KEY, JSON.stringify([expense("remove-me", "group-1"), expense("keep-me", "group-1"), expense("other-group", "group-2")])]]);
  const events = [];
  globalThis.window = {
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
    },
    dispatchEvent: (event) => { events.push(event.type); return true; },
  };

  try {
    deleteLocalExpense("remove-me");
    assert.deepEqual(getSavedExpenses("group-1").map((entry) => entry.id), ["keep-me"]);
    assert.deepEqual(getSavedExpenses("group-2").map((entry) => entry.id), ["other-group"]);
    assert.deepEqual(events, [EXPENSES_UPDATED_EVENT]);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("editing a guest expense replaces the original record and survives reloading saved expenses", () => {
  const originalWindow = globalThis.window;
  const store = new Map([[EXPENSES_STORAGE_KEY, JSON.stringify([expense("edit-me", "group-1"), expense("keep-me", "group-1")])]]);
  globalThis.window = {
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
    },
    dispatchEvent: () => true,
  };

  try {
    saveExpense({ ...expense("edit-me", "group-1"), description: "Updated dinner" });
    const reloaded = getSavedExpenses("group-1");
    assert.equal(reloaded.filter((entry) => entry.id === "edit-me").length, 1);
    assert.equal(reloaded.find((entry) => entry.id === "edit-me").description, "Updated dinner");
    assert.equal(reloaded.length, 2);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("guest item notes save, reload, edit, and clear without changing expense IDs", () => {
  const originalWindow = globalThis.window;
  const store = new Map([[EXPENSES_STORAGE_KEY, "[]"]]);
  globalThis.window = {
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
    },
    dispatchEvent: () => true,
  };
  const base = expense("note-expense", "group-1");
  const item = { id: "note-item", name: "Soup", quantity: 1, unitPriceCents: 650, assignedMemberIds: ["member-1"] };

  try {
    saveExpense({ ...base, items: [{ ...item, note: "Dairy-free" }] });
    assert.equal(getSavedExpenses("group-1")[0].items[0].note, "Dairy-free");
    saveExpense({ ...base, description: "Edited soup", items: [{ ...item, note: "No cream" }] });
    assert.equal(getSavedExpenses("group-1")[0].items[0].note, "No cream");
    assert.equal(getSavedExpenses("group-1")[0].description, "Edited soup");
    saveExpense({ ...base, description: "Edited soup", items: [{ ...item, note: undefined }] });
    assert.equal(getSavedExpenses("group-1")[0].items[0].note, undefined);
    assert.equal(getSavedExpenses("group-1").length, 1);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
