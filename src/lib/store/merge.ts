import { ENTITIES, type EntityName } from "@/lib/domain/schemas";
import { recordFromRow, type QueuedOp } from "@/lib/domain/sync";
import type { AppData } from "./types";

const ARRAYS = ["scheduled", "sessions", "sets", "checkins", "recommendations", "decisions", "milestones", "journal", "nutritionLogs"] as const;
const SINGLES = ["profile", "preferences", "equipment", "health", "goals", "notifications", "nutrition"] as const;
type Remote = Partial<Record<EntityName, Record<string, unknown>[]>>;

const time = (x: unknown) => Date.parse(String((x as { updatedAt?: string })?.updatedAt ?? 0)) || 0;

/** Convert raw DB rows (snake_case) into client records. */
export function remoteFromRows(rows: Partial<Record<EntityName, Record<string, unknown>[]>>): Remote {
  const out: Remote = {};
  for (const [name, list] of Object.entries(rows) as [EntityName, Record<string, unknown>[]][]) {
    out[name] = list.map((r) => recordFromRow(r, ENTITIES[name].single));
  }
  return out;
}

/**
 * Merge the server copy into local data without ever losing unsynced work:
 *  - a record with a pending operation is left alone (it will be pushed);
 *  - otherwise the newer `updatedAt` wins (server wins ties);
 *  - a local record that no longer exists on the server and has no pending op was deleted elsewhere, so it is removed.
 */
export function mergeRemote(local: AppData, remote: Remote, pending: QueuedOp[] = local.meta.queue): AppData {
  const isPending = (e: EntityName, id: string) => pending.some((o) => o.entity === e && o.id === id);
  const next: AppData = { ...local };
  for (const key of ARRAYS) {
    const remoteList = (remote[key] ?? []) as { id: string }[];
    const byId = new Map((local[key] as { id: string }[]).map((r) => [r.id, r]));
    const merged = new Map<string, { id: string }>();
    for (const r of remoteList) {
      const mine = byId.get(r.id);
      if (mine && isPending(key, r.id)) merged.set(r.id, mine);
      else if (mine && time(mine) > time(r)) merged.set(r.id, mine);
      else merged.set(r.id, r);
    }
    for (const [id, r] of byId) if (!merged.has(id) && isPending(key, id)) merged.set(id, r);
    (next as unknown as Record<string, unknown>)[key] = [...merged.values()];
  }
  for (const key of SINGLES) {
    const r = remote[key]?.[0];
    if (!r) continue;
    const mine = local[key] as unknown;
    if (mine && (isPending(key, "self") || time(mine) > time(r))) continue;
    (next as unknown as Record<string, unknown>)[key] = r;
  }
  const rp = remote.program?.[0] as (AppData["program"]) | undefined;
  if (rp) {
    const mine = local.program;
    if (!(mine && (isPending("program", mine.id) || time(mine) > time(rp)))) next.program = rp;
  }
  return next;
}
