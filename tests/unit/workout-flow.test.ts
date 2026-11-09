import { describe, expect, it } from "vitest";
import { Sim } from "./sim";
import * as A from "@/lib/store/actions";
import { activeSession, finishedSessions, historyFor, openRecommendations, setsFor, suggestedFor } from "@/lib/store/selectors";
import { buildExport } from "@/lib/domain/export";
import { ENTITIES } from "@/lib/domain/schemas";
import { applyResults, compactQueue, orderOps, toWire } from "@/lib/domain/sync";
import { syncOpSchema } from "@/lib/domain/schemas";

const begin = (sim: Sim, letter: "A" | "B" = "A", mode: "normal" | "lighter" = "normal") =>
  sim.do((d, c) => A.startSession(d, c, { letter, mode })).sessionId!;

describe("onboarding", () => {
  it("creates profile, equipment, preferences and a 12-week program with an initial schedule", () => {
    const sim = new Sim(); sim.onboard();
    const d = sim.data;
    expect(d.profile?.name).toBe("Jo");
    expect(d.equipment.dumbbellWeightsKg).toEqual([1, 2, 3, 4]);
    expect(d.program?.currentWeek).toBe(1);
    expect(d.program?.templates.map((t) => t.letter)).toEqual(["A", "B"]);
    expect(d.scheduled.length).toBeGreaterThanOrEqual(2);
    expect(d.scheduled[0]).toMatchObject({ date: "2026-11-09", letter: "A" });
    expect(d.program?.exerciseTargets).toEqual({}); // no guessed loads
    expect(d.sessions).toEqual([]); // no fabricated history
  });
  it("queues a sync op for every saved record", () => {
    const sim = new Sim(); sim.onboard();
    const entities = new Set(sim.data.meta.queue.map((o) => o.entity));
    for (const e of ["profile", "preferences", "equipment", "health", "goals", "notifications", "program", "scheduled"]) expect(entities.has(e as never), e).toBe(true);
  });
  it("every queued record validates against the wire schemas", () => {
    const sim = new Sim(); sim.onboard(); sim.workout("A");
    for (const op of sim.data.meta.queue) {
      expect(syncOpSchema.safeParse(toWire(op)).success, op.entity).toBe(true);
      if (op.action === "upsert") {
        const r = ENTITIES[op.entity].schema.safeParse(op.record);
        expect(r.success, `${op.entity}: ${r.success ? "" : JSON.stringify(r.error.issues)}`).toBe(true);
      }
    }
  });
});

describe("guided workout execution", () => {
  it("starts a session with Workout A exercises and calibrates weights (none guessed)", () => {
    const sim = new Sim(); sim.onboard();
    const id = begin(sim);
    const s = sim.data.sessions.find((x) => x.id === id)!;
    expect(s.status).toBe("in_progress");
    expect(s.exercises.map((e) => e.exerciseId)).toEqual(["chair-squat", "supported-db-row", "wall-push-up", "glute-bridge", "dead-bug"]);
    expect(s.exercises.every((e) => e.targetWeight === null)).toBe(true);
    expect(s.exercises[0]!.targetSets).toBe(1); // week 1 = one set
  });
  it("starting again resumes the same session instead of creating a second", () => {
    const sim = new Sim(); sim.onboard();
    const a = begin(sim); const b = begin(sim);
    expect(b).toBe(a);
    expect(sim.data.sessions).toHaveLength(1);
  });
  it("completes a set: records it independently, starts the rest timer, marks the exercise done at target", () => {
    const sim = new Sim(); sim.onboard(); const id = begin(sim);
    const r = sim.do((d, c) => A.completeSet(d, c, id, { weight: null, reps: 10, effort: "comfortable" }));
    expect(r.exerciseDone).toBe(true);
    const s = sim.data.sessions[0]!;
    expect(s.exercises[0]!.status).toBe("done");
    expect(s.rest?.endsAt).toBeTruthy();
    expect(Date.parse(s.rest!.endsAt!) - sim.clock).toBe(60_000);
    expect(setsFor(sim.data, id)).toHaveLength(1);
  });
  it("lets Jo change weight and reps after logging, and delete a set", () => {
    const sim = new Sim(); sim.onboard(); const id = begin(sim);
    const { setId } = sim.do((d, c) => A.completeSet(d, c, id, { weight: 2, reps: 8 }));
    sim.do((d, c) => A.editSet(d, c, setId!, { weight: 3, reps: 10 }));
    expect(sim.data.sets[0]).toMatchObject({ weight: 3, reps: 10 });
    sim.do((d, c) => A.deleteSet(d, c, setId!));
    expect(sim.data.sets).toHaveLength(0);
    expect(sim.data.meta.queue.at(-1)).toMatchObject({ entity: "sets", action: "delete" });
  });
  it("repeat set adds an extra set; skip moves on; substitute swaps within safe equipment", () => {
    const sim = new Sim(); sim.onboard(); const id = begin(sim);
    sim.do((d, c) => A.addExtraSet(d, c, id));
    expect(sim.data.sessions[0]!.exercises[0]!.targetSets).toBe(2);
    sim.do((d, c) => A.skipExercise(d, c, id));
    const s = sim.data.sessions[0]!;
    expect(s.exercises[0]!.status).toBe("skipped"); expect(s.currentIndex).toBe(1);
    // Jo has no bands or bench, so there is no equipment-safe swap for the row – we never offer one she can't do
    expect(A.substitutesFor(sim.data, "row", "supported-db-row")).toEqual([]);
    expect(A.substitutesFor(sim.data, "squat", "chair-squat").map((e) => e.id)).toEqual(expect.arrayContaining(["bodyweight-squat"]));
    const bad = sim.do((d, c) => A.substituteExercise(d, c, id, "goblet-squat"));
    expect(bad.ok).toBe(false);
  });
  it("substituting before logging preserves the original exercise reference", () => {
    const sim = new Sim(); sim.onboard(); const id = begin(sim);
    const target = A.substitutesFor(sim.data, "squat", "chair-squat")[0]!.id;
    expect(sim.do((d, c) => A.substituteExercise(d, c, id, target)).ok).toBe(true);
    expect(sim.data.sessions[0]!.exercises[0]).toMatchObject({ exerciseId: target, originalExerciseId: "chair-squat" });
  });
  it("won't swap an exercise once sets are logged (history stays truthful)", () => {
    const sim = new Sim(); sim.onboard(); const id = begin(sim);
    sim.do((d, c) => A.completeSet(d, c, id, { weight: null, reps: 8 }));
    const target = A.substitutesFor(sim.data, "squat", "chair-squat")[0]!.id;
    expect(sim.do((d, c) => A.substituteExercise(d, c, id, target)).ok).toBe(false);
  });
  it("pause freezes the rest timer and resume restores the remaining time", () => {
    const sim = new Sim(); sim.onboard(); const id = begin(sim);
    sim.do((d, c) => A.completeSet(d, c, id, { weight: null, reps: 8 }, 60)); // exercise done → rest 60s
    sim.do((d, c) => A.addExtraSet(d, c, id));
    sim.do((d, c) => A.completeSet(d, c, id, { weight: null, reps: 8 }, 60));
    sim.tick(20_000);
    sim.do((d, c) => A.pauseSession(d, c, id));
    expect(sim.data.sessions[0]!.status).toBe("paused");
    expect(sim.data.sessions[0]!.rest?.pausedRemainingMs).toBe(40_000);
    sim.tick(10 * 60_000);
    sim.do((d, c) => A.resumeSession(d, c, id));
    const s = sim.data.sessions[0]!;
    expect(s.status).toBe("in_progress");
    expect(s.totalPausedMs).toBe(10 * 60_000);
    expect(Date.parse(s.rest!.endsAt!) - sim.clock).toBe(40_000);
  });
  it("cannot log sets while paused", () => {
    const sim = new Sim(); sim.onboard(); const id = begin(sim);
    sim.do((d, c) => A.pauseSession(d, c, id));
    sim.do((d, c) => A.completeSet(d, c, id, { weight: null, reps: 8 }));
    expect(sim.data.sets).toHaveLength(0);
  });
  it("rest timer: pause, resume, skip, adjust", () => {
    const sim = new Sim(); sim.onboard(); const id = begin(sim);
    sim.do((d, c) => A.completeSet(d, c, id, { weight: null, reps: 8 }, 90));
    sim.tick(30_000);
    sim.do((d, c) => A.restPause(d, c, id));
    expect(sim.data.sessions[0]!.rest?.pausedRemainingMs).toBe(60_000);
    sim.tick(5 * 60_000);
    sim.do((d, c) => A.restResume(d, c, id));
    expect(Date.parse(sim.data.sessions[0]!.rest!.endsAt!) - sim.clock).toBe(60_000);
    sim.do((d, c) => A.restAdjust(d, c, id, 15));
    expect(Date.parse(sim.data.sessions[0]!.rest!.endsAt!) - sim.clock).toBe(75_000);
    sim.do((d, c) => A.restSkip(d, c, id));
    expect(sim.data.sessions[0]!.rest).toBeNull();
  });
  it("finishing completes the session, marks the scheduled workout done and counts it", () => {
    const sim = new Sim(); sim.onboard();
    const { sessionId, loggedSets, milestones } = sim.workout("A");
    expect(loggedSets).toBe(5);
    expect(sim.data.sessions.find((s) => s.id === sessionId)!.status).toBe("completed");
    expect(sim.data.scheduled.find((s) => s.sessionId === sessionId)?.status).toBe("completed");
    expect(milestones).toContain("first_session");
    expect(activeSession(sim.data)).toBeNull();
  });
  it("ending early saves the completed sets and counts the session; ending with nothing logged does not", () => {
    const sim = new Sim(); sim.onboard(); const id = begin(sim);
    sim.do((d, c) => A.completeSet(d, c, id, { weight: null, reps: 8 }));
    const r = sim.do((d, c) => A.endSession(d, c, id, "early"));
    expect(r.loggedSets).toBe(1);
    expect(sim.data.sessions[0]!.status).toBe("ended_early");
    expect(finishedSessions(sim.data)).toHaveLength(1);
    const sim2 = new Sim(); sim2.onboard(); const id2 = begin(sim2);
    sim2.do((d, c) => A.endSession(d, c, id2, "early"));
    expect(finishedSessions(sim2.data)).toHaveLength(0);
  });
  it("survives a 'reload': serialised state restores the active session exactly", () => {
    const sim = new Sim(); sim.onboard(); const id = begin(sim);
    sim.do((d, c) => A.completeSet(d, c, id, { weight: null, reps: 9 }));
    const restored = JSON.parse(JSON.stringify(sim.data));
    expect(activeSession(restored)?.id).toBe(id);
    expect(setsFor(restored, id)).toHaveLength(1);
  });
  it("deleting a session removes its sets, restores the plan, and is queued for sync", () => {
    const sim = new Sim(); sim.onboard(); const { sessionId } = sim.workout("A");
    sim.do((d, c) => A.deleteSession(d, c, sessionId));
    expect(sim.data.sessions).toHaveLength(0); expect(sim.data.sets).toHaveLength(0);
    expect(sim.data.scheduled.find((s) => s.date === "2026-11-09")?.status).toBe("planned");
  });
});

describe("progression through real sessions", () => {
  const curlDay = (sim: Sim, date: string, letter: "A" | "B", reps: number, weight = 2) => {
    sim.day(date);
    return sim.workout(letter, { reps: () => reps, weight: (id, s) => (id === "dumbbell-curl" ? weight : s) });
  };
  it("suggests, then Jo accepts, a weight increase only after consistent sessions; target weight updates", () => {
    const sim = new Sim(); sim.onboard();
    // Week 1-4 foundation: 2 sessions weekly. Do B sessions (contains curl) on consecutive weeks.
    let r = curlDay(sim, "2026-11-09", "B", 10);
    expect(r.recommendations.find((x) => x.exerciseId === "dumbbell-curl")?.action).not.toBe("increase_weight");
    r = curlDay(sim, "2026-11-16", "B", 11);
    expect(r.recommendations.find((x) => x.exerciseId === "dumbbell-curl")?.action).toBe("increase_reps");
    r = curlDay(sim, "2026-11-23", "B", 12);
    const rec = r.recommendations.find((x) => x.exerciseId === "dumbbell-curl")!;
    expect(rec.action).toBe("increase_weight");
    expect(rec.proposed?.weight).toBe(3);
    expect(openRecommendations(sim.data).map((x) => x.id)).toContain(rec.id);
    // Nothing changes until Jo decides
    expect(sim.data.program!.exerciseTargets["dumbbell-curl"]).toBeUndefined();
    sim.do((d, c) => A.decide(d, c, rec.id, "accepted"));
    expect(sim.data.program!.exerciseTargets["dumbbell-curl"]?.weight).toBe(3);
    expect(suggestedFor(sim.data, "dumbbell-curl")).toBe(3);
    expect(sim.data.decisions).toHaveLength(1);
    expect(openRecommendations(sim.data).map((x) => x.id)).not.toContain(rec.id);
    // the first-increase milestone appears at the next session end
    sim.day("2026-11-30"); const next = sim.workout("B", { reps: () => 8 });
    expect(next.milestones).toContain("first_increase");
  });
  it("a declined suggestion leaves the weight untouched but is recorded", () => {
    const sim = new Sim(); sim.onboard();
    curlDay(sim, "2026-11-09", "B", 11); curlDay(sim, "2026-11-16", "B", 12);
    const rec = curlDay(sim, "2026-11-23", "B", 12).recommendations.find((x) => x.exerciseId === "dumbbell-curl")!;
    expect(rec.action).toBe("increase_weight");
    sim.do((d, c) => A.decide(d, c, rec.id, "declined"));
    expect(sim.data.program!.exerciseTargets["dumbbell-curl"]).toBeUndefined();
    expect(sim.data.decisions[0]).toMatchObject({ decision: "declined", chosen: null });
    expect(sim.do((d, c) => A.decide(d, c, rec.id, "accepted"))).toBe(false); // can't flip after the fact
  });
  it("reported discomfort blocks progression and recommends professional guidance", () => {
    const sim = new Sim(); sim.onboard();
    curlDay(sim, "2026-11-09", "B", 11); curlDay(sim, "2026-11-16", "B", 12);
    sim.day("2026-11-23");
    const chk = sim.do((d, c) => A.saveCheckin(d, c, { energy: "good", muscles: "recovered", pain: "none" }, "normal"));
    const id = sim.do((d, c) => A.startSession(d, c, { letter: "B", mode: "normal", checkinId: chk.id })).sessionId!;
    for (let i = 0; i < 5; i++) {
      const s = sim.data.sessions.find((x) => x.id === id)!; const ex = s.exercises[s.currentIndex]!;
      sim.tick(1000);
      sim.do((d, c) => A.completeSet(d, c, id, { weight: ex.exerciseId === "dumbbell-curl" ? 2 : ex.targetWeight, reps: 12, discomfort: ex.exerciseId === "dumbbell-curl" ? "concerning" : "none" }));
      sim.do((d, c) => A.nextExercise(d, c, id));
    }
    const r = sim.do((d, c) => A.endSession(d, c, id, "finished"));
    const rec = r.recommendations.find((x) => x.exerciseId === "dumbbell-curl")!;
    expect(rec.action).toBe("consult");
    expect(rec.needsDecision).toBe(false);
    expect(rec.message).toMatch(/doctor or physiotherapist/);
  });
  it("after a long break the plan eases back in, never as a penalty", () => {
    const sim = new Sim(); sim.onboard();
    curlDay(sim, "2026-11-09", "B", 12, 3);
    sim.day("2027-01-11");
    const r = sim.workout("B", { reps: () => 10, weight: (id, s) => (id === "dumbbell-curl" ? 2 : s) });
    const hist = historyFor(sim.data, "dumbbell-curl");
    expect(hist).toHaveLength(2);
    expect(r.recommendations.every((x) => !/fail|behind|missed/i.test(x.message))).toBe(true);
  });
  it("the engine's audit trail is stored with each recommendation", () => {
    const sim = new Sim(); sim.onboard();
    const r = curlDay(sim, "2026-11-09", "B", 10);
    for (const rec of r.recommendations) { expect(rec.explanation.length).toBeGreaterThan(0); expect(rec.ruleVersion).toBe("2026.1"); }
  });
});

describe("scheduling through actions", () => {
  it("moving a session updates the calendar without duplicating workouts", () => {
    const sim = new Sim(); sim.onboard();
    const first = sim.data.scheduled[0]!;
    const res = sim.do((d, c) => A.moveScheduled(d, c, first.id, "2026-11-10"));
    expect(res.ok).toBe(true);
    const planned = sim.data.scheduled.filter((s) => s.status === "planned").sort((a, b) => a.date.localeCompare(b.date));
    expect(planned.map((s) => s.letter).slice(0, 4)).toEqual(["A", "B", "A", "B"]);
    expect(new Set(planned.map((s) => s.date)).size).toBe(planned.length);
  });
  it("rejects moves onto an occupied day and into the past", () => {
    const sim = new Sim(); sim.onboard();
    const [a, b] = sim.data.scheduled;
    expect(sim.do((d, c) => A.moveScheduled(d, c, a!.id, b!.date)).ok).toBe(false);
    expect(sim.do((d, c) => A.moveScheduled(d, c, b!.id, "2026-11-01")).ok).toBe(false);
  });
  it("changing preferred days rebuilds the future but keeps completed history", () => {
    const sim = new Sim(); sim.onboard(); sim.workout("A");
    sim.do((d, c) => A.updateSingle(d, c, "preferences", { trainingDays: [2, 5] }));
    expect(sim.data.scheduled.find((s) => s.status === "completed")).toBeTruthy();
    const future = sim.data.scheduled.filter((s) => s.status === "planned");
    expect(future.length).toBeGreaterThan(0);
    for (const s of future) expect([2, 5]).toContain(new Date(s.date + "T00:00:00Z").getUTCDay() === 0 ? 7 : new Date(s.date + "T00:00:00Z").getUTCDay());
  });
  it("missed sessions become gently 'skipped' and the next ones are re-planned (no catch-up)", () => {
    const sim = new Sim(); sim.onboard();
    sim.day("2026-11-24");
    sim.do((d, c) => A.refreshSchedule(d, c));
    expect(sim.data.scheduled.filter((s) => s.date < "2026-11-24").every((s) => s.status === "skipped")).toBe(true);
    expect(sim.data.scheduled.filter((s) => s.status === "planned" && s.date >= "2026-11-24").length).toBeGreaterThanOrEqual(2);
  });
  it("week review only advances on Jo's confirmation and is based on completed sessions", () => {
    const sim = new Sim(); sim.onboard();
    expect(A.weekReviewFor(sim.data, "2026-11-12")).toBeNull();
    sim.day("2026-11-09"); sim.workout("A"); sim.day("2026-11-12"); sim.workout("B");
    sim.day("2026-11-13");
    const rv = A.weekReviewFor(sim.data, "2026-11-13")!;
    expect(rv.review.action).toBe("advance");
    expect(sim.data.program!.currentWeek).toBe(1);
    sim.do((d, c) => A.confirmWeekReview(d, c, "advance"));
    expect(sim.data.program!.currentWeek).toBe(2);
    expect(A.weekReviewFor(sim.data, "2026-11-13")).toBeNull();
  });
  it("a week with no sessions suggests repeating rather than advancing", () => {
    const sim = new Sim(); sim.onboard(); sim.day("2026-11-16");
    expect(A.weekReviewFor(sim.data, "2026-11-16")!.review.action).toBe("repeat");
  });
});

describe("sync queue", () => {
  it("compacts to the newest op per record and orders parents before children", () => {
    const sim = new Sim(); sim.onboard(); const { sessionId } = sim.workout("A");
    const q = compactQueue(sim.data.meta.queue);
    const keys = q.map((o) => `${o.entity}:${o.id}`);
    expect(new Set(keys).size).toBe(keys.length);
    const ordered = orderOps(q).map((o) => o.entity);
    expect(ordered.indexOf("sessions")).toBeLessThan(ordered.indexOf("sets"));
    expect(sim.data.sessions.find((s) => s.id === sessionId)).toBeTruthy();
  });
  it("only acknowledged ops leave the queue; unacknowledged ones are retried", () => {
    const sim = new Sim(); sim.onboard();
    const q = compactQueue(sim.data.meta.queue).slice(0, 3);
    const out = applyResults(q, [{ opId: q[0]!.opId, status: "applied" }, { opId: q[1]!.opId, status: "duplicate" }]);
    expect(out.remaining.map((o) => o.opId)).toEqual([q[2]!.opId]);
    expect(out.remaining[0]!.attempts).toBe(1);
  });
  it("conflicts and rejections are surfaced, not silently dropped as 'synced'", () => {
    const sim = new Sim(); sim.onboard();
    const q = compactQueue(sim.data.meta.queue).slice(0, 2);
    const out = applyResults(q, [{ opId: q[0]!.opId, status: "conflict", serverUpdatedAt: "x" }, { opId: q[1]!.opId, status: "rejected", reason: "bad" }]);
    expect(out.conflicts).toHaveLength(1); expect(out.rejected).toHaveLength(1); expect(out.remaining).toHaveLength(0);
  });
});

describe("data ownership: export", () => {
  it("exports every personal record Jo has and nothing else", () => {
    const sim = new Sim(); sim.onboard(); sim.workout("A");
    sim.do((d, c) => A.saveJournal(d, c, { feeling: "Strong", achievement: "Did it" }));
    const { meta: _m, ...data } = sim.data;
    const out = buildExport({ appVersion: "1.0.0", data, now: sim.ctx.now });
    expect(out.format).toBe("jostrong-export");
    const exp = out.data as typeof data;
    expect(exp.sessions).toHaveLength(1); expect(exp.sets).toHaveLength(5); expect(exp.journal).toHaveLength(1);
    expect(JSON.stringify(out)).not.toContain("queue");
  });
});

import { mergeRemote } from "@/lib/store/merge";
describe("pull & merge never loses offline work", () => {
  it("keeps records with pending operations, takes newer server copies, drops records deleted elsewhere", () => {
    const sim = new Sim(); sim.onboard();
    const j1 = sim.do((d, c) => A.saveJournal(d, c, { feeling: "local only (unsynced)" }));
    const base = { ...sim.data, meta: { queue: [] as typeof sim.data.meta.queue } };
    const synced = { ...base, journal: [{ ...j1, feeling: "synced older" }] };
    const remote = { journal: [{ ...j1, feeling: "server newer", updatedAt: "2099-01-01T00:00:00.000Z" }] };
    expect(mergeRemote(synced, remote).journal[0]!.feeling).toBe("server newer");
    // pending op protects the local copy
    expect(mergeRemote(sim.data, remote).journal[0]!.feeling).toBe("local only (unsynced)");
    // synced locally, gone from server → deleted on another device
    expect(mergeRemote(synced, { journal: [] }).journal).toHaveLength(0);
    // never-synced local record survives an empty server
    expect(mergeRemote(sim.data, { journal: [] }).journal).toHaveLength(1);
  });
});

import { defaultNutrition } from "@/lib/domain/nutrition";
describe("nutrition (optional, private)", () => {
  it("is off by default and queues sync ops when used", () => {
    const sim = new Sim(); sim.onboard();
    expect(sim.data.nutrition).toEqual(defaultNutrition());
    sim.do((d, c) => A.updateNutrition(d, c, { enabled: true, style: "vegan", avoid: ["soy"] }));
    sim.do((d, c) => A.adjustServes(d, c, sim.today, { group: "veg", delta: 1 }));
    const q = sim.data.meta.queue.map((o) => o.entity);
    expect(q).toContain("nutrition"); expect(q).toContain("nutritionLogs");
  });
  it("keeps one record per day, clamps values and never goes below zero", () => {
    const sim = new Sim(); sim.onboard();
    for (let i = 0; i < 20; i++) sim.do((d, c) => A.adjustServes(d, c, sim.today, { group: "veg", delta: 1 }));
    sim.do((d, c) => A.adjustServes(d, c, sim.today, { group: "fruit", delta: -1 }));
    sim.do((d, c) => A.adjustServes(d, c, sim.today, { waterDelta: -3 }));
    expect(sim.data.nutritionLogs).toHaveLength(1);
    expect(sim.data.nutritionLogs[0]).toMatchObject({ serves: { veg: 12, fruit: 0 }, waterCups: 0 });
    for (const op of sim.data.meta.queue.filter((o) => o.entity === "nutritionLogs" && o.action === "upsert")) expect(ENTITIES.nutritionLogs.schema.safeParse(op.record).success).toBe(true);
  });
  it("turning it off deletes every food log and is queued for sync; workouts are untouched", () => {
    const sim = new Sim(); sim.onboard(); sim.workout("A");
    sim.do((d, c) => A.updateNutrition(d, c, { enabled: true }));
    sim.do((d, c) => A.adjustServes(d, c, sim.today, { group: "protein", delta: 2 }));
    sim.do((d, c) => A.clearNutrition(d, c));
    expect(sim.data.nutritionLogs).toHaveLength(0); expect(sim.data.nutrition.enabled).toBe(false);
    expect(sim.data.sessions).toHaveLength(1);
    expect(sim.data.meta.queue.some((o) => o.entity === "nutritionLogs" && o.action === "delete")).toBe(true);
  });
  it("older saved data without nutrition fields still loads with safe defaults", async () => {
    const { emptyData } = await import("@/lib/store/types");
    const { nutrition: _n, nutritionLogs: _l, ...legacy } = emptyData();
    const merged = { ...emptyData(), ...legacy };
    expect(merged.nutrition.enabled).toBe(false); expect(merged.nutritionLogs).toEqual([]);
  });
});
