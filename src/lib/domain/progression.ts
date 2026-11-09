import { diffDays } from "./dates";
import { formatKg, nextHeavier, nextLighter, normaliseWeights } from "./equipment";
import type { Effort, Exercise, ProgressionAction, ProgressionAlternative, ProgressionRecommendation, Proposed, SetDiscomfort, Technique } from "./types";

export const RULE_VERSION = "2026.1";
/** Largest weight step (kg) we will suggest without offering a gentler route first. */
export const MAX_COMFORTABLE_JUMP_KG = 2.5;
/** Days of absence before we suggest a gentler return. */
export const BREAK_DAYS = 14;
export const LONG_BREAK_DAYS = 28;

export interface PerfSet { weight: number | null; reps: number | null; completed: boolean; effort?: Effort; discomfort?: SetDiscomfort; }
export interface SessionPerformance {
  sessionId: string; date: string; prescribedSets: number; repMin: number; repMax: number;
  sets: PerfSet[]; technique?: Technique; discomfort?: SetDiscomfort; tooHeavy?: boolean; mode?: "normal" | "lighter";
}
export interface ProgressionInput {
  name: string;
  exercise: Exercise;
  history: SessionPerformance[]; // most recent first; only sessions where ≥1 set was completed
  today: string;
  availableWeights: number[];
  hasBands: boolean;
  maxSets: number;
  nextVariationId?: string | null;
  /** Latest readiness check-in outcomes, most recent first (max 2 used). */
  recentReadiness?: { energy: string; muscles: string }[];
}
export type Rec = Omit<ProgressionRecommendation, "id" | "createdAt" | "updatedAt" | "sessionId" | "exerciseId" | "ruleVersion">;

const done = (s: SessionPerformance) => s.sets.filter((x) => x.completed);
export function workingWeight(s: SessionPerformance): number | null {
  const ws = done(s).map((x) => x.weight).filter((w): w is number => w != null && w > 0);
  return ws.length ? Math.max(...ws) : null;
}
const allSetsDone = (s: SessionPerformance) => done(s).length >= s.prescribedSets;
const repsOf = (s: SessionPerformance) => done(s).map((x) => x.reps ?? 0);
const atTop = (s: SessionPerformance) => allSetsDone(s) && repsOf(s).every((r) => r >= s.repMax);
const anyBelowMin = (s: SessionPerformance) => done(s).some((x) => (x.reps ?? 0) < s.repMin);
const hardCount = (s: SessionPerformance, e: Effort) => done(s).filter((x) => x.effort === e).length;
const effortManageable = (s: SessionPerformance) => hardCount(s, "very_hard") === 0 && hardCount(s, "challenging") <= 1;
const hadDiscomfort = (s: SessionPerformance, lvl: SetDiscomfort) =>
  s.discomfort === lvl || s.sets.some((x) => x.discomfort === lvl);
const sameWeight = (a: number | null, b: number | null) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 1e-9);

function rec(action: ProgressionAction, title: string, message: string, explanation: string[], proposed: Proposed | null, alternatives: ProgressionAlternative[] = [], needsDecision = false): Rec {
  return { action, title, message, explanation, proposed, alternatives, needsDecision };
}

export function evaluateProgression(i: ProgressionInput): Rec {
  const ex = i.exercise;
  const unit = ex.loadType === "timed" ? "seconds" : "repetitions";
  const why: string[] = [];
  const h = i.history;
  if (h.length === 0) {
    return rec("calibrate", "Finding your starting point",
      `Jo, this is your first time with ${ex.name}. Start light and find a weight you could lift about 10 times with at least 3 repetitions to spare.`,
      ["No previous sessions for this exercise, so we use a short calibration rather than guessing a weight."], null);
  }
  const last = h[0]!;
  const prev = h[1];
  const cur = workingWeight(last);
  why.push(`Latest session (${last.date}): ${done(last).length} of ${last.prescribedSets} sets completed${cur != null ? ` at ${formatKg(cur)}` : ""}.`);

  // Rule 1 – discomfort overrides everything
  if (hadDiscomfort(last, "concerning")) {
    why.push("You reported concerning discomfort, so no increases are suggested.");
    return rec("consult", "Let's hold here for now",
      `Jo, you noted some discomfort with ${ex.name}. We won't increase anything. If it continues, it's worth checking in with a doctor or physiotherapist, and you can choose an easier alternative.`,
      why, null, ex.regressions[0] ? [{ label: "Try an easier version", proposed: { exerciseId: ex.regressions[0] } }] : [], false);
  }

  // Rule 2 – time off: return gently, never as a penalty
  const gap = diffDays(i.today, last.date);
  if (gap >= BREAK_DAYS) {
    why.push(`It has been ${gap} days since you last did this exercise.`);
    const lighter = cur != null && gap >= LONG_BREAK_DAYS ? nextLighter(i.availableWeights, cur) : null;
    const sets = Math.max(1, last.prescribedSets - 1);
    const p: Proposed = { weight: lighter ?? cur, sets };
    const msg = lighter != null
      ? `Welcome back, ${i.name}! After a break it's sensible to ease in: try ${formatKg(lighter)} for ${sets} ${sets === 1 ? "set" : "sets"}. You'll be back to your usual in no time.`
      : `Welcome back, ${i.name}! After a break, ${sets} ${sets === 1 ? "set" : "sets"} at your usual weight is a lovely way to ease in.`;
    return rec("return_gently", "An easy return", msg, why, p,
      [{ label: "Keep my usual plan", proposed: { weight: cur, sets: last.prescribedSets } }], true);
  }

  // Rule 3 – too heavy (self-reported, reps under range, very hard, or repeated incomplete sets)
  const incompleteTwice = prev && !allSetsDone(last) && !allSetsDone(prev);
  if (last.tooHeavy || anyBelowMin(last) || hardCount(last, "very_hard") > 0 || incompleteTwice) {
    why.push(last.tooHeavy ? "You told us this weight felt too heavy." :
      hardCount(last, "very_hard") > 0 ? "At least one set felt very hard." :
      incompleteTwice ? "Some sets were incomplete in two sessions in a row." : `Some sets were under ${last.repMin} ${unit}.`);
    const lighter = cur != null ? nextLighter(i.availableWeights, cur) : null;
    const easier = ex.regressions[0];
    const alts: ProgressionAlternative[] = [];
    if (easier) alts.push({ label: "Try an easier version of this exercise", proposed: { exerciseId: easier } });
    alts.push({ label: "Keep the same weight for another session", proposed: { weight: cur } });
    if (lighter != null) {
      return rec("decrease_weight", "A lighter weight might feel better",
        `Jo, ${formatKg(cur)} felt like a lot. Choosing ${formatKg(lighter)} is a smart way to keep your technique strong. Your history is safe and this is not a step backwards.`,
        why, { weight: lighter }, alts, true);
    }
    return rec("hold", "Let's build comfort first",
      `Jo, there's no lighter weight on your list, so let's focus on smooth, controlled repetitions${easier ? " or try an easier version" : ""}. Add a lighter weight in Settings if you have one.`,
      why, null, alts, false);
  }

  // Concern flags that stop progress without being a problem
  if (hadDiscomfort(last, "mild")) {
    why.push("You noted mild discomfort, so we'll hold the load steady and keep an eye on it.");
    return rec("hold", "Steady as you go", `Jo, you mentioned mild discomfort, so let's keep ${ex.name} just as it is next time.`, why, null);
  }
  if (last.technique === "unsure") {
    why.push("Your technique confidence was low, so we won't increase anything yet.");
    return rec("hold", "Let's get comfortable first", `Jo, let's keep practising ${ex.name} with the same load until it feels more natural. The exercise page has step-by-step guidance.`, why, null);
  }
  const rd = (i.recentReadiness ?? []).slice(0, 2);
  if (rd.length === 2 && rd.every((r) => r.energy === "very_tired" || r.muscles === "quite_sore")) {
    why.push("Your last two check-ins showed tiredness or soreness, so progression is paused.");
    return rec("hold", "Recovery comes first", "Jo, you've been feeling tired or sore lately. Let's keep things steady until you feel recovered.", why, null);
  }

  // Evidence required: ≥2 consecutive sessions at the same working weight
  let runLength = 1;
  for (let k = 1; k < h.length; k++) {
    if (sameWeight(workingWeight(h[k]!), cur)) runLength++; else break;
  }
  const lastQualifies = allSetsDone(last) && atTop(last) && effortManageable(last);
  const prevQualifies = !!prev && sameWeight(workingWeight(prev), cur) && allSetsDone(prev) && !anyBelowMin(prev) && hardCount(prev, "very_hard") === 0 && prev.technique !== "unsure";

  if (!lastQualifies) {
    if (!allSetsDone(last)) {
      why.push("Not every planned set was completed – that's fine, we just repeat.");
      return rec("hold", "Same again next time", `Jo, let's repeat ${ex.name} as it is. Completing every set comfortably comes first.`, why, null);
    }
    if (!atTop(last)) {
      const lowest = Math.min(...repsOf(last));
      const target = Math.min(last.repMax, lowest + 1);
      why.push(`Lowest set was ${lowest} ${unit}; the aim is ${last.repMax} on every set.`);
      return rec("increase_reps", "Aim for one more repetition",
        `Jo, next time aim for ${target} ${unit} on each set${cur != null ? ` at ${formatKg(cur)}` : ""}. Small steps add up.`, why, { weight: cur, targetReps: target });
    }
    why.push("Top of the range was reached, but effort felt demanding. We'll wait until it feels more comfortable.");
    return rec("hold", "Keep building comfort", `Jo, you reached ${last.repMax} ${unit}. Stay here until it feels more comfortable, then we'll look at a next step.`, why, null);
  }
  why.push(`Every set reached ${last.repMax} ${unit} with manageable effort.`);

  if (!prevQualifies || runLength < 2) {
    why.push("We need at least two sessions at this level before suggesting a change, so a single good session is never enough.");
    return rec("insufficient_evidence", "Nearly there",
      `Jo, great session! Repeat this once more${cur != null ? ` at ${formatKg(cur)}` : ""} and we'll know if you're ready for a next step.`, why, null);
  }
  why.push(`The session before also went well at ${cur != null ? formatKg(cur) : "this level"}.`);

  // Do not raise load and volume together: wait if volume rose recently
  if (prev && last.prescribedSets > prev.prescribedSets) {
    why.push("You recently added a set. We keep load and volume changes apart, so let's settle first.");
    return rec("hold", "Settle in first", "Jo, you recently did more sets. Let's let that settle for a session before changing anything else.", why, null);
  }

  // Weighted path
  if (cur != null && ex.loadType === "dumbbell") {
    const heavier = nextHeavier(i.availableWeights, cur);
    if (heavier != null) {
      const jump = heavier - cur;
      const alts: ProgressionAlternative[] = [];
      if (last.prescribedSets < i.maxSets) alts.push({ label: `Add one set instead (${last.prescribedSets + 1} sets at ${formatKg(cur)})`, proposed: { weight: cur, sets: last.prescribedSets + 1 } });
      alts.push({ label: `Stay at ${formatKg(cur)} for now`, proposed: { weight: cur } });
      if (jump <= MAX_COMFORTABLE_JUMP_KG + 1e-9) {
        why.push(`The next available weight is ${formatKg(heavier)} (+${formatKg(jump)}), a modest step.`);
        return rec("increase_weight", "Ready for a small step up?",
          `Jo, you've been handling ${formatKg(cur)} comfortably. Would you like to try ${formatKg(heavier)} next time?`,
          why, { weight: heavier, targetReps: last.repMin }, alts, true);
      }
      why.push(`The next available weight (${formatKg(heavier)}) is a big jump of ${formatKg(jump)}, so gentler options come first.`);
      if (last.prescribedSets < i.maxSets) {
        return rec("add_set", "Add a set before adding weight",
          `Jo, ${formatKg(heavier)} would be a big jump from ${formatKg(cur)}. How about an extra set at ${formatKg(cur)} first?`,
          why, { weight: cur, sets: last.prescribedSets + 1 },
          [{ label: `Try ${formatKg(heavier)} anyway`, proposed: { weight: heavier, targetReps: last.repMin } }, { label: `Stay at ${formatKg(cur)}`, proposed: { weight: cur } }], true);
      }
      return rec("hold", "Strong and steady",
        `Jo, you're doing really well at ${formatKg(cur)}. The next dumbbell on your list is a big step, so keep building quality here – or choose to try ${formatKg(heavier)} if you feel ready.`,
        why, null, [{ label: `Try ${formatKg(heavier)}`, proposed: { weight: heavier, targetReps: last.repMin } }], false);
    }
    why.push("There's no heavier weight on your equipment list.");
  }

  // Non-weight routes: more volume, a variation, or a firmer band
  if (last.prescribedSets < i.maxSets) {
    return rec("add_set", "Ready for another set?",
      `Jo, you've been completing ${last.prescribedSets} ${last.prescribedSets === 1 ? "set" : "sets"} of ${ex.name} comfortably. Would you like to try ${last.prescribedSets + 1} next time?`,
      why, { weight: cur, sets: last.prescribedSets + 1 }, [{ label: "Stay with my current sets", proposed: { weight: cur } }], true);
  }
  if (ex.loadType === "band" && i.hasBands) {
    return rec("next_band", "Try a firmer band?", `Jo, ${ex.name} is feeling comfortable. If you have a firmer band, you could try it next time.`, why, null, [{ label: "Keep my current band", proposed: {} }], true);
  }
  if (i.nextVariationId && last.technique === "confident" && prev?.technique === "confident") {
    return rec("suggest_variation", "A new challenge, if you like",
      `Jo, you've been confident with ${ex.name}. There's a slightly more challenging version you could explore – it's optional.`,
      [...why, "Technique confidence was high in two sessions."], { exerciseId: i.nextVariationId }, [{ label: "Stay with this exercise", proposed: {} }], true);
  }
  return rec("hold", "Lovely and steady", `Jo, ${ex.name} is going really well. Staying here is perfectly good – consistency is what builds strength.`, why, null);
}

/** After a first, calibrating set: advice for the next set within the same session. */
export function calibrationAdvice(effort: Effort | undefined, weight: number | null, weights: number[]): { message: string; suggestedWeight: number | null } {
  if (weight == null) return { message: "Great start. Keep your movements smooth and controlled.", suggestedWeight: null };
  const ws = normaliseWeights(weights);
  if (effort === "easy") {
    const up = nextHeavier(ws, weight);
    return up != null
      ? { message: `That felt easy. You could try ${formatKg(up)} for your next set – or stay put, it's your call.`, suggestedWeight: up }
      : { message: "That felt easy. Focus on slow, controlled repetitions.", suggestedWeight: weight };
  }
  if (effort === "challenging" || effort === "very_hard") {
    const down = nextLighter(ws, weight);
    return down != null
      ? { message: `That felt like a lot. ${formatKg(down)} may be a better starting point – there's no rush.`, suggestedWeight: down }
      : { message: "That felt demanding. Take your time and keep the movement smooth.", suggestedWeight: weight };
  }
  return { message: "That sounds like a great starting weight.", suggestedWeight: weight };
}

/** Weight to pre-fill: Jo's accepted target, else the last weight she used, else nothing (calibration). */
export function suggestedWeight(target: number | null | undefined, lastUsed: number | null | undefined): number | null {
  if (target != null) return target;
  return lastUsed ?? null;
}

// ---------------------------------------------------------------- Week review
export interface WeekReviewInput {
  plannedSessions: number; completedSessions: number; concerningDiscomfort: boolean;
  veryHardSets: number; daysSinceLastSession: number | null; weekNumber: number;
}
export interface WeekReview { action: "advance" | "repeat" | "ease"; title: string; message: string; reasons: string[]; }
/** Never advance a week (or phase) just because the calendar moved. Jo confirms the outcome. */
export function reviewWeek(w: WeekReviewInput): WeekReview {
  const reasons: string[] = [`${w.completedSessions} of ${w.plannedSessions} planned sessions completed.`];
  if (w.daysSinceLastSession != null && w.daysSinceLastSession >= BREAK_DAYS) {
    return { action: "ease", title: "Ease back in", message: "It's been a little while – there's no catch-up needed. Let's repeat an easier week and settle back in.", reasons: [...reasons, `${w.daysSinceLastSession} days since your last session.`] };
  }
  if (w.concerningDiscomfort) {
    return { action: "repeat", title: "Repeat this week", message: "You noted some discomfort, so repeating this week gives your body time to settle.", reasons: [...reasons, "Concerning discomfort was reported."] };
  }
  if (w.completedSessions >= w.plannedSessions && w.plannedSessions > 0 && w.veryHardSets === 0) {
    return { action: "advance", title: "Ready for the next week?", message: "You completed this week comfortably. Move on when it feels right to you.", reasons };
  }
  if (w.completedSessions === 0) {
    return { action: "repeat", title: "A fresh start this week", message: "No problem at all – life gets busy. Repeating the week keeps things manageable.", reasons };
  }
  return { action: "repeat", title: "Repeat this week", message: "Repeating the week is a great way to build confidence before moving on.", reasons: w.veryHardSets ? [...reasons, "Some sets felt very hard."] : reasons };
}
