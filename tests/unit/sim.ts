import { emptyData, type AppData, type Ctx, type TxResult } from "@/lib/store/types";
import { completeOnboarding, completeSet, endSession, startSession, saveCheckin, type OnboardingInput } from "@/lib/store/actions";
import { goals, health, inv, prefs, profile } from "./helpers";
import type { Effort } from "@/lib/domain/types";

/** Deterministic clock + ids so scenario tests read like a story. */
export class Sim {
  data: AppData = emptyData();
  private n = 0;
  clock: number;
  today: string;
  constructor(startIso = "2026-11-09T09:00:00.000Z") { this.clock = Date.parse(startIso); this.today = startIso.slice(0, 10); }
  get ctx(): Ctx { return { now: new Date(this.clock).toISOString(), today: this.today, id: () => `00000000-0000-4000-8000-${String(++this.n).padStart(12, "0")}` }; }
  tick(ms: number) { this.clock += ms; }
  day(iso: string, hour = 9) { this.today = iso; this.clock = Date.parse(`${iso}T0${hour}:00:00.000Z`); }
  do<T>(fn: (d: AppData, c: Ctx) => TxResult<T>): T { const r = fn(this.data, this.ctx); this.data = r.data; return r.result; }
  onboard(over: Partial<OnboardingInput> = {}) {
    const { name, experience, activityLevel, movementConfidence } = profile();
    const p = prefs();
    return this.do((d, c) => completeOnboarding(d, c, {
      profile: { name, experience, activityLevel, movementConfidence },
      preferences: { timezone: p.timezone, trainingDays: [1, 4], trainingTime: "09:00", daysPerWeek: 3, sessionMinutes: 45 },
      equipment: { items: inv(["mat", "chair", "light_dumbbells", "step"], [1, 2, 3, 4]).items, dumbbellWeightsKg: [1, 2, 3, 4], bandLevels: [], other: "" },
      health: (({ updatedAt: _u, ...h }) => h)(health()), goals: (({ updatedAt: _u, ...g }) => g)(goals()), ...over,
    }));
  }
  /** Run a full workout: every exercise, all target sets, with the given reps/effort. Returns the session id. */
  workout(letter: "A" | "B", opts: { reps?: (exerciseId: string) => number; weight?: (exerciseId: string, suggested: number | null) => number | null; effort?: Effort; mode?: "normal" | "lighter" } = {}) {
    const chk = this.do((d, c) => saveCheckin(d, c, { energy: "good", muscles: "recovered", pain: "none" }, opts.mode ?? "normal"));
    const { sessionId } = this.do((d, c) => startSession(d, c, { letter, mode: opts.mode ?? "normal", checkinId: chk.id, scheduledId: d.scheduled.find((s) => s.date === this.today && s.letter === letter)?.id }));
    let guard = 0;
    for (;;) {
      const s = this.data.sessions.find((x) => x.id === sessionId)!;
      const ex = s.exercises[s.currentIndex]!;
      const done = this.data.sets.filter((x) => x.sessionExerciseId === ex.id).length;
      if (done >= ex.targetSets) {
        const nextPending = s.exercises.findIndex((e) => e.status === "pending");
        if (nextPending < 0) break;
        this.data = { ...this.data, sessions: this.data.sessions.map((x) => (x.id === sessionId ? { ...x, currentIndex: nextPending } : x)) };
      } else {
        this.tick(60_000);
        this.do((d, c) => completeSet(d, c, sessionId!, { weight: opts.weight ? opts.weight(ex.exerciseId, ex.targetWeight) : ex.targetWeight, reps: opts.reps ? opts.reps(ex.exerciseId) : ex.repMax, effort: opts.effort ?? "comfortable" }));
      }
      if (++guard > 200) throw new Error("runaway");
    }
    this.tick(60_000);
    const res = this.do((d, c) => endSession(d, c, sessionId!, "finished"));
    return { sessionId: sessionId!, ...res };
  }
}
