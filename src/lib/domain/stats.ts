import { addDays, diffDays, mondayOf } from "./dates";
import type { ExerciseSet, Milestone, WorkoutSession } from "./types";

export type Range = "7" | "30" | "90" | "all";
export const isFinished = (s: WorkoutSession) => s.status === "completed" || s.status === "ended_early";
/** A session counts if at least one set was logged. */
export function countedSessions(sessions: WorkoutSession[], sets: ExerciseSet[]): WorkoutSession[] {
  const withSets = new Set(sets.filter((s) => s.completed).map((s) => s.sessionId));
  return sessions.filter((s) => isFinished(s) && withSets.has(s.id));
}
export function inRange(date: string, range: Range, today: string): boolean {
  if (range === "all") return true;
  return diffDays(today, date) < Number(range) && diffDays(today, date) >= 0;
}
export function weeklyCounts(sessions: WorkoutSession[], today: string, weeks = 8): { weekStart: string; count: number }[] {
  const start = addDays(mondayOf(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, k) => {
    const ws = addDays(start, 7 * k);
    return { weekStart: ws, count: sessions.filter((s) => s.date >= ws && s.date < addDays(ws, 7)).length };
  });
}
export function sessionsThisWeek(sessions: WorkoutSession[], today: string): number {
  const m = mondayOf(today);
  return sessions.filter((s) => s.date >= m && s.date < addDays(m, 7)).length;
}
export function sessionsThisMonth(sessions: WorkoutSession[], today: string): number {
  return sessions.filter((s) => s.date.slice(0, 7) === today.slice(0, 7)).length;
}
export function completionRate(done: number, planned: number): number | null {
  return planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : null;
}

export interface ExercisePoint { date: string; maxWeight: number | null; bestReps: number; volume: number; sessionId: string; }
/** Per-session series for one exercise (volume = Σ weight × reps; bodyweight sets count reps only as volume=0). */
export function exerciseSeries(exerciseId: string, sets: ExerciseSet[], sessions: WorkoutSession[]): ExercisePoint[] {
  const dateOf = new Map(sessions.map((s) => [s.id, s.date]));
  const by = new Map<string, ExerciseSet[]>();
  for (const s of sets) if (s.exerciseId === exerciseId && s.completed) { (by.get(s.sessionId) ?? by.set(s.sessionId, []).get(s.sessionId)!).push(s); }
  return [...by.entries()]
    .filter(([sid]) => dateOf.has(sid))
    .map(([sid, ss]) => {
      const ws = ss.map((x) => x.weight).filter((w): w is number => w != null);
      return {
        sessionId: sid, date: dateOf.get(sid)!, maxWeight: ws.length ? Math.max(...ws) : null,
        bestReps: Math.max(0, ...ss.map((x) => x.reps ?? 0)),
        volume: ss.reduce((a, x) => a + (x.weight ?? 0) * (x.reps ?? 0), 0),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function personalBests(sets: ExerciseSet[], sessions: WorkoutSession[]): { exerciseId: string; weight: number | null; reps: number; date: string }[] {
  const dateOf = new Map(sessions.map((s) => [s.id, s.date]));
  const best = new Map<string, { exerciseId: string; weight: number | null; reps: number; date: string }>();
  for (const s of sets) {
    if (!s.completed || s.reps == null || !dateOf.has(s.sessionId)) continue;
    const cur = best.get(s.exerciseId);
    const better = !cur || (s.weight ?? 0) > (cur.weight ?? 0) || ((s.weight ?? 0) === (cur.weight ?? 0) && s.reps > cur.reps);
    if (better) best.set(s.exerciseId, { exerciseId: s.exerciseId, weight: s.weight, reps: s.reps, date: dateOf.get(s.sessionId)! });
  }
  return [...best.values()].sort((a, b) => b.date.localeCompare(a.date));
}
/** Jo's own starting point vs now, for one exercise. */
export function compareToStart(series: ExercisePoint[]): { start: ExercisePoint; now: ExercisePoint } | null {
  return series.length >= 2 ? { start: series[0]!, now: series[series.length - 1]! } : null;
}
export function totalVolume(sets: ExerciseSet[]): number {
  return sets.filter((s) => s.completed).reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0);
}

// ---------------------------------------------------------------- Milestones
export const MILESTONE_DEFS: Record<string, { title: string; message: string }> = {
  first_session: { title: "First session complete", message: "You started – that's the hardest part. Lovely work." },
  first_week: { title: "First full week", message: "A whole week of showing up for yourself." },
  first_month: { title: "First month", message: "A month of steady effort. Your consistency is something to be proud of." },
  first_increase: { title: "First weight increase", message: "You stepped up to a new weight when you were ready." },
  ten_workouts: { title: "10 workouts", message: "Ten sessions done. That's real, steady strength-building." },
  twenty_five_workouts: { title: "25 workouts", message: "Twenty-five sessions. This is becoming part of who you are." },
};

export interface MilestoneInput {
  sessions: WorkoutSession[]; plannedPerWeek: Record<string, number>; // weekStart(Mon) → planned count
  acceptedIncrease: boolean; existing: string[]; today: string;
}
/** Returns keys newly achieved. "First full week" = a calendar week where completed ≥ planned (planned ≥ 1). First month = 30 days since first session with ≥ 6 sessions. */
export function newMilestones(i: MilestoneInput): string[] {
  const out: string[] = [];
  const has = new Set(i.existing);
  const add = (k: string, cond: boolean) => { if (cond && !has.has(k)) out.push(k); };
  const n = i.sessions.length;
  add("first_session", n >= 1);
  const byWeek = new Map<string, number>();
  for (const s of i.sessions) { const w = mondayOf(s.date); byWeek.set(w, (byWeek.get(w) ?? 0) + 1); }
  add("first_week", [...byWeek.entries()].some(([w, c]) => (i.plannedPerWeek[w] ?? 0) > 0 && c >= (i.plannedPerWeek[w] ?? 99)));
  const first = [...i.sessions].sort((a, b) => a.date.localeCompare(b.date))[0];
  add("first_month", !!first && diffDays(i.today, first.date) >= 30 && n >= 6);
  add("first_increase", i.acceptedIncrease);
  add("ten_workouts", n >= 10);
  add("twenty_five_workouts", n >= 25);
  return out;
}
export function latestMilestone(ms: Milestone[]): Milestone | undefined {
  return [...ms].sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))[0];
}
