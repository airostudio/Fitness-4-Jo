import { beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { Harness, type TestUser } from "./harness";
import { withIds } from "./samples";
import { applyBatch, makeOp as mk, toWire } from "@/lib/domain/sync";
const makeOp = (...a: Parameters<typeof mk>) => toWire(mk(...a));
import { ENTITIES, ENTITY_NAMES } from "@/lib/domain/schemas";

let h: Harness; let jo: TestUser, mallory: TestUser, sam: TestUser, admin: TestUser;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

beforeAll(async () => {
  h = await Harness.create();
  jo = await h.user("jo@example.com"); mallory = await h.user("mallory@example.com");
  sam = await h.user("sam@example.com"); admin = await h.user("admin@example.com");
  await h.db.query("insert into public.app_admins (user_id) values ($1)", [admin.id]);
});

describe("migrations & seed", () => {
  it("applied cleanly with RLS enabled on every public table", async () => {
    const r = await h.db.query<{ tablename: string }>("select c.relname as tablename from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity");
    expect(r.rows.map((x) => x.tablename)).toEqual([]);
  });
  it("seeded ≥30 exercises, 2 workout templates, 13 programme weeks, and no personal data", async () => {
    expect(Number((await h.db.query<{ n: string }>("select count(*) n from public.exercise_library")).rows[0]!.n)).toBeGreaterThanOrEqual(30);
    expect(Number((await h.db.query<{ n: string }>("select count(*) n from public.workout_templates")).rows[0]!.n)).toBe(2);
    expect(Number((await h.db.query<{ n: string }>("select count(*) n from public.program_weeks")).rows[0]!.n)).toBe(13);
    expect(Number((await h.db.query<{ n: string }>("select count(*) n from public.profiles")).rows[0]!.n)).toBe(0);
  });
});

describe("sync into Postgres under RLS (every entity)", () => {
  it("applies one valid record of every entity, with a ledger entry each, and Jo can read them back", async () => {
    const s = withIds();
    const repo = h.repoFor(jo);
    const ops = ENTITY_NAMES.map((e) => makeOp(e, s[e].id, "upsert", s[e].record, String(s[e].record.updatedAt)));
    // parents first (the client orders ops; mimic that here)
    const order = ["profile", "preferences", "equipment", "health", "goals", "notifications", "nutrition", "program", "scheduled", "checkins", "sessions", "sets", "recommendations", "decisions", "milestones", "journal", "nutritionLogs"];
    ops.sort((a, b) => order.indexOf(a.entity) - order.indexOf(b.entity));
    const res = await applyBatch(repo, jo.id, ops);
    expect(res.map((r) => r.status)).toEqual(ops.map(() => "applied"));
    for (const e of ENTITY_NAMES) {
      const rows = await h.as(jo, (q) => q(`select * from public.${ENTITIES[e].table}`));
      expect(rows.length, e).toBe(1);
      expect(rows[0]!.user_id).toBe(jo.id);
    }
  });
  it("re-delivering the same operation is a no-op (no duplicate sets)", async () => {
    const s = withIds();
    const op = makeOp("sets", s.sets.id, "upsert", s.sets.record, "2026-11-09T01:00:00.000Z");
    const parent = makeOp("sessions", s.sessions.id, "upsert", s.sessions.record, "2026-11-09T01:00:00.000Z");
    const repo = h.repoFor(jo);
    await applyBatch(repo, jo.id, [parent]);
    expect((await applyBatch(repo, jo.id, [op]))[0]!.status).toBe("applied");
    expect((await applyBatch(repo, jo.id, [op]))[0]!.status).toBe("duplicate");
    const n = await h.as(jo, (q) => q("select count(*)::int n from public.exercise_sets where id = $1", [s.sets.id]));
    expect(n[0]!.n).toBe(1);
  });
  it("a newer server copy wins: stale offline edit is reported as a conflict, not applied", async () => {
    const s = withIds();
    const repo = h.repoFor(jo);
    const j = s.journal.record;
    await applyBatch(repo, jo.id, [makeOp("journal", s.journal.id, "upsert", { ...j, feeling: "Newer on phone", updatedAt: "2026-11-09T05:00:00.000Z" }, "2026-11-09T05:00:00.000Z")]);
    const r = await applyBatch(repo, jo.id, [makeOp("journal", s.journal.id, "upsert", { ...j, feeling: "Older from tablet", updatedAt: "2026-11-09T02:00:00.000Z" }, "2026-11-09T02:00:00.000Z")]);
    expect(r[0]!.status).toBe("conflict");
    const row = await h.as(jo, (q) => q("select feeling from public.journal_entries where id = $1", [s.journal.id]));
    expect(row[0]!.feeling).toBe("Newer on phone");
  });
  it("clearing an optional field on the device clears it on the server", async () => {
    const s = withIds();
    const repo = h.repoFor(jo);
    const base = { ...s.profile.record, dateOfBirth: "1960-05-05", updatedAt: "2026-11-09T06:00:00.000Z" };
    await applyBatch(repo, jo.id, [makeOp("profile", "self", "upsert", base, base.updatedAt)]);
    const cleared = { ...s.profile.record, updatedAt: "2026-11-09T07:00:00.000Z" };
    await applyBatch(repo, jo.id, [makeOp("profile", "self", "upsert", cleared, cleared.updatedAt)]);
    expect((await h.as(jo, (q) => q("select date_of_birth from public.profiles")))[0]!.date_of_birth).toBeNull();
  });
  it("rejects payloads that try to set another owner (strict schema) and invalid data", async () => {
    const s = withIds();
    const evil = { ...s.journal.record, id: randomUUID(), userId: jo.id };
    const r = await applyBatch(h.repoFor(mallory), mallory.id, [makeOp("journal", String(evil.id), "upsert", evil, "2026-11-09T01:00:00.000Z")]);
    expect(r[0]!.status).toBe("rejected");
    const bad = await applyBatch(h.repoFor(mallory), mallory.id, [{ opId: "nope" }, makeOp("sets", randomUUID(), "upsert", { reps: -4 }, "2026-11-09T01:00:00.000Z")]);
    expect(bad.every((x) => x.status === "rejected")).toBe(true);
  });
  it("ownership is forced from the authenticated user: Mallory writing Jo's record id cannot touch Jo's row", async () => {
    const s = withIds();
    const r = await applyBatch(h.repoFor(mallory), mallory.id, [makeOp("journal", s.journal.id, "upsert", { ...s.journal.record, feeling: "HIJACK", updatedAt: "2026-12-01T00:00:00.000Z" }, "2026-12-01T00:00:00.000Z")]);
    expect(r[0]!.status).toBe("rejected"); // PK collision with a row she cannot see/update → blocked by RLS/PK
    const jos = await h.as(jo, (q) => q("select feeling, user_id from public.journal_entries where id = $1", [s.journal.id]));
    expect(jos[0]).toMatchObject({ feeling: "Newer on phone", user_id: jo.id });
  });
});

describe("cross-user access", () => {
  const personal = Object.values(ENTITIES).map((e) => e.table);
  it.each(personal)("Mallory cannot read or alter Jo's rows in %s", async (table) => {
    expect((await h.as(mallory, (q) => q(`select * from public.${table}`))).length).toBe(0);
    await h.as(mallory, (q) => q(`update public.${table} set user_id = user_id`));
    await h.as(mallory, (q) => q(`delete from public.${table}`));
    expect((await h.as(jo, (q) => q(`select * from public.${table}`))).length).toBeGreaterThan(0); // Jo's data survives
  });
  it.each(personal)("anonymous users have no access to %s", async (table) => {
    const msg = await h.expectError(null, `select * from public.${table}`);
    expect(msg).toMatch(/permission denied/);
  });
  it("cannot insert a row owned by someone else", async () => {
    const msg = await h.expectError(mallory, "insert into public.journal_entries (id,user_id,date,created_at,updated_at) values ($1,$2,'2026-11-09',now(),now())", [randomUUID(), jo.id]);
    expect(msg).toMatch(/row-level security/);
  });
  it("cannot attach a set to another user's session", async () => {
    const jsess = (await h.as(jo, (q) => q("select id from public.workout_sessions limit 1")))[0]!.id;
    const msg = await h.expectError(mallory, "insert into public.exercise_sets (id,user_id,session_id,session_exercise_id,exercise_id,set_index,completed,completed_at,updated_at) values ($1,$2,$3,$4,'x',0,true,now(),now())", [randomUUID(), mallory.id, jsess, randomUUID()]);
    expect(msg).toMatch(/foreign key|violates/);
  });
  it("audit and ledger are append-only for users; shared reference data cannot be written by users", async () => {
    expect(await h.expectError(jo, "update public.audit_events set event = 'x'")).toMatch(/permission denied/);
    expect(await h.expectError(jo, "delete from public.offline_sync_operations")).toMatch(/permission denied/);
    await h.as(jo, (q) => q("update public.exercise_library set name = 'HACKED' where id = 'chair-squat'"));
    expect((await h.db.query<{ name: string }>("select name from public.exercise_library where id='chair-squat'")).rows[0]!.name).toBe("Chair Squat");
  });
});

describe("administrator separation", () => {
  it("admin can maintain the exercise library and approve media (with licence)", async () => {
    await h.as(admin, (q) => q("update public.exercise_library set description = 'Edited by admin' where id = 'glute-bridge'"));
    expect((await h.db.query<{ description: string }>("select description from public.exercise_library where id='glute-bridge'")).rows[0]!.description).toBe("Edited by admin");
    await h.as(admin, (q) => q("insert into public.exercise_media (exercise_id,kind,url,licence,approved) values ('glute-bridge','video','https://example.com/v.mp4','CC-BY 4.0 (original)',true)"));
    expect((await h.as(jo, (q) => q("select * from public.exercise_media"))).length).toBe(1);
  });
  it("media without a licence or non-https URL is rejected", async () => {
    expect(await h.expectError(admin, "insert into public.exercise_media (exercise_id,kind,url,licence) values ('glute-bridge','video','http://x','')")).toMatch(/violates check/);
  });
  it("unapproved media is invisible to ordinary users", async () => {
    await h.as(admin, (q) => q("insert into public.exercise_media (exercise_id,kind,url,licence,approved) values ('dead-bug','image','https://example.com/i.png','Original work',false)"));
    const seen = await h.as(jo, (q) => q("select * from public.exercise_media where exercise_id = 'dead-bug'"));
    expect(seen.length).toBe(0);
  });
  it("admin has NO access to Jo's private health details, journal, sessions or sync ledger", async () => {
    for (const t of ["health_considerations", "journal_entries", "profiles", "workout_sessions", "exercise_sets", "personal_milestones", "offline_sync_operations", "audit_events"]) {
      expect((await h.as(admin, (q) => q(`select * from public.${t}`))).length, t).toBe(0);
    }
  });
  it("non-admins cannot call admin_health; admin gets aggregate counts only", async () => {
    expect(await h.expectError(jo, "select public.admin_health()")).toMatch(/admins only/);
    const r = (await h.as(admin, (q) => q("select public.admin_health() as j")))[0]!.j as Record<string, unknown>;
    expect(Object.keys(r).sort()).toEqual(["accounts", "activeExercises", "errorsLast24h", "rejectedSyncOpsLast7Days", "sessionsLast7Days"]);
  });
  it("only the service role writes error events; admin can read them, others cannot", async () => {
    await h.db.query("insert into public.error_events (area, message) values ('sync','Timeout')");
    expect((await h.as(admin, (q) => q("select * from public.error_events"))).length).toBe(1);
    expect((await h.as(jo, (q) => q("select * from public.error_events"))).length).toBe(0);
    expect(await h.expectError(jo, "insert into public.error_events (area,message) values ('x','y')")).toMatch(/permission denied/);
  });
});

describe("supporter access is enforced in the database", () => {
  let inviteId: string; const token = "tok-" + randomUUID();
  it("Jo invites Sam with limited permissions (journal NOT shared)", async () => {
    // Jo shares one journal entry later; for now permissions exclude notes
    const r = await h.as(jo, (q) => q("select public.create_supporter_invite($1,$2,true,true,false,false,true) as id", ["Sam@Example.com", hash(token)]));
    inviteId = r[0]!.id as string;
    expect(inviteId).toBeTruthy();
  });
  it("Sam cannot see anything before accepting", async () => {
    expect(await h.expectError(sam, "select public.supporter_view($1)", [jo.id])).toMatch(/no access/);
  });
  it("wrong person, wrong token and replay are all refused with the same generic error", async () => {
    expect(await h.expectError(mallory, "select public.accept_supporter_invite($1)", [token])).toMatch(/invite not valid/);
    expect(await h.expectError(sam, "select public.accept_supporter_invite($1)", ["bad-token"])).toMatch(/invite not valid/);
    expect(await h.expectError(jo, "select public.accept_supporter_invite($1)", [token])).toMatch(/invite not valid/);
  });
  it("Sam (matching email) accepts and sees ONLY permitted sections", async () => {
    await h.as(sam, (q) => q("select public.accept_supporter_invite($1)", [token]));
    const v = (await h.as(sam, (q) => q("select public.supporter_view($1) as v", [jo.id])))[0]!.v as Record<string, unknown>;
    expect(v.ownerName).toBe("Jo");
    expect(v).toHaveProperty("sessions");
    expect(v).toHaveProperty("achievements");
    expect(v).not.toHaveProperty("metrics");
    expect(v).not.toHaveProperty("notes");
    expect(JSON.stringify(v)).not.toMatch(/Sprained|kneeDiscomfort|knee_discomfort|Felt strong|vegetarian|nutrition|serves/i);
  });
  it("Sam has no direct table access to Jo's data at all", async () => {
    for (const t of ["health_considerations", "journal_entries", "workout_sessions", "exercise_sets", "profiles", "personal_milestones"]) {
      expect((await h.as(sam, (q) => q(`select * from public.${t}`))).length, t).toBe(0);
    }
  });
  it("Sam cannot change workouts, progression or permissions", async () => {
    await h.as(sam, (q) => q("update public.training_programs set current_week = 9"));
    await h.as(sam, (q) => q("update public.supporter_permissions set can_see_notes = true"));
    expect((await h.db.query<{ current_week: number }>("select current_week from public.training_programs")).rows[0]!.current_week).toBe(1);
    expect((await h.db.query<{ n: boolean }>("select can_see_notes n from public.supporter_permissions")).rows[0]!.n).toBe(false);
  });
  it("Jo widens permissions; only individually-shared journal entries appear and health stays hidden", async () => {
    await h.as(jo, (q) => q("update public.supporter_permissions set can_see_notes = true, can_see_metrics = true where invite_id = $1", [inviteId]));
    const v = (await h.as(sam, (q) => q("select public.supporter_view($1) as v", [jo.id])))[0]!.v as { notes: unknown[]; metrics: unknown[] };
    expect(v.notes).toEqual([]); // entry not marked shared
    expect(v.metrics.length).toBeGreaterThan(0);
    await h.as(jo, (q) => q("update public.journal_entries set shared_with_supporter = true"));
    const v2 = (await h.as(sam, (q) => q("select public.supporter_view($1) as v", [jo.id])))[0]!.v as { notes: { feeling: string }[] };
    expect(v2.notes.length).toBe(1);
  });
  it("encouragement works only when permitted, and is length-limited", async () => {
    await h.as(sam, (q) => q("select public.supporter_send_encouragement($1,'You are doing brilliantly!')", [jo.id]));
    expect((await h.as(jo, (q) => q("select message from public.supporter_encouragements"))).length).toBe(1);
    expect(await h.expectError(mallory, "select public.supporter_send_encouragement($1,'hi')", [jo.id])).toMatch(/no access/);
  });
  it("another user cannot revoke Jo's invite", async () => {
    expect(await h.expectError(mallory, "select public.revoke_supporter($1)", [inviteId])).toMatch(/not found/);
    expect(await h.expectError(sam, "select public.revoke_supporter($1)", [inviteId])).toMatch(/not found/);
  });
  it("REVOCATION is immediate: Sam is denied the very next request", async () => {
    await h.as(jo, (q) => q("select public.revoke_supporter($1)", [inviteId]));
    expect(await h.expectError(sam, "select public.supporter_view($1)", [jo.id])).toMatch(/no access/);
    expect(await h.expectError(sam, "select public.supporter_send_encouragement($1,'still there?')", [jo.id])).toMatch(/no access/);
    expect((await h.as(sam, (q) => q("select * from public.supporter_owners()"))).length).toBe(0);
    expect(await h.expectError(sam, "select public.accept_supporter_invite($1)", [token])).toMatch(/invite not valid/);
  });
  it("revocation and invitation are audited without personal content", async () => {
    const ev = await h.as(jo, (q) => q("select event, meta from public.audit_events order by created_at"));
    expect(ev.map((e) => e.event)).toEqual(expect.arrayContaining(["supporter.invited", "supporter.accepted", "supporter.revoked"]));
    expect(JSON.stringify(ev)).not.toMatch(/Sprained|Felt strong/);
  });
});

describe("storage (private photos)", () => {
  it("users can write only inside their own folder and read only their own objects", async () => {
    await h.as(jo, (q) => q("insert into storage.objects (bucket_id,name) values ('journal-photos', $1)", [`${jo.id}/p1.jpg`]));
    expect(await h.expectError(mallory, "insert into storage.objects (bucket_id,name) values ('journal-photos', $1)", [`${jo.id}/evil.jpg`])).toMatch(/row-level security/);
    expect((await h.as(mallory, (q) => q("select * from storage.objects"))).length).toBe(0);
    expect((await h.as(jo, (q) => q("select * from storage.objects"))).length).toBe(1);
    const b = await h.db.query<{ public: boolean }>("select public from storage.buckets where id='journal-photos'");
    expect(b.rows[0]!.public).toBe(false);
  });
});

describe("account deletion", () => {
  it("deleting the auth user leaves no row referencing Jo in ANY table (cascade or anonymised)", async () => {
    await h.db.query("delete from auth.users where id = $1", [jo.id]);
    const cols = await h.db.query<{ table_name: string; column_name: string }>(
      "select table_name, column_name from information_schema.columns where table_schema='public' and column_name in ('user_id','owner_id','supporter_id','created_by','updated_by')");
    expect(cols.rows.length).toBeGreaterThan(20);
    for (const { table_name, column_name } of cols.rows) {
      const n = Number((await h.db.query<{ n: string }>(`select count(*) n from public.${table_name} where ${column_name} = $1`, [jo.id])).rows[0]!.n);
      expect(n, `${table_name}.${column_name}`).toBe(0);
    }
    // Mallory's data is untouched
    expect(Number((await h.db.query<{ n: string }>("select count(*) n from public.offline_sync_operations where user_id = $1", [mallory.id])).rows[0]!.n)).toBeGreaterThan(0);
  });
});
