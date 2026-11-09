import { moveWorkout, nextPlanned, planWeek, reconcilePast, rebuildSchedule, relabel, validateMove, otherLetter } from "@/lib/domain/calendar";
import { addDays, mondayOf } from "@/lib/domain/dates";
import { normaliseWeights } from "@/lib/domain/equipment";
import { getExercise, mustExercise } from "@/lib/domain/exercises";
import { alternativesForSlot, buildTemplates, generateProgram, phaseForWeek, screen, setsThatFit, weekPlan } from "@/lib/domain/program";
import { evaluateProgression, reviewWeek, type WeekReview } from "@/lib/domain/progression";
import { assessReadiness, lighterSets, type ReadinessAnswers } from "@/lib/domain/readiness";
import { MILESTONE_DEFS, newMilestones } from "@/lib/domain/stats";
import { availableRequirements } from "@/lib/domain/equipment";
import type {
  Effort, Exercise, ExerciseSet, JournalEntry, ProgressionDecision, ProgressionRecommendation, Proposed, ReadinessCheckin, ReadinessMode, SessionExercise,
  SetDiscomfort, SlotKey, Technique, WorkoutLetter, WorkoutSession, EquipmentInventory, FitnessGoals, HealthConsiderations, Preferences, Profile,
} from "@/lib/domain/types";
import { RULE_VERSION } from "@/lib/domain/progression";
import { historyFor, activeSession, plannedPerWeek, setsFor, suggestedFor, weekAwaitingReview, daysSinceLast, lastSessionDate } from "./selectors";
import { emptyServes, SERVES_MAX, type FoodGroup, type NutritionLog, type NutritionPrefs } from "@/lib/domain/nutrition";
import { Tx } from "./tx";
import type { AppData, Ctx, TxResult } from "./types";

// ================================================================= onboarding & settings
export interface OnboardingInput {
  profile: Omit<Profile, "updatedAt" | "onboardedAt">;
  preferences: Omit<Preferences, "updatedAt" | "theme" | "textScale" | "highContrast" | "reducedMotion" | "sound" | "vibration" | "photosEnabled" | "restSeconds"> & Partial<Preferences>;
  equipment: Omit<EquipmentInventory, "updatedAt">;
  health: Omit<HealthConsiderations, "updatedAt">;
  goals: Omit<FitnessGoals, "updatedAt">;
}

export function completeOnboarding(base: AppData, ctx: Ctx, input: OnboardingInput): TxResult<{ programId: string }> {
  const tx = new Tx(base, ctx);
  const now = ctx.now;
  const prefs: Preferences = { ...base.preferences, ...input.preferences, updatedAt: now };
  const equipment: EquipmentInventory = { ...input.equipment, dumbbellWeightsKg: normaliseWeights(input.equipment.dumbbellWeightsKg), updatedAt: now };
  const health: HealthConsiderations = { ...input.health, updatedAt: now };
  const goals: FitnessGoals = { ...input.goals, updatedAt: now };
  const profile: Profile = { ...input.profile, onboardedAt: now, updatedAt: now };
  tx.single("profile", profile); tx.single("preferences", prefs); tx.single("equipment", equipment); tx.single("health", health); tx.single("goals", goals);
  tx.single("notifications", { ...base.notifications, days: prefs.trainingDays, time: prefs.trainingTime, updatedAt: now });
  const monday = mondayOf(ctx.today);
  const program = generateProgram({ profile, preferences: prefs, equipment, health, goals, now, startDate: monday, id: ctx.id() });
  tx.program(program);
  const sched = rebuildSchedule({ existing: [], today: ctx.today, currentWeek: 1, daysPerWeek: prefs.daysPerWeek, preferredDays: prefs.trainingDays, idGen: ctx.id, now });
  for (const s of sched) tx.put("scheduled", s);
  return tx.done({ programId: program.id });
}

type SingleKey = "profile" | "preferences" | "equipment" | "health" | "goals" | "notifications";
export function updateSingle<K extends SingleKey>(base: AppData, ctx: Ctx, key: K, patch: Partial<NonNullable<AppData[K]>>): TxResult {
  const tx = new Tx(base, ctx);
  const cur = base[key];
  if (!cur) return tx.done(undefined);
  const next = { ...(cur as object), ...(patch as object), updatedAt: ctx.now } as NonNullable<AppData[K]>;
  if (key === "equipment") (next as unknown as EquipmentInventory).dumbbellWeightsKg = normaliseWeights((next as unknown as EquipmentInventory).dumbbellWeightsKg);
  tx.single(key, next);
  if (key === "equipment" || key === "health") {
    // Equipment or health changed → re-select exercises from what is now available and safe (Jo's custom choices are kept if still suitable).
    const p = tx.data.program;
    if (p) {
      const eq = key === "equipment" ? (next as unknown as EquipmentInventory) : base.equipment;
      const h = key === "health" ? (next as unknown as HealthConsiderations) : base.health;
      const { templates } = buildTemplates(eq, h, p.templates);
      tx.program({ ...p, templates, screening: screen(h), updatedAt: ctx.now });
    }
  }
  if (key === "preferences") {
    const prefs = next as unknown as Preferences;
    if (tx.data.program) {
      const week = tx.data.program.currentWeek;
      const sched = rebuildSchedule({ existing: base.scheduled, today: ctx.today, currentWeek: week, daysPerWeek: prefs.daysPerWeek, preferredDays: prefs.trainingDays, idGen: ctx.id, now: ctx.now });
      syncSchedule(tx, base.scheduled, sched);
    }
  }
  return tx.done(undefined);
}

function syncSchedule(tx: Tx, before: AppData["scheduled"], after: AppData["scheduled"]) {
  const afterIds = new Set(after.map((s) => s.id));
  for (const b of before) if (!afterIds.has(b.id)) tx.remove("scheduled", b.id);
  const beforeById = new Map(before.map((s) => [s.id, s]));
  for (const a of after) { const b = beforeById.get(a.id); if (!b || JSON.stringify(b) !== JSON.stringify(a)) tx.put("scheduled", a); }
}

export function acknowledgeClearance(base: AppData, ctx: Ctx): TxResult { return updateSingle(base, ctx, "health", { clearanceAcknowledged: true }); }

export function customiseSlot(base: AppData, ctx: Ctx, letter: WorkoutLetter, slot: SlotKey, exerciseId: string): TxResult<{ ok: boolean; error?: string }> {
  const tx = new Tx(base, ctx);
  const p = base.program;
  if (!p) return tx.done({ ok: false, error: "No programme yet." });
  const ex = getExercise(exerciseId);
  const alts = alternativesForSlot(slot, base.equipment, base.health).map((e) => e.id);
  if (!ex || !alts.includes(exerciseId)) return tx.done({ ok: false, error: "That exercise isn't available with your equipment and comfort settings." });
  const templates = p.templates.map((t) => t.letter !== letter ? t : { ...t, slots: t.slots.map((s) => (s.slot === slot ? { ...s, exerciseId, custom: true } : s)) });
  tx.program({ ...p, templates, updatedAt: ctx.now });
  return tx.done({ ok: true });
}

// ================================================================= readiness
export function saveCheckin(base: AppData, ctx: Ctx, a: ReadinessAnswers, chosen: ReadinessMode): TxResult<ReadinessCheckin> {
  const tx = new Tx(base, ctx);
  const c: ReadinessCheckin = { id: ctx.id(), date: ctx.today, ...a, outcome: chosen, createdAt: ctx.now, updatedAt: ctx.now };
  tx.put("checkins", c);
  return tx.done(c);
}

// ================================================================= workout session
function buildSessionExercises(d: AppData, letter: WorkoutLetter, mode: "normal" | "lighter", week: number): SessionExercise[] {
  const p = d.program!;
  const tpl = p.templates.find((t) => t.letter === letter)!;
  const wp = weekPlan(week, d.preferences.daysPerWeek);
  const fit = setsThatFit(tpl, wp.sets, d.preferences.sessionMinutes);
  const out: SessionExercise[] = [];
  for (const slot of tpl.slots) {
    if (slot.optional) continue;
    const ex = mustExercise(slot.exerciseId);
    const target = p.exerciseTargets[ex.id];
    let sets = target?.sets ?? fit;
    if (mode === "lighter") sets = lighterSets(sets);
    out.push({
      id: "", exerciseId: ex.id, slot: slot.slot, targetSets: Math.max(1, sets), repMin: ex.repRange[0], repMax: ex.repRange[1],
      targetWeight: ex.loadType === "dumbbell" ? suggestedFor(d, ex.id) : null, status: "pending",
    });
  }
  return out;
}

export function startSession(base: AppData, ctx: Ctx, args: { letter: WorkoutLetter; mode: "normal" | "lighter"; scheduledId?: string; checkinId?: string }): TxResult<{ ok: boolean; sessionId?: string; error?: string }> {
  const tx = new Tx(base, ctx);
  if (!base.program) return tx.done({ ok: false, error: "Create your programme first." });
  const existing = activeSession(base);
  if (existing) return tx.done({ ok: true, sessionId: existing.id }); // safe resume – never start a second one
  const week = base.program.currentWeek;
  const exercises = buildSessionExercises(base, args.letter, args.mode, week).map((e) => ({ ...e, id: ctx.id() }));
  const s: WorkoutSession = {
    id: ctx.id(), letter: args.letter, scheduledId: args.scheduledId, date: ctx.today, week, phase: phaseForWeek(week), mode: args.mode,
    status: "in_progress", startedAt: ctx.now, totalPausedMs: 0, exercises, currentIndex: 0, rest: null, checkinId: args.checkinId, updatedAt: ctx.now,
  };
  tx.put("sessions", s);
  return tx.done({ ok: true, sessionId: s.id });
}

function mutateSession(base: AppData, ctx: Ctx, sessionId: string, fn: (s: WorkoutSession, tx: Tx) => WorkoutSession | void): TxResult<boolean> {
  const tx = new Tx(base, ctx);
  const s = base.sessions.find((x) => x.id === sessionId);
  if (!s) return tx.done(false);
  const next = fn({ ...s, exercises: s.exercises.map((e) => ({ ...e })) }, tx) ?? s;
  tx.put("sessions", { ...next, updatedAt: ctx.now });
  return tx.done(true);
}

export const startSet = (b: AppData, c: Ctx, sid: string) => mutateSession(b, c, sid, (s) => ({ ...s, setInProgressSince: c.now, rest: null }));

export interface SetInput { weight: number | null; reps: number | null; effort?: Effort; discomfort?: SetDiscomfort; note?: string; }
export function completeSet(base: AppData, ctx: Ctx, sessionId: string, input: SetInput, restSeconds?: number): TxResult<{ setId?: string; exerciseDone: boolean }> {
  const tx = new Tx(base, ctx);
  const s = base.sessions.find((x) => x.id === sessionId);
  if (!s || (s.status !== "in_progress")) return tx.done({ exerciseDone: false });
  const ex = s.exercises[s.currentIndex];
  if (!ex) return tx.done({ exerciseDone: false });
  const idx = setsFor(base, sessionId, ex.id).length;
  const set: ExerciseSet = {
    id: ctx.id(), sessionId, sessionExerciseId: ex.id, exerciseId: ex.exerciseId, setIndex: idx,
    weight: input.weight, reps: input.reps, completed: true, effort: input.effort, discomfort: input.discomfort, note: input.note || undefined,
    completedAt: ctx.now, updatedAt: ctx.now,
  };
  tx.put("sets", set);
  const exerciseDone = idx + 1 >= ex.targetSets;
  const dur = (restSeconds ?? base.preferences.restSeconds) * 1000;
  const exercises = s.exercises.map((e, i) => (i === s.currentIndex ? { ...e, status: exerciseDone ? ("done" as const) : e.status, discomfort: worse(e.discomfort, input.discomfort) } : e));
  tx.put("sessions", { ...s, exercises, setInProgressSince: undefined, rest: exerciseDone && s.currentIndex === s.exercises.length - 1 ? null : { endsAt: new Date(Date.parse(ctx.now) + dur).toISOString(), durationMs: dur }, updatedAt: ctx.now });
  return tx.done({ setId: set.id, exerciseDone });
}
const worse = (a: SetDiscomfort | undefined, b: SetDiscomfort | undefined): SetDiscomfort | undefined => {
  const o = { none: 0, mild: 1, concerning: 2 } as const;
  if (!a) return b; if (!b) return a;
  return o[b] > o[a] ? b : a;
};

/** "Repeat set": one more set of the current exercise (e.g. Jo wants another go). */
export const addExtraSet = (b: AppData, c: Ctx, sid: string) =>
  mutateSession(b, c, sid, (s) => ({ ...s, exercises: s.exercises.map((e, i) => (i === s.currentIndex ? { ...e, targetSets: e.targetSets + 1, status: "pending" as const } : e)), rest: null }));

export function editSet(base: AppData, ctx: Ctx, setId: string, patch: Partial<Pick<ExerciseSet, "weight" | "reps" | "effort" | "discomfort" | "note">>): TxResult<boolean> {
  const tx = new Tx(base, ctx);
  const cur = base.sets.find((x) => x.id === setId);
  if (!cur) return tx.done(false);
  tx.put("sets", { ...cur, ...patch, updatedAt: ctx.now });
  return tx.done(true);
}
export function deleteSet(base: AppData, ctx: Ctx, setId: string): TxResult<boolean> {
  const tx = new Tx(base, ctx);
  const cur = base.sets.find((x) => x.id === setId);
  if (!cur) return tx.done(false);
  tx.remove("sets", setId);
  // re-number remaining sets of that exercise so indexes stay contiguous
  const rest = base.sets.filter((x) => x.sessionExerciseId === cur.sessionExerciseId && x.id !== setId).sort((a, b) => a.setIndex - b.setIndex);
  rest.forEach((x, i) => { if (x.setIndex !== i) tx.put("sets", { ...x, setIndex: i, updatedAt: ctx.now }); });
  return tx.done(true);
}

export const gotoExercise = (b: AppData, c: Ctx, sid: string, index: number) =>
  mutateSession(b, c, sid, (s) => (index >= 0 && index < s.exercises.length ? { ...s, currentIndex: index, rest: null, setInProgressSince: undefined } : s));

export function nextExercise(b: AppData, c: Ctx, sid: string) {
  return mutateSession(b, c, sid, (s) => {
    const next = s.exercises.findIndex((e, i) => i > s.currentIndex && e.status === "pending");
    const any = next >= 0 ? next : s.exercises.findIndex((e) => e.status === "pending");
    return { ...s, currentIndex: any >= 0 ? any : s.currentIndex, rest: null, setInProgressSince: undefined };
  });
}
export const skipExercise = (b: AppData, c: Ctx, sid: string) =>
  mutateSession(b, c, sid, (s) => {
    const exercises = s.exercises.map((e, i) => (i === s.currentIndex ? { ...e, status: "skipped" as const } : e));
    const next = exercises.findIndex((e, i) => i > s.currentIndex && e.status === "pending");
    return { ...s, exercises, currentIndex: next >= 0 ? next : s.currentIndex, rest: null, setInProgressSince: undefined };
  });

export function substituteExercise(base: AppData, ctx: Ctx, sid: string, newExerciseId: string): TxResult<{ ok: boolean; error?: string }> {
  const s = base.sessions.find((x) => x.id === sid);
  const ex = s?.exercises[s.currentIndex];
  const tx = new Tx(base, ctx);
  if (!s || !ex) return tx.done({ ok: false, error: "No current exercise." });
  const options = substitutesFor(base, ex.slot, ex.originalExerciseId ?? ex.exerciseId).map((e) => e.id);
  if (!options.includes(newExerciseId)) return tx.done({ ok: false, error: "That swap isn't available with your equipment." });
  if (setsFor(base, sid, ex.id).length > 0) return tx.done({ ok: false, error: "Sets are already logged for this exercise – your record is kept as it is." });
  const n = mustExercise(newExerciseId);
  const res = mutateSession(base, ctx, sid, (cur) => ({
    ...cur,
    exercises: cur.exercises.map((e, i) => i === cur.currentIndex ? { ...e, exerciseId: n.id, originalExerciseId: e.originalExerciseId ?? e.exerciseId, repMin: n.repRange[0], repMax: n.repRange[1],
      targetWeight: n.loadType === "dumbbell" ? suggestedFor(base, n.id) : null } : e),
    rest: null,
  }));
  return { ...res, result: { ok: true } };
}
/** Swap options for a slot: same movement family plus easier/harder variations, all equipment-safe. */
export function substitutesFor(d: AppData, slot: SlotKey, currentId: string): Exercise[] {
  const fam = alternativesForSlot(slot, d.equipment, d.health);
  const cur = getExercise(currentId);
  const have = availableRequirements(d.equipment);
  const extra = cur ? [...cur.regressions, ...cur.progressions].map(getExercise).filter((e): e is Exercise => !!e && e.requires.every((r) => have.has(r))) : [];
  const seen = new Set<string>();
  return [...fam, ...extra].filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), e.id !== currentId)));
}

export function setExerciseFeedback(base: AppData, ctx: Ctx, sid: string, patch: { technique?: Technique; tooHeavy?: boolean; discomfort?: SetDiscomfort; note?: string }) {
  return mutateSession(base, ctx, sid, (s) => ({ ...s, exercises: s.exercises.map((e, i) => (i === s.currentIndex ? { ...e, ...patch, discomfort: patch.discomfort ? worse(e.discomfort, patch.discomfort) : e.discomfort } : e)) }));
}

// ---- pause / rest timer -------------------------------------------------------
export const pauseSession = (b: AppData, c: Ctx, sid: string) =>
  mutateSession(b, c, sid, (s) => {
    if (s.status !== "in_progress") return s;
    const rest = s.rest?.endsAt ? { durationMs: s.rest.durationMs, pausedRemainingMs: Math.max(0, Date.parse(s.rest.endsAt) - Date.parse(c.now)) } : s.rest;
    return { ...s, status: "paused", pausedAt: c.now, rest };
  });
export const resumeSession = (b: AppData, c: Ctx, sid: string) =>
  mutateSession(b, c, sid, (s) => {
    if (s.status !== "paused") return s;
    const rest = s.rest?.pausedRemainingMs != null ? { durationMs: s.rest.durationMs, endsAt: new Date(Date.parse(c.now) + s.rest.pausedRemainingMs).toISOString() } : s.rest;
    return { ...s, status: "in_progress", totalPausedMs: s.totalPausedMs + (s.pausedAt ? Date.parse(c.now) - Date.parse(s.pausedAt) : 0), pausedAt: undefined, rest };
  });
export const restPause = (b: AppData, c: Ctx, sid: string) =>
  mutateSession(b, c, sid, (s) => (s.rest?.endsAt ? { ...s, rest: { durationMs: s.rest.durationMs, pausedRemainingMs: Math.max(0, Date.parse(s.rest.endsAt) - Date.parse(c.now)) } } : s));
export const restResume = (b: AppData, c: Ctx, sid: string) =>
  mutateSession(b, c, sid, (s) => (s.rest?.pausedRemainingMs != null ? { ...s, rest: { durationMs: s.rest.durationMs, endsAt: new Date(Date.parse(c.now) + s.rest.pausedRemainingMs).toISOString() } } : s));
export const restSkip = (b: AppData, c: Ctx, sid: string) => mutateSession(b, c, sid, (s) => ({ ...s, rest: null }));
export const restAdjust = (b: AppData, c: Ctx, sid: string, deltaSec: number) =>
  mutateSession(b, c, sid, (s) => {
    if (!s.rest) return s;
    if (s.rest.endsAt) return { ...s, rest: { durationMs: s.rest.durationMs, endsAt: new Date(Math.max(Date.parse(c.now), Date.parse(s.rest.endsAt) + deltaSec * 1000)).toISOString() } };
    return { ...s, rest: { durationMs: s.rest.durationMs, pausedRemainingMs: Math.max(0, (s.rest.pausedRemainingMs ?? 0) + deltaSec * 1000) } };
  });

// ---- finishing ----------------------------------------------------------------
export function endSession(base: AppData, ctx: Ctx, sid: string, how: "finished" | "early"): TxResult<{ recommendations: ProgressionRecommendation[]; milestones: string[]; loggedSets: number }> {
  const tx = new Tx(base, ctx);
  const s = base.sessions.find((x) => x.id === sid);
  if (!s || s.status === "completed" || s.status === "ended_early") return tx.done({ recommendations: [], milestones: [], loggedSets: 0 });
  const logged = setsFor(base, sid).filter((x) => x.completed).length;
  const pausedExtra = s.status === "paused" && s.pausedAt ? Date.parse(ctx.now) - Date.parse(s.pausedAt) : 0;
  const finished: WorkoutSession = {
    ...s, status: how === "finished" ? "completed" : "ended_early", endedAt: ctx.now, rest: null, setInProgressSince: undefined, pausedAt: undefined,
    totalPausedMs: s.totalPausedMs + pausedExtra, updatedAt: ctx.now,
  };
  tx.put("sessions", finished);
  if (logged > 0 && s.scheduledId) {
    const sc = base.scheduled.find((x) => x.id === s.scheduledId);
    if (sc && sc.status === "planned") tx.put("scheduled", { ...sc, status: "completed", sessionId: sid, updatedAt: ctx.now });
  } else if (logged > 0) {
    const sc = base.scheduled.find((x) => x.status === "planned" && x.date === s.date && x.letter === s.letter);
    if (sc) tx.put("scheduled", { ...sc, status: "completed", sessionId: sid, updatedAt: ctx.now });
  }
  if (logged === 0) return tx.done({ recommendations: [], milestones: [], loggedSets: 0 });

  // Progression – deterministic, for each exercise performed in this session
  const dataAfter: AppData = { ...tx.data };
  const recs: ProgressionRecommendation[] = [];
  const performed = [...new Set(base.sets.filter((x) => x.sessionId === sid && x.completed).map((x) => x.exerciseId))];
  const readiness = [...base.checkins].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 2).map((c) => ({ energy: c.energy, muscles: c.muscles }));
  for (const exId of performed) {
    const ex = getExercise(exId);
    if (!ex) continue;
    const r = evaluateProgression({
      name: base.profile?.name ?? "friend", exercise: ex, history: historyFor(dataAfter, exId), today: ctx.today,
      availableWeights: base.equipment.dumbbellWeightsKg, hasBands: base.equipment.items.includes("bands"), maxSets: weekPlan(base.program?.currentWeek ?? 1, base.preferences.daysPerWeek).maxSets,
      nextVariationId: ex.progressions.map(getExercise).find((e) => e && e.requires.every((q) => availableRequirements(base.equipment).has(q)))?.id ?? null, recentReadiness: readiness,
    });
    if (r.action === "calibrate") continue;
    const rec: ProgressionRecommendation = { id: ctx.id(), exerciseId: exId, sessionId: sid, ruleVersion: RULE_VERSION, createdAt: ctx.now, updatedAt: ctx.now, ...r };
    tx.put("recommendations", rec); recs.push(rec);
  }
  // Milestones
  const after = { ...tx.data };
  const counted = after.sessions.filter((x) => (x.status === "completed" || x.status === "ended_early") && after.sets.some((y) => y.sessionId === x.id && y.completed));
  const acceptedIncrease = base.decisions.some((d) => d.decision === "accepted" && base.recommendations.find((r) => r.id === d.recommendationId)?.action === "increase_weight");
  const keys = newMilestones({ sessions: counted, plannedPerWeek: plannedPerWeek(after), acceptedIncrease, existing: base.milestones.map((m) => m.key), today: ctx.today });
  for (const key of keys) tx.put("milestones", { id: ctx.id(), key, achievedAt: ctx.now, updatedAt: ctx.now });
  return tx.done({ recommendations: recs, milestones: keys, loggedSets: logged });
}

export const saveReflection = (b: AppData, c: Ctx, sid: string, reflection: NonNullable<WorkoutSession["reflection"]>) =>
  mutateSession(b, c, sid, (s) => ({ ...s, reflection: { ...s.reflection, ...reflection } }));

export function deleteSession(base: AppData, ctx: Ctx, sid: string): TxResult<boolean> {
  const tx = new Tx(base, ctx);
  if (!base.sessions.some((s) => s.id === sid)) return tx.done(false);
  for (const set of base.sets.filter((x) => x.sessionId === sid)) tx.remove("sets", set.id);
  tx.remove("sessions", sid);
  for (const sc of base.scheduled.filter((x) => x.sessionId === sid)) tx.put("scheduled", { ...sc, status: "planned", sessionId: undefined, updatedAt: ctx.now });
  return tx.done(true);
}

// ================================================================= progression decisions
export function decide(base: AppData, ctx: Ctx, recId: string, decision: "accepted" | "declined" | "deferred", chosenIndex = -1): TxResult<boolean> {
  const tx = new Tx(base, ctx);
  const rec = base.recommendations.find((r) => r.id === recId);
  if (!rec || base.decisions.some((d) => d.recommendationId === recId && d.decision !== "deferred")) return tx.done(false);
  const chosen: Proposed | null = chosenIndex >= 0 ? rec.alternatives[chosenIndex]?.proposed ?? null : rec.proposed;
  const d: ProgressionDecision = { id: ctx.id(), recommendationId: recId, exerciseId: rec.exerciseId, decision, chosen: decision === "accepted" ? chosen : null, decidedAt: ctx.now, updatedAt: ctx.now };
  tx.put("decisions", d);
  if (decision === "accepted" && chosen && base.program) {
    const program = { ...base.program, exerciseTargets: { ...base.program.exerciseTargets }, updatedAt: ctx.now };
    if (chosen.exerciseId) {
      // switching to a different variation/regression replaces it in the template (Jo-chosen, so marked custom)
      program.templates = program.templates.map((t) => ({ ...t, slots: t.slots.map((s) => (s.exerciseId === rec.exerciseId ? { ...s, exerciseId: chosen.exerciseId!, custom: true } : s)) }));
    } else {
      const prev = program.exerciseTargets[rec.exerciseId];
      program.exerciseTargets[rec.exerciseId] = {
        weight: chosen.weight !== undefined ? chosen.weight : prev?.weight, sets: chosen.sets ?? prev?.sets, updatedAt: ctx.now,
      };
    }
    tx.program(program);
  }
  return tx.done(true);
}

// ================================================================= scheduling
export function moveScheduled(base: AppData, ctx: Ctx, id: string, date: string): TxResult<{ ok: boolean; error?: string; warning?: string }> {
  const tx = new Tx(base, ctx);
  const v = validateMove(base.scheduled, id, date, ctx.today);
  if (!v.ok) return tx.done({ ok: false, error: v.error });
  const moved = moveWorkout(base.scheduled, id, date, ctx.now);
  const lastDone = [...base.scheduled].filter((s) => s.status === "completed").sort((a, b) => b.date.localeCompare(a.date))[0];
  const relabelled = relabel(moved, lastDone?.letter ?? null, ctx.now);
  syncSchedule(tx, base.scheduled, relabelled);
  return tx.done({ ok: true, warning: v.warning });
}
export function skipScheduled(base: AppData, ctx: Ctx, id: string): TxResult<boolean> {
  const tx = new Tx(base, ctx);
  const s = base.scheduled.find((x) => x.id === id);
  if (!s || s.status !== "planned") return tx.done(false);
  const remaining = base.scheduled.map((x) => (x.id === id ? { ...x, status: "skipped" as const, updatedAt: ctx.now } : x));
  const lastDone = [...remaining].filter((x) => x.status === "completed").sort((a, b) => b.date.localeCompare(a.date))[0];
  syncSchedule(tx, base.scheduled, relabel(remaining, lastDone?.letter ?? null, ctx.now));
  return tx.done(true);
}
/** Called on app open: turns past, unfinished plans into gentle 'skipped', and makes sure the next two weeks are planned. */
export function refreshSchedule(base: AppData, ctx: Ctx): TxResult {
  const tx = new Tx(base, ctx);
  if (!base.program) return tx.done(undefined);
  let sched = reconcilePast(base.scheduled, ctx.today, ctx.now);
  const planned = sched.filter((s) => s.status === "planned" && s.date >= ctx.today).length;
  if (planned < 2) {
    sched = rebuildSchedule({ existing: sched, today: ctx.today, currentWeek: base.program.currentWeek, daysPerWeek: base.preferences.daysPerWeek, preferredDays: base.preferences.trainingDays, idGen: ctx.id, now: ctx.now });
  }
  syncSchedule(tx, base.scheduled, sched);
  return tx.done(undefined);
}

export function confirmWeekReview(base: AppData, ctx: Ctx, outcome: "advance" | "repeat" | "ease"): TxResult<boolean> {
  const tx = new Tx(base, ctx);
  const w = weekAwaitingReview(base, ctx.today);
  if (!base.program || !w) return tx.done(false);
  const cw = base.program.currentWeek;
  const next = outcome === "advance" ? cw + 1 : outcome === "ease" ? Math.max(1, cw - 1) : cw;
  tx.program({ ...base.program, currentWeek: next, reviewedUntil: w.monday, updatedAt: ctx.now });
  const sched = rebuildSchedule({ existing: base.scheduled, today: ctx.today, currentWeek: next, daysPerWeek: base.preferences.daysPerWeek, preferredDays: base.preferences.trainingDays, idGen: ctx.id, now: ctx.now });
  syncSchedule(tx, base.scheduled, sched);
  return tx.done(true);
}
export function weekReviewFor(d: AppData, today: string): { week: ReturnType<typeof weekAwaitingReview>; review: WeekReview } | null {
  const w = weekAwaitingReview(d, today);
  if (!w || !d.program) return null;
  return { week: w, review: reviewWeek({ plannedSessions: w.planned, completedSessions: w.completed, concerningDiscomfort: w.concerning, veryHardSets: w.veryHard, daysSinceLastSession: daysSinceLast(d, today), weekNumber: d.program.currentWeek }) };
}

// ================================================================= journal
export function saveJournal(base: AppData, ctx: Ctx, entry: Partial<JournalEntry> & { id?: string }): TxResult<JournalEntry> {
  const tx = new Tx(base, ctx);
  const prev = entry.id ? base.journal.find((j) => j.id === entry.id) : undefined;
  const j: JournalEntry = {
    id: prev?.id ?? ctx.id(), date: entry.date ?? prev?.date ?? ctx.today, feeling: entry.feeling ?? prev?.feeling ?? "", enjoyed: entry.enjoyed ?? prev?.enjoyed ?? [],
    disliked: entry.disliked ?? prev?.disliked ?? [], achievement: entry.achievement ?? prev?.achievement ?? "", energy: entry.energy ?? prev?.energy,
    confidence: entry.confidence ?? prev?.confidence, goal: entry.goal ?? prev?.goal ?? "", mobilityNote: entry.mobilityNote ?? prev?.mobilityNote ?? "",
    photoPath: entry.photoPath ?? prev?.photoPath, sharedWithSupporter: entry.sharedWithSupporter ?? prev?.sharedWithSupporter ?? false,
    createdAt: prev?.createdAt ?? ctx.now, updatedAt: ctx.now,
  };
  tx.put("journal", j);
  return tx.done(j);
}
export function deleteJournal(base: AppData, ctx: Ctx, id: string): TxResult<boolean> {
  const tx = new Tx(base, ctx);
  if (!base.journal.some((j) => j.id === id)) return tx.done(false);
  tx.remove("journal", id);
  return tx.done(true);
}

// ================================================================= misc selectors used by UI
export function todaysPlan(d: AppData, today: string) {
  const item = d.scheduled.find((s) => s.date === today && s.status !== "skipped");
  const next = nextPlanned(d.scheduled, today);
  return { today: item ?? null, next };
}
export { otherLetter, planWeek, addDays, assessReadiness, MILESTONE_DEFS, lastSessionDate };


// ================================================================= nutrition (optional, private)
export function updateNutrition(base: AppData, ctx: Ctx, patch: Partial<Omit<NutritionPrefs, "updatedAt">>): TxResult {
  const tx = new Tx(base, ctx);
  tx.single("nutrition", { ...base.nutrition, ...patch, updatedAt: ctx.now });
  return tx.done(undefined);
}
export const logFor = (d: AppData, date: string): NutritionLog | undefined =>
  d.nutritionLogs.filter((l) => l.date === date).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

/** Adjust one food group (or water) for a day. Values are clamped; one record per day. */
export function adjustServes(base: AppData, ctx: Ctx, date: string, change: { group?: FoodGroup; delta?: number; waterDelta?: number; note?: string }): TxResult<NutritionLog> {
  const tx = new Tx(base, ctx);
  const cur = logFor(base, date);
  const serves = { ...(cur?.serves ?? emptyServes()) };
  if (change.group && change.delta) serves[change.group] = Math.max(0, Math.min(SERVES_MAX, serves[change.group] + change.delta));
  const log: NutritionLog = {
    id: cur?.id ?? ctx.id(), date, serves, waterCups: Math.max(0, Math.min(30, (cur?.waterCups ?? 0) + (change.waterDelta ?? 0))),
    note: change.note ?? cur?.note ?? "", createdAt: cur?.createdAt ?? ctx.now, updatedAt: ctx.now,
  };
  tx.put("nutritionLogs", log);
  return tx.done(log);
}
/** Delete every nutrition record and switch the feature off (Jo's choice at any time). */
export function clearNutrition(base: AppData, ctx: Ctx): TxResult {
  const tx = new Tx(base, ctx);
  for (const l of base.nutritionLogs) tx.remove("nutritionLogs", l.id);
  tx.single("nutrition", { ...base.nutrition, enabled: false, updatedAt: ctx.now });
  return tx.done(undefined);
}
