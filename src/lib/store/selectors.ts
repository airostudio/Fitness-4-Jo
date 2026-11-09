import { addDays, diffDays, mondayOf } from "@/lib/domain/dates";
import { getExercise } from "@/lib/domain/exercises";
import { weekPlan } from "@/lib/domain/program";
import { isFinished, countedSessions } from "@/lib/domain/stats";
import type { SessionPerformance } from "@/lib/domain/progression";
import { suggestedWeight } from "@/lib/domain/progression";
import type { ExerciseSet, ProgressionRecommendation, WorkoutSession } from "@/lib/domain/types";
import type { AppData } from "./types";

export const activeSession = (d: AppData): WorkoutSession | null =>
  d.sessions.find((s) => s.status === "in_progress" || s.status === "paused") ?? null;

export const setsFor = (d: AppData, sessionId: string, sessionExerciseId?: string): ExerciseSet[] =>
  d.sets.filter((s) => s.sessionId === sessionId && (!sessionExerciseId || s.sessionExerciseId === sessionExerciseId)).sort((a, b) => a.setIndex - b.setIndex);

/** Finished sessions that included this exercise, most recent first, shaped for the progression engine. */
export function historyFor(d: AppData, exerciseId: string): SessionPerformance[] {
  const counted = countedSessions(d.sessions, d.sets);
  const out: SessionPerformance[] = [];
  for (const s of counted) {
    const se = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (!se) continue;
    const sets = d.sets.filter((x) => x.sessionId === s.id && x.exerciseId === exerciseId && x.completed);
    if (!sets.length) continue;
    out.push({
      sessionId: s.id, date: s.date, prescribedSets: se.targetSets, repMin: se.repMin, repMax: se.repMax,
      sets: sets.sort((a, b) => a.setIndex - b.setIndex).map((x) => ({ weight: x.weight, reps: x.reps, completed: x.completed, effort: x.effort, discomfort: x.discomfort })),
      technique: se.technique, discomfort: se.discomfort, tooHeavy: se.tooHeavy, mode: s.mode,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.sessionId.localeCompare(a.sessionId));
}

export function lastUsedWeight(d: AppData, exerciseId: string): number | null {
  const h = historyFor(d, exerciseId)[0];
  if (!h) return null;
  const ws = h.sets.map((s) => s.weight).filter((w): w is number => w != null);
  return ws.length ? Math.max(...ws) : null;
}
export function lastPerformance(d: AppData, exerciseId: string): { date: string; weight: number | null; reps: number[] } | null {
  const h = historyFor(d, exerciseId)[0];
  if (!h) return null;
  const ws = h.sets.map((s) => s.weight).filter((w): w is number => w != null);
  return { date: h.date, weight: ws.length ? Math.max(...ws) : null, reps: h.sets.map((s) => s.reps ?? 0) };
}
export function suggestedFor(d: AppData, exerciseId: string): number | null {
  return suggestedWeight(d.program?.exerciseTargets[exerciseId]?.weight, lastUsedWeight(d, exerciseId));
}

export function currentWeekPlan(d: AppData) {
  return weekPlan(d.program?.currentWeek ?? 1, d.preferences.daysPerWeek);
}

export function finishedSessions(d: AppData): WorkoutSession[] {
  return countedSessions(d.sessions, d.sets).sort((a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt));
}

/** Latest undecided, decision-worthy recommendation per exercise. */
export function openRecommendations(d: AppData): ProgressionRecommendation[] {
  const decided = new Set(d.decisions.map((x) => x.recommendationId));
  const latest = new Map<string, ProgressionRecommendation>();
  for (const r of [...d.recommendations].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) latest.set(r.exerciseId, r);
  return [...latest.values()].filter((r) => r.needsDecision && !decided.has(r.id));
}

export function plannedPerWeek(d: AppData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of d.scheduled) { const m = mondayOf(s.date); out[m] = (out[m] ?? 0) + 1; }
  return out;
}

export function lastSessionDate(d: AppData): string | null {
  return finishedSessions(d)[0]?.date ?? null;
}
export function daysSinceLast(d: AppData, today: string): number | null {
  const l = lastSessionDate(d);
  return l ? diffDays(today, l) : null;
}

/** The calendar week (Monday) awaiting Jo's review, if any. */
export function weekAwaitingReview(d: AppData, today: string): { monday: string; planned: number; completed: number; concerning: boolean; veryHard: number } | null {
  if (!d.program) return null;
  const thisMonday = mondayOf(today);
  const startMonday = d.program.startDate;
  const reviewed = d.program.reviewedUntil ?? addDays(startMonday, -7);
  const candidate = addDays(reviewed, 7);
  if (candidate > thisMonday) return null;
  const planned = d.scheduled.filter((s) => s.date >= candidate && s.date < addDays(candidate, 7)).length;
  const sess = finishedSessions(d).filter((s) => s.date >= candidate && s.date < addDays(candidate, 7));
  const completedAll = planned > 0 && sess.length >= planned;
  // current week is reviewable early only when everything planned is done
  if (candidate === thisMonday && !completedAll) return null;
  const ids = new Set(sess.map((s) => s.id));
  const sets = d.sets.filter((s) => ids.has(s.sessionId) && s.completed);
  return {
    monday: candidate, planned, completed: sess.length,
    concerning: sets.some((s) => s.discomfort === "concerning") || sess.some((s) => s.exercises.some((e) => e.discomfort === "concerning")),
    veryHard: sets.filter((s) => s.effort === "very_hard").length,
  };
}

export const exerciseName = (id: string) => getExercise(id)?.name ?? id;
export { isFinished };
