import { canDo } from "./equipment";
import { getExercise, mustExercise } from "./exercises";
import type {
  BodyArea, Discomfort, EquipmentInventory, Exercise, ExerciseTarget, FitnessGoals, HealthConsiderations,
  PhaseKey, Preferences, Profile, Program, Screening, SlotChoice, SlotKey, WeekPlan, WorkoutLetter, WorkoutTemplate,
} from "./types";

export const PROGRAM_WEEKS = 12;

/** Ordered easiest → most challenging options per slot. The first available, suitable option is the start. */
export const SLOT_OPTIONS: Record<SlotKey, string[]> = {
  squat: ["chair-squat", "sit-to-stand-hands", "bodyweight-squat", "goblet-squat"],
  row: ["supported-db-row", "band-row", "bench-row"],
  push: ["wall-push-up", "incline-push-up", "floor-push-up", "dumbbell-floor-press"],
  bridge: ["glute-bridge", "loaded-glute-bridge", "single-leg-bridge"],
  core_a: ["dead-bug", "marching-bridge-hold", "wall-plank"],
  hinge: ["dumbbell-rdl", "hip-hinge"],
  press: ["seated-shoulder-press", "band-shoulder-press", "lateral-raise"],
  stepup: ["supported-low-step-up", "split-squat-supported", "step-up"],
  curl: ["dumbbell-curl", "band-curl", "hammer-curl"],
  core_b: ["bird-dog", "dead-bug", "marching-bridge-hold"],
  calf: ["calf-raise-supported", "single-leg-calf-raise"],
  extra_pull: ["band-pull-apart", "reverse-fly", "band-row"],
};

/** The designated start exercise for each slot (Workout A / B in the programme brief). */
const SLOT_DEFAULT: Record<SlotKey, string> = {
  squat: "chair-squat", row: "supported-db-row", push: "wall-push-up", bridge: "glute-bridge", core_a: "dead-bug",
  hinge: "dumbbell-rdl", press: "seated-shoulder-press", stepup: "supported-low-step-up", curl: "dumbbell-curl",
  core_b: "bird-dog", calf: "calf-raise-supported", extra_pull: "band-pull-apart",
};
/** Alternatives tried (in order) when the default is unavailable or flagged. */
const SLOT_FALLBACKS: Record<SlotKey, string[]> = {
  squat: ["sit-to-stand-hands", "bodyweight-squat"],
  row: ["band-row", "band-pull-apart"],
  push: ["incline-push-up", "dumbbell-floor-press"],
  bridge: ["glute-bridge"],
  core_a: ["marching-bridge-hold", "wall-plank"],
  hinge: ["hip-hinge", "glute-bridge"],
  press: ["band-shoulder-press", "lateral-raise"],
  stepup: ["split-squat-supported", "calf-raise-supported"],
  curl: ["band-curl", "hammer-curl"],
  core_b: ["dead-bug", "marching-bridge-hold", "wall-plank"],
  calf: ["single-leg-calf-raise"],
  extra_pull: ["band-row", "reverse-fly"],
};

const A_SLOTS: SlotKey[] = ["squat", "row", "push", "bridge", "core_a"];
const B_SLOTS: SlotKey[] = ["hinge", "press", "stepup", "curl", "core_b"];
const OPTIONAL_SLOTS: { slot: SlotKey; letter: WorkoutLetter }[] = [
  { slot: "extra_pull", letter: "A" },
  { slot: "calf", letter: "B" },
];

export const PHASE_LABELS: Record<PhaseKey, { name: string; blurb: string }> = {
  foundation: { name: "Foundation", blurb: "Learn the movements, build confidence and settle into a rhythm." },
  building: { name: "Building Strength", blurb: "Add a little more consistency and modest resistance." },
  development: { name: "Muscle Development", blurb: "Build overall strength with steady, sustainable progress." },
  ongoing: { name: "Ongoing Strength", blurb: "Keep building at your own pace. There is no finish line." },
};

export function phaseForWeek(week: number): PhaseKey {
  if (week <= 4) return "foundation";
  if (week <= 8) return "building";
  if (week <= 12) return "development";
  return "ongoing";
}

/** Planned structure for a given programme week, limited by Jo's days available. */
export function weekPlan(week: number, daysPerWeek: number): WeekPlan {
  const w = Math.max(1, Math.floor(week));
  const phase = phaseForWeek(w);
  const cap = Math.max(1, Math.min(7, daysPerWeek));
  switch (phase) {
    case "foundation":
      return { week: w, phase, sessions: Math.min(2, cap), sets: w <= 2 ? 1 : 2, maxSets: 2, repRange: [8, 12],
        note: w <= 2 ? "One set of each exercise. Leave plenty in reserve." : "Move towards two sets only if it feels comfortable." };
    case "building":
      return { week: w, phase, sessions: Math.min(3, cap), sets: 2, maxSets: 2, repRange: [8, 12],
        note: "Up to three sessions a week if you feel ready. Two sessions is perfectly good." };
    case "development":
      return { week: w, phase, sessions: Math.min(3, cap), sets: w <= 10 ? 2 : 3, maxSets: 3, repRange: [8, 12],
        note: "Two to three sets, depending on how you tolerate it." };
    default:
      return { week: w, phase, sessions: Math.min(3, cap), sets: 2, maxSets: 3, repRange: [8, 12],
        note: "Keep going at a level that feels sustainable." };
  }
}

// ---------------------------------------------------------------- Screening
export function screen(h: HealthConsiderations): Screening {
  const reasons: string[] = [];
  const modifications: string[] = [];
  let status: Screening["status"] = "ok";
  const bump = (to: Screening["status"]) => {
    const order = { ok: 0, caution: 1, clearance_recommended: 2 } as const;
    if (order[to] > order[status]) status = to;
  };
  if (!h.answered) return { status: "ok", reasons: [], modifications: ["No health questions were answered, so the programme starts with the gentlest options."] };

  if (h.hasProfessionalRestrictions) {
    bump("clearance_recommended");
    reasons.push("You mentioned professional exercise restrictions. Please check this plan with your doctor or physiotherapist before starting, and follow their advice first.");
  }
  if (h.chairRise === "difficult" && h.balance === "not_confident") {
    bump("clearance_recommended");
    reasons.push("Standing from a chair and balancing both feel difficult right now. A physiotherapist or doctor can tailor a safe starting point for you.");
  }
  if (h.chairRise === "difficult") { bump("caution"); modifications.push("Sit-to-stand with hand support replaces chair squats at first."); }
  if (h.balance !== "confident") { bump("caution"); modifications.push("Balance exercises are held next to a counter or wall, and step-ups are replaced with supported options."); }
  if (h.armsOverhead !== "full") { bump("caution"); modifications.push("Overhead pressing is replaced with lower-range options."); }
  if (h.mobility === "limited") { bump("caution"); modifications.push("Movements are kept to a comfortable range."); }
  const area = (label: string, d: Discomfort) => {
    if (d === "occasional") { bump("caution"); modifications.push(`${label} discomfort noted: exercises that load the ${label.toLowerCase()} are replaced or flagged for extra care.`); }
    if (d === "frequent") {
      bump("clearance_recommended");
      reasons.push(`You reported frequent ${label.toLowerCase()} discomfort. It is a good idea to have it checked by a health professional before progressing.`);
      modifications.push(`Exercises that load the ${label.toLowerCase()} are avoided where there is an alternative.`);
    }
  };
  area("Back", h.backDiscomfort); area("Knee", h.kneeDiscomfort); area("Shoulder", h.shoulderDiscomfort);
  return { status, reasons, modifications };
}

const OVERHEAD = ["seated-shoulder-press", "standing-shoulder-press", "triceps-extension"];

function areaLevel(h: HealthConsiderations, a: BodyArea): Discomfort {
  if (!h.answered) return "none";
  if (a === "back") return h.backDiscomfort;
  if (a === "knee") return h.kneeDiscomfort;
  if (a === "shoulder") return h.shoulderDiscomfort;
  return "none";
}

/** Exercises that must not be prescribed given confirmed equipment and what Jo told us. */
export function hardExcluded(ex: Exercise, inv: EquipmentInventory, h: HealthConsiderations): boolean {
  if (!canDo(ex, inv)) return true;
  if (!h.answered) return ex.difficulty > 2; // skipped questions: stay conservative
  if (ex.cautions.some((c) => areaLevel(h, c) === "frequent")) return true;
  if (h.balance === "not_confident" && ex.cautions.includes("balance") && ex.difficulty > 1) return true;
  if (h.armsOverhead !== "full" && OVERHEAD.includes(ex.id)) return true;
  if (h.chairRise === "difficult" && ex.id === "chair-squat") return true;
  return false;
}
/** Allowed but worth flagging with extra care. */
export function softFlagged(ex: Exercise, h: HealthConsiderations): boolean {
  if (!h.answered) return false;
  if (ex.cautions.some((c) => areaLevel(h, c) === "occasional")) return true;
  return h.balance === "somewhat" && ex.cautions.includes("balance") && ex.difficulty > 1;
}
const suitable = (ex: Exercise, inv: EquipmentInventory, h: HealthConsiderations) => !hardExcluded(ex, inv, h);

/** Choose an exercise for a slot using only confirmed equipment and safe options. Null = no suitable option. */
export function pickForSlot(slot: SlotKey, inv: EquipmentInventory, h: HealthConsiderations): string | null {
  const exs = [SLOT_DEFAULT[slot], ...SLOT_FALLBACKS[slot]].map(getExercise).filter((e): e is Exercise => !!e && suitable(e, inv, h));
  return (exs.find((e) => !softFlagged(e, h)) ?? exs[0])?.id ?? null;
}

/** All exercises Jo could swap in for a slot (same slot family, available + suitable). */
export function alternativesForSlot(slot: SlotKey, inv: EquipmentInventory, h: HealthConsiderations): Exercise[] {
  return SLOT_OPTIONS[slot].map((id) => getExercise(id)).filter((e): e is Exercise => !!e && suitable(e, inv, h));
}

// ---------------------------------------------------------------- Templates
export function buildTemplates(inv: EquipmentInventory, h: HealthConsiderations, previous?: WorkoutTemplate[]): { templates: WorkoutTemplate[]; notes: string[] } {
  const notes: string[] = [];
  const make = (letter: WorkoutLetter, slots: SlotKey[]): WorkoutTemplate => {
    const choices: SlotChoice[] = [];
    for (const slot of slots) {
      const kept = previous?.find((t) => t.letter === letter)?.slots.find((s) => s.slot === slot && s.custom);
      if (kept && suitable(mustExercise(kept.exerciseId), inv, h)) { choices.push(kept); continue; }
      const id = pickForSlot(slot, inv, h);
      if (id) choices.push({ slot, exerciseId: id });
      else notes.push(`No suitable ${slot.replace("_", " ")} exercise matched your equipment and comfort, so it was left out of Workout ${letter}.`);
    }
    for (const opt of OPTIONAL_SLOTS.filter((o) => o.letter === letter)) {
      const id = pickForSlot(opt.slot, inv, h);
      if (id) choices.push({ slot: opt.slot, exerciseId: id, optional: true });
    }
    return { letter, name: `Workout ${letter}`, slots: choices };
  };
  return { templates: [make("A", A_SLOTS), make("B", B_SLOTS)], notes };
}

export function estimateMinutes(template: WorkoutTemplate, sets: number, includeOptional = false): number {
  let sec = 5 * 60; // gentle warm-up and set-up
  for (const s of template.slots) {
    if (s.optional && !includeOptional) continue;
    const e = mustExercise(s.exerciseId);
    const reps = (e.repRange[0] + e.repRange[1]) / 2;
    const work = e.loadType === "timed" ? reps : reps * 3.5 * (e.perSide ? 2 : 1);
    sec += sets * (work + e.restSeconds + 15);
  }
  return Math.round(sec / 60);
}

/** Largest set count (≤ planned) that fits the time Jo has available. Never below 1. */
export function setsThatFit(template: WorkoutTemplate, plannedSets: number, availableMinutes: number): number {
  for (let s = plannedSets; s > 1; s--) if (estimateMinutes(template, s) <= availableMinutes) return s;
  return 1;
}

// ---------------------------------------------------------------- Programme
export interface GenerateInput {
  profile: Profile; preferences: Preferences; equipment: EquipmentInventory;
  health: HealthConsiderations; goals: FitnessGoals; now: string; startDate: string; id: string;
}

export function generateProgram(i: GenerateInput): Program {
  const { templates } = buildTemplates(i.equipment, i.health);
  return {
    id: i.id, createdAt: i.now, updatedAt: i.now, startDate: i.startDate, currentWeek: 1,
    templates, screening: screen(i.health), exerciseTargets: {},
  };
}

/** Everything the "Jo, your strength journey starts here." screen needs. */
export function programOverview(p: Program, prefs: Preferences, equipment: EquipmentInventory) {
  const wp = weekPlan(1, prefs.daysPerWeek);
  const sets = setsThatFit(p.templates[0]!, wp.sets, prefs.sessionMinutes);
  return {
    startingPhase: PHASE_LABELS.foundation,
    sessionsPerWeek: wp.sessions,
    estimatedMinutes: Math.max(...p.templates.map((t) => estimateMinutes(t, sets))),
    sets,
    exercises: p.templates.map((t) => ({ letter: t.letter, items: t.slots.map((s) => ({ ...s, exercise: mustExercise(s.exerciseId) })) })),
    startingResistance:
      equipment.dumbbellWeightsKg.length || equipment.items.includes("bands")
        ? "You will find your starting weights in your first session. Choose a weight you could lift about 10 times with at least 3 repetitions left in reserve – lighter is always fine."
        : "You will begin with bodyweight movements. Add weights in Settings any time to unlock weighted exercises.",
    recoveryNote: "Leave at least one full day between strength sessions. Rest days are when your muscles adapt.",
    progression:
      "Progress is based on how you actually perform. When you complete all sets at the top of the range with good technique and manageable effort over more than one session, JoStrong will suggest a small step up – and you decide whether to take it.",
  };
}

export function targetFor(program: Program | null, exerciseId: string): ExerciseTarget | undefined {
  return program?.exerciseTargets[exerciseId];
}
