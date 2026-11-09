import { addDays, diffDays, isoWeekday, mondayOf } from "./dates";
import { weekPlan } from "./program";
import type { ScheduledWorkout, WorkoutLetter } from "./types";

export const MIN_GAP_DAYS = 2; // at least one full rest day between strength sessions

export function otherLetter(l: WorkoutLetter): WorkoutLetter { return l === "A" ? "B" : "A"; }

/** Choose training weekdays (1–7) for `count` sessions, favouring preferred days and spacing. */
export function chooseDays(preferred: number[], count: number): number[] {
  const pref = [...new Set(preferred)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  const spaced = (days: number[]) => days.every((d, i) => i === 0 || d - days[i - 1]! >= MIN_GAP_DAYS);
  const defaults: Record<number, number[]> = { 1: [1], 2: [1, 4], 3: [1, 3, 5] };
  const picked: number[] = [];
  const tryAdd = (d: number) => {
    if (picked.length >= count) return;
    const next = [...picked, d].sort((a, b) => a - b);
    if (spaced(next)) { picked.splice(0, picked.length, ...next); }
  };
  pref.forEach(tryAdd);
  if (picked.length < count) (defaults[count] ?? [1, 3, 5]).forEach(tryAdd);
  if (picked.length < count) for (let d = 1; d <= 7; d++) tryAdd(d);
  return picked;
}

export interface BuildArgs {
  weekMonday: string; week: number; daysPerWeek: number; preferredDays: number[];
  startLetter: WorkoutLetter; idGen: () => string; now: string; notBefore?: string;
}
/** Plan a week of sessions. Letters alternate sequentially (A,B,A… continuing across weeks). */
export function planWeek(a: BuildArgs): ScheduledWorkout[] {
  const wp = weekPlan(a.week, a.daysPerWeek);
  const days = chooseDays(a.preferredDays, wp.sessions);
  let letter = a.startLetter;
  const out: ScheduledWorkout[] = [];
  for (const d of days) {
    const date = addDays(a.weekMonday, d - 1);
    if (a.notBefore && date < a.notBefore) continue;
    out.push({ id: a.idGen(), date, letter, week: a.week, status: "planned", updatedAt: a.now });
    letter = otherLetter(letter);
  }
  return out;
}

export interface MoveResult { ok: boolean; warning?: string; error?: string; }
/** Validate moving a planned workout to a new date. Rest-interval breaches are warnings, not blockers; duplicates are blocked. */
export function validateMove(schedule: ScheduledWorkout[], movingId: string, newDate: string, today: string): MoveResult {
  const moving = schedule.find((s) => s.id === movingId);
  if (!moving) return { ok: false, error: "That session could not be found." };
  if (moving.status === "completed") return { ok: false, error: "Completed sessions can't be moved." };
  if (newDate < today) return { ok: false, error: "Choose today or a future date." };
  if (schedule.some((s) => s.id !== movingId && s.date === newDate && s.status !== "skipped")) {
    return { ok: false, error: "There is already a session on that day." };
  }
  const near = schedule.find((s) => s.id !== movingId && s.status !== "skipped" && Math.abs(diffDays(s.date, newDate)) < MIN_GAP_DAYS);
  if (near) return { ok: true, warning: "That's very close to another session. A full rest day in between helps your muscles recover." };
  return { ok: true };
}

export function moveWorkout(schedule: ScheduledWorkout[], id: string, newDate: string, now: string): ScheduledWorkout[] {
  return schedule.map((s) => (s.id === id ? { ...s, date: newDate, moved: true, updatedAt: now } : s))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Re-letter all planned (not completed/skipped) future sessions in date order so A/B alternate
 * without duplicates, continuing from the last completed session. History is untouched.
 */
export function relabel(schedule: ScheduledWorkout[], lastCompletedLetter: WorkoutLetter | null, now: string): ScheduledWorkout[] {
  const sorted = [...schedule].sort((a, b) => a.date.localeCompare(b.date));
  let next: WorkoutLetter = lastCompletedLetter ? otherLetter(lastCompletedLetter) : "A";
  return sorted.map((s) => {
    if (s.status !== "planned") return s;
    const updated = s.letter === next ? s : { ...s, letter: next, updatedAt: now };
    next = otherLetter(next);
    return updated;
  });
}

/**
 * Rebuild upcoming weeks after a change of days/schedule while keeping history.
 * Removes future planned sessions and plans `weeksAhead` weeks fresh from `today`.
 */
export function rebuildSchedule(opts: {
  existing: ScheduledWorkout[]; today: string; currentWeek: number; daysPerWeek: number; preferredDays: number[];
  weeksAhead?: number; idGen: () => string; now: string;
}): ScheduledWorkout[] {
  const kept = opts.existing.filter((s) => s.status !== "planned" || s.date < opts.today);
  const lastDone = [...kept].filter((s) => s.status === "completed").sort((a, b) => b.date.localeCompare(a.date))[0];
  let letter: WorkoutLetter = lastDone ? otherLetter(lastDone.letter) : "A";
  let all = [...kept];
  const horizon = opts.weeksAhead ?? 2;
  for (let w = 0; w < horizon; w++) {
    const monday = addDays(mondayOf(opts.today), 7 * w);
    const already = all.filter((s) => s.date >= monday && s.date < addDays(monday, 7) && s.status !== "skipped");
    const plan = weekPlan(opts.currentWeek + w, opts.daysPerWeek);
    const remaining = Math.max(0, plan.sessions - already.filter((s) => s.status === "completed").length);
    if (remaining === 0) continue;
    const fresh = planWeek({
      weekMonday: monday, week: opts.currentWeek + w, daysPerWeek: opts.daysPerWeek, preferredDays: opts.preferredDays,
      startLetter: letter, idGen: opts.idGen, now: opts.now, notBefore: opts.today,
    }).filter((s) => !already.some((a) => a.date === s.date)).slice(0, remaining);
    all = [...all, ...fresh];
    all.sort((a, b) => a.date.localeCompare(b.date));
    letter = otherLetter(fresh.length ? fresh[fresh.length - 1]!.letter : letter);
  }
  return relabel(all, lastDone?.letter ?? null, opts.now);
}

export type DayState =
  | { kind: "workout"; item: ScheduledWorkout }
  | { kind: "rest" };
/** Rest days are a first-class, never-missed state. */
export function dayState(schedule: ScheduledWorkout[], date: string): DayState {
  const item = schedule.find((s) => s.date === date && s.status !== "skipped");
  return item ? { kind: "workout", item } : { kind: "rest" };
}

export function nextPlanned(schedule: ScheduledWorkout[], today: string): ScheduledWorkout | undefined {
  return [...schedule].filter((s) => s.status === "planned" && s.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
}

/** Planned sessions in the past that were not completed become "skipped" without any penalty. */
export function reconcilePast(schedule: ScheduledWorkout[], today: string, now: string): ScheduledWorkout[] {
  return schedule.map((s) => (s.status === "planned" && s.date < today ? { ...s, status: "skipped", updatedAt: now } : s));
}
export { isoWeekday };
