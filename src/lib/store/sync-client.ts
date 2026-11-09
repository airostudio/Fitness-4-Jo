"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ENTITIES, type EntityName } from "@/lib/domain/schemas";
import { applyResults, compactQueue, orderOps, toWire, type OpResult } from "@/lib/domain/sync";
import { mergeRemote, remoteFromRows } from "./merge";
import type { AppData } from "./types";

export type SyncStatus =
  | { kind: "local" }                    // no cloud configured: this device only
  | { kind: "offline"; pending: number }
  | { kind: "syncing" }
  | { kind: "pending"; pending: number }
  | { kind: "synced"; at: string }       // only after the SERVER acknowledged everything
  | { kind: "error"; message: string; pending: number }
  | { kind: "signed-out" };

const MAX_ATTEMPTS = 5;

/** Push queued operations; returns the data with acknowledged ops removed. Never claims success without a server acknowledgement. */
export async function flushQueue(data: AppData): Promise<{ data: AppData; status: SyncStatus; conflicts: number }> {
  let queue = compactQueue(data.meta.queue);
  let conflicts = 0;
  const sendable = () => orderOps(queue.filter((o) => o.attempts < MAX_ATTEMPTS));
  while (sendable().length) {
    const batch = sendable().slice(0, 100);
    let res: Response;
    try {
      res = await fetch("/api/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ops: batch.map(toWire) }) });
    } catch { return { data: { ...data, meta: { ...data.meta, queue } }, status: { kind: "offline", pending: queue.length }, conflicts }; }
    if (res.status === 401) return { data: { ...data, meta: { ...data.meta, queue } }, status: { kind: "signed-out" }, conflicts };
    if (!res.ok) return { data: { ...data, meta: { ...data.meta, queue, lastError: `Server responded ${res.status}` } }, status: { kind: "error", message: "The server couldn't save your changes just yet. They're safe on this device and will retry.", pending: queue.length }, conflicts };
    const { results } = (await res.json()) as { results: OpResult[] };
    const out = applyResults(batch, results);
    conflicts += out.conflicts.length;
    const batchIds = new Set(batch.map((b) => b.opId));
    // rejected ops stay (flagged) so their records are never deleted by a later pull and Jo/support can see something needs attention
    const rejectedIds = new Set(out.rejected.map((r) => r.opId));
    queue = [
      ...queue.filter((o) => !batchIds.has(o.opId)),
      ...out.remaining,
      ...batch.filter((o) => rejectedIds.has(o.opId)).map((o) => ({ ...o, attempts: MAX_ATTEMPTS, lastError: (out.rejected.find((r) => r.opId === o.opId) as { reason?: string })?.reason })),
    ];
    if (out.remaining.length && !out.conflicts.length && out.remaining.length === batch.length) break; // nothing acknowledged: stop looping
  }
  const stuck = queue.filter((o) => o.attempts >= MAX_ATTEMPTS).length;
  const pending = queue.length;
  const next = { ...data, meta: { ...data.meta, queue, lastSyncAt: pending === 0 ? new Date().toISOString() : data.meta.lastSyncAt, lastError: stuck ? "Some changes could not be saved." : undefined } };
  if (stuck) return { data: next, status: { kind: "error", message: "A few changes couldn't be saved to your account. Everything is still on this device.", pending }, conflicts };
  return { data: next, status: pending === 0 ? { kind: "synced", at: new Date().toISOString() } : { kind: "pending", pending }, conflicts };
}

/** Read everything the signed-in user owns (RLS-scoped) and merge it in. */
export async function pullAndMerge(sb: SupabaseClient, data: AppData): Promise<AppData> {
  const rows: Partial<Record<EntityName, Record<string, unknown>[]>> = {};
  const names = Object.keys(ENTITIES) as EntityName[];
  const results = await Promise.all(names.map((n) => sb.from(ENTITIES[n].table).select("*").limit(10000)));
  for (let i = 0; i < names.length; i++) {
    const r = results[i]!;
    if (r.error) throw new Error(`pull ${names[i]} failed`);
    rows[names[i]!] = (r.data ?? []) as Record<string, unknown>[];
  }
  return { ...mergeRemote(data, remoteFromRows(rows)), meta: { ...data.meta, lastPullAt: new Date().toISOString() } };
}
