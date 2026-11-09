// Runs the REAL migrations in an in-process Postgres (PGlite) with Supabase-compatible stubs for
// auth.uid()/auth.jwt()/roles/storage, so Row Level Security can be verified without Docker or a cloud project.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { SyncRepo } from "@/lib/domain/sync";
import type { SyncOp } from "@/lib/domain/schemas";

const STUBS = `
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
alter table storage.objects enable row level security;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
`;

export interface TestUser { id: string; email: string; }
export class Harness {
  db!: PGlite;
  static async create(): Promise<Harness> {
    const h = new Harness();
    h.db = new PGlite();
    await h.db.exec(STUBS);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
      try { await h.db.exec(readFileSync(path.join(dir, f), "utf8")); }
      catch (e) { throw new Error(`Migration ${f} failed: ${(e as Error).message}`); }
    }
    // Supabase grants these by default on the schema; tests mimic the platform.
    await h.db.exec("grant usage on schema public to anon, authenticated, service_role; grant all on all tables in schema public to service_role;");
    return h;
  }
  async user(email: string): Promise<TestUser> {
    const id = randomUUID();
    await this.db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
    return { id, email };
  }
  /** Run SQL as an authenticated user (RLS applies). */
  async as<T>(u: TestUser | null, fn: (q: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.exec(`set local role ${u ? "authenticated" : "anon"}`);
      await tx.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)",
        [u ? JSON.stringify({ sub: u.id, email: u.email, role: "authenticated" }) : "{}", u?.id ?? ""]);
      return fn(async (sql, params) => (await tx.query(sql, params as never[])).rows as Record<string, unknown>[]);
    });
  }
  /** Run as authenticated user and expect an error (e.g. RLS violation). Returns message. */
  async expectError(u: TestUser | null, sql: string, params: unknown[] = []): Promise<string> {
    try { await this.as(u, (q) => q(sql, params)); } catch (e) { return (e as Error).message; }
    return "";
  }
  /** SyncRepo executing under the user's JWT, exactly like the Supabase client in the API route would. */
  repoFor(u: TestUser): SyncRepo {
    return {
      seen: (_uid, opId) => this.as(u, async (q) => (await q("select 1 from public.offline_sync_operations where op_id = $1", [opId])).length > 0),
      record: (uid, op: SyncOp, status) => this.as(u, async (q) => { await q("insert into public.offline_sync_operations (user_id, op_id, entity, record_id, status) values ($1,$2,$3,$4,$5) on conflict do nothing", [uid, op.opId, op.entity, op.id, status]); }),
      currentUpdatedAt: (table, uid, id, single) => this.as(u, async (q) => {
        const r = await q(`select updated_at from public.${table} where ${single ? "user_id" : "id"} = $1`, [single ? uid : id]);
        return r[0] ? new Date(r[0].updated_at as string).toISOString() : null;
      }),
      upsert: (table, row) => this.as(u, async (q) => {
        const cols = Object.keys(row);
        const pk = table === "training_programs" || ["scheduled_workouts", "workout_sessions", "exercise_sets", "readiness_checkins", "progression_recommendations", "progression_decisions", "personal_milestones", "journal_entries"].includes(table) ? "id" : "user_id";
        await q(`insert into public.${table} (${cols.join(",")}) select ${cols.join(",")} from jsonb_populate_record(null::public.${table}, $1::jsonb)
          on conflict (${pk}) do update set ${cols.filter((c) => c !== pk && c !== "user_id").map((c) => `${c} = excluded.${c}`).join(",")}`, [JSON.stringify(row)]);
      }),
      remove: (table, uid, id, single) => this.as(u, async (q) => { await q(`delete from public.${table} where ${single ? "user_id" : "id"} = $1`, [single ? uid : id]); }),
    };
  }
}
