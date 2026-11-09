"use client";
import { createStore, del, get, set } from "idb-keyval";
import { emptyData, type AppData } from "./types";

// One IndexedDB database. Data is keyed per account (or "local"), so a shared device never mixes people's records.
let store: ReturnType<typeof createStore> | null = null;
const kv = () => (store ??= createStore("jostrong", "kv"));
const key = (scope: string) => `data:${scope}`;

export async function loadData(scope: string): Promise<AppData> {
  try {
    const d = await get<AppData>(key(scope), kv());
    return d && d.v === 1 ? { ...emptyData(), ...d, meta: { ...d.meta, queue: d.meta?.queue ?? [] } } : emptyData();
  } catch { return emptyData(); }
}
let chain: Promise<unknown> = Promise.resolve();
export function saveData(scope: string, data: AppData): Promise<void> {
  chain = chain.then(() => set(key(scope), data, kv())).catch(() => undefined);
  return chain as Promise<void>;
}
/** Wipe every trace of this account's data from the device (sign-out, account deletion). */
export async function clearData(scope: string): Promise<void> {
  try { await del(key(scope), kv()); } catch { /* ignore */ }
  try { localStorage.removeItem("jostrong-prefs"); } catch { /* ignore */ }
  try { if ("caches" in globalThis) { const names = await caches.keys(); await Promise.all(names.filter((n) => n.startsWith("jostrong-runtime")).map((n) => caches.delete(n))); } } catch { /* ignore */ }
}
