import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncRepo } from "@/lib/domain/sync";

/** SyncRepo backed by a USER-scoped client: Postgres RLS is the last line of defence for every write. */
export function supabaseRepo(sb: SupabaseClient): SyncRepo {
  return {
    async seen(_userId, opId) {
      const { data, error } = await sb.from("offline_sync_operations").select("op_id").eq("op_id", opId).in("status", ["applied", "conflict"]).maybeSingle();
      if (error) throw error;
      return !!data;
    },
    async record(userId, op, status) {
      const { error } = await sb.from("offline_sync_operations").upsert({ user_id: userId, op_id: op.opId, entity: op.entity, record_id: op.id, status }, { onConflict: "user_id,op_id" });
      if (error) throw error;
    },
    async currentUpdatedAt(table, userId, id, single) {
      const q = sb.from(table).select("updated_at");
      const { data, error } = await (single ? q.eq("user_id", userId) : q.eq("id", id)).maybeSingle();
      if (error) throw error;
      return data ? new Date(String((data as { updated_at: string }).updated_at)).toISOString() : null;
    },
    async upsert(table, row) {
      const { error } = await sb.from(table).upsert(row, { onConflict: "user_id" in row && !("id" in row) ? "user_id" : "id" });
      if (error) throw error;
    },
    async remove(table, userId, id, single) {
      const q = sb.from(table).delete();
      const { error } = await (single ? q.eq("user_id", userId) : q.eq("id", id));
      if (error) throw error;
    },
  };
}
