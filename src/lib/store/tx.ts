import { makeOp, type QueuedOp } from "@/lib/domain/sync";
import type { EntityName } from "@/lib/domain/schemas";
import type { AppData, Ctx, TxResult } from "./types";

type ArrayEntity = "scheduled" | "sessions" | "sets" | "checkins" | "recommendations" | "decisions" | "milestones" | "journal";
type SingleEntity = "profile" | "preferences" | "equipment" | "health" | "goals" | "notifications";

/** Tiny unit-of-work: applies changes to a copy of the data and records the sync ops they imply. */
export class Tx {
  data: AppData;
  ops: QueuedOp[] = [];
  constructor(base: AppData, readonly ctx: Ctx) { this.data = { ...base }; }

  single<K extends SingleEntity>(key: K, value: NonNullable<AppData[K]>) {
    (this.data as unknown as Record<string, unknown>)[key] = value;
    this.ops.push(makeOp(key as EntityName, "self", "upsert", value, this.ctx.now));
  }
  program(value: NonNullable<AppData["program"]>) {
    this.data.program = value;
    this.ops.push(makeOp("program", value.id, "upsert", value, this.ctx.now));
  }
  put<K extends ArrayEntity>(key: K, record: AppData[K][number]) {
    const arr = [...(this.data[key] as { id: string }[])];
    const i = arr.findIndex((r) => r.id === (record as { id: string }).id);
    if (i >= 0) arr[i] = record as never; else arr.push(record as never);
    (this.data as unknown as Record<string, unknown>)[key] = arr;
    this.ops.push(makeOp(key as EntityName, (record as { id: string }).id, "upsert", record, this.ctx.now));
  }
  remove<K extends ArrayEntity>(key: K, id: string) {
    (this.data as unknown as Record<string, unknown>)[key] = (this.data[key] as { id: string }[]).filter((r) => r.id !== id);
    this.ops.push(makeOp(key as EntityName, id, "delete", undefined, this.ctx.now));
  }
  done<T>(result: T): TxResult<T> {
    // Newest op per record wins; keep earlier ops for other records.
    return { data: { ...this.data, meta: { ...this.data.meta, queue: [...this.data.meta.queue, ...this.ops] } }, ops: this.ops, result };
  }
}
export const NOOP = <T>(data: AppData, result: T): TxResult<T> => ({ data, ops: [], result });
