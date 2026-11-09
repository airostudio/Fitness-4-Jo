// Offline-first sync protocol. The client queues idempotent operations; the server applies each at most once.
import { ENTITIES, syncOpSchema, type EntityName, type SyncOp } from "./schemas";
import { uuid } from "./dates";

export interface QueuedOp extends SyncOp { attempts: number; lastError?: string; }
export type OpResult =
  | { opId: string; status: "applied" | "duplicate" }
  | { opId: string; status: "conflict"; serverUpdatedAt: string }
  | { opId: string; status: "rejected"; reason: string };

export function makeOp(entity: EntityName, id: string, action: "upsert" | "delete", record: unknown, now: string): QueuedOp {
  return { opId: uuid(), entity, id, action, record, clientUpdatedAt: now, attempts: 0 };
}

/** Strip client-only bookkeeping before sending an op over the wire. */
export function toWire(op: QueuedOp): SyncOp {
  return { opId: op.opId, entity: op.entity, id: op.id, action: op.action, record: op.record, clientUpdatedAt: op.clientUpdatedAt };
}

/** Collapse the queue: only the newest op per (entity,id) is needed, because records carry full state. */
export function compactQueue(queue: QueuedOp[]): QueuedOp[] {
  const latest = new Map<string, QueuedOp>();
  for (const op of queue) latest.set(`${op.entity}:${op.id}`, op);
  return queue.filter((op) => latest.get(`${op.entity}:${op.id}`) === op);
}

/** Order: parents before children on upsert so foreign keys resolve; reverse for deletes. */
const ORDER: EntityName[] = ["profile", "preferences", "equipment", "health", "goals", "notifications", "nutrition", "program", "scheduled", "checkins", "sessions", "sets", "recommendations", "decisions", "milestones", "journal", "nutritionLogs"];
export function orderOps(ops: QueuedOp[]): QueuedOp[] {
  const rank = (o: QueuedOp) => (o.action === "delete" ? 100 - ORDER.indexOf(o.entity) : ORDER.indexOf(o.entity));
  return [...ops].sort((a, b) => (a.action === b.action ? rank(a) - rank(b) : a.action === "upsert" ? -1 : 1));
}

export function applyResults(queue: QueuedOp[], results: OpResult[]): { remaining: QueuedOp[]; conflicts: OpResult[]; rejected: OpResult[] } {
  const byId = new Map(results.map((r) => [r.opId, r]));
  const remaining: QueuedOp[] = [];
  const conflicts: OpResult[] = [];
  const rejected: OpResult[] = [];
  for (const op of queue) {
    const r = byId.get(op.opId);
    if (!r) { remaining.push({ ...op, attempts: op.attempts + 1 }); continue; } // not acknowledged → retry
    if (r.status === "applied" || r.status === "duplicate") continue;
    if (r.status === "conflict") conflicts.push(r);
    else rejected.push(r);
  }
  return { remaining, conflicts, rejected };
}

// ------------------------------------------------------------------- Server
export interface SyncRepo {
  /** Has this op id already been processed for this user? */
  seen(userId: string, opId: string): Promise<boolean>;
  record(userId: string, op: SyncOp, status: string): Promise<void>;
  currentUpdatedAt(table: string, userId: string, id: string, single: boolean): Promise<string | null>;
  upsert(table: string, row: Record<string, unknown>): Promise<void>;
  remove(table: string, userId: string, id: string, single: boolean): Promise<void>;
}

export const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
export const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
export function rowFromRecord(userId: string, single: boolean, id: string, record: Record<string, unknown>, knownKeys: string[] = []): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  // Optional fields that were cleared on the device must be cleared on the server too.
  for (const k of knownKeys) row[toSnake(k)] = null;
  for (const [k, v] of Object.entries(record)) row[toSnake(k)] = v === undefined ? null : v;
  // Ownership is ALWAYS taken from the authenticated user, never from the payload.
  row.user_id = userId;
  if (!single) row.id = id; else delete row.id;
  return row;
}
export function recordFromRow(row: Record<string, unknown>, single: boolean): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "user_id" || k === "server_updated_at" || (single && k === "id")) continue;
    if (v !== null) rec[toCamel(k)] = v;
  }
  return rec;
}

/**
 * Apply a batch for an AUTHENTICATED user. `userId` must come from the verified session, never the request body.
 * - Each op is validated with Zod before it touches the database.
 * - Re-delivery of an op id is a no-op ("duplicate"), so retries never create duplicate sets.
 * - Last-writer-wins on `updatedAt`: if the server copy is newer, the op is reported as a conflict.
 */
export async function applyBatch(repo: SyncRepo, userId: string, rawOps: unknown[]): Promise<OpResult[]> {
  const results: OpResult[] = [];
  for (const raw of rawOps) {
    const parsed = syncOpSchema.safeParse(raw);
    if (!parsed.success) {
      const opId = typeof (raw as { opId?: unknown })?.opId === "string" ? (raw as { opId: string }).opId : "unknown";
      results.push({ opId, status: "rejected", reason: "Invalid operation" });
      continue;
    }
    const op = parsed.data;
    try {
      if (await repo.seen(userId, op.opId)) { results.push({ opId: op.opId, status: "duplicate" }); continue; }
      const ent = ENTITIES[op.entity];
      const current = await repo.currentUpdatedAt(ent.table, userId, op.id, ent.single);
      if (op.action === "delete") {
        await repo.remove(ent.table, userId, op.id, ent.single);
        await repo.record(userId, op, "applied");
        results.push({ opId: op.opId, status: "applied" });
        continue;
      }
      const rec = ent.schema.safeParse(op.record);
      if (!rec.success) { await repo.record(userId, op, "rejected"); results.push({ opId: op.opId, status: "rejected", reason: "Record failed validation" }); continue; }
      const data = rec.data as Record<string, unknown>;
      if (!ent.single && data.id !== op.id) { results.push({ opId: op.opId, status: "rejected", reason: "Record id mismatch" }); continue; }
      if (current && Date.parse(current) > Date.parse(op.clientUpdatedAt)) {
        await repo.record(userId, op, "conflict");
        results.push({ opId: op.opId, status: "conflict", serverUpdatedAt: current });
        continue;
      }
      await repo.upsert(ent.table, rowFromRecord(userId, ent.single, op.id, data, Object.keys((ent.schema as { shape: Record<string, unknown> }).shape)));
      await repo.record(userId, op, "applied");
      results.push({ opId: op.opId, status: "applied" });
    } catch {
      // Deliberately generic: never echo health data or SQL errors back to the client or the logs.
      results.push({ opId: op.opId, status: "rejected", reason: "Server could not apply this change" });
    }
  }
  return results;
}
