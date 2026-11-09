import { randomUUID } from "node:crypto";
import type { EntityName } from "@/lib/domain/schemas";

const NOW = "2026-11-09T01:00:00.000Z";
export interface Samples { [k: string]: { id: string; record: Record<string, unknown> } }
/** One schema-valid record per synced entity, wired together with consistent ids. */
export function samples(): Record<EntityName, { id: string; record: Record<string, unknown> }> {
  const sessionId = randomUUID(), recId = randomUUID(), seId = randomUUID(), progId = randomUUID(), checkId = randomUUID();
  return {
    profile: { id: "self", record: { name: "Jo", experience: "new", activityLevel: "light", movementConfidence: 3, updatedAt: NOW } },
    preferences: { id: "self", record: { timezone: "Australia/Melbourne", trainingDays: [1, 4], trainingTime: "09:00", daysPerWeek: 3, sessionMinutes: 45, restSeconds: 60, theme: "system", textScale: 100, highContrast: false, reducedMotion: "system", sound: false, vibration: true, photosEnabled: false, updatedAt: NOW } },
    equipment: { id: "self", record: { items: ["mat", "chair", "light_dumbbells"], dumbbellWeightsKg: [1, 2, 3], bandLevels: [], other: "", updatedAt: NOW } },
    health: { id: "self", record: { mobility: "good", chairRise: "easy", armsOverhead: "full", balance: "confident", backDiscomfort: "none", kneeDiscomfort: "occasional", shoulderDiscomfort: "none", previousInjuries: "Sprained ankle 2019", conditions: "", hasProfessionalRestrictions: false, clearanceAcknowledged: false, answered: true, updatedAt: NOW } },
    goals: { id: "self", record: { priorities: ["build_muscle", "balance"], personalNote: "Carry shopping easily", updatedAt: NOW } },
    notifications: { id: "self", record: { enabled: false, days: [1, 4], time: "09:00", quietStart: "21:00", quietEnd: "07:00", dayBefore: true, updatedAt: NOW } },
    program: { id: progId, record: { id: progId, createdAt: NOW, startDate: "2026-11-09", currentWeek: 1, templates: [{ letter: "A", name: "Workout A", slots: [{ slot: "squat", exerciseId: "chair-squat" }] }], screening: { status: "ok", reasons: [], modifications: [] }, exerciseTargets: { "dumbbell-curl": { weight: 2, updatedAt: NOW } }, updatedAt: NOW } },
    scheduled: { id: randomUUID(), record: { id: "", date: "2026-11-09", letter: "A", week: 1, status: "planned", updatedAt: NOW } },
    checkins: { id: checkId, record: { id: checkId, date: "2026-11-09", energy: "good", muscles: "recovered", pain: "none", outcome: "normal", createdAt: NOW, updatedAt: NOW } },
    sessions: { id: sessionId, record: { id: sessionId, letter: "A", date: "2026-11-09", week: 1, phase: "foundation", mode: "normal", status: "completed", startedAt: NOW, endedAt: NOW, totalPausedMs: 0, exercises: [{ id: seId, exerciseId: "chair-squat", slot: "squat", targetSets: 1, repMin: 8, repMax: 12, targetWeight: null, status: "done" }], currentIndex: 0, rest: null, updatedAt: NOW } },
    sets: { id: randomUUID(), record: { id: "", sessionId, sessionExerciseId: seId, exerciseId: "chair-squat", setIndex: 0, weight: null, reps: 10, completed: true, effort: "comfortable", completedAt: NOW, updatedAt: NOW } },
    recommendations: { id: recId, record: { id: recId, exerciseId: "dumbbell-curl", action: "hold", title: "Steady", message: "Jo, keep going.", explanation: ["rule a"], proposed: null, alternatives: [], needsDecision: false, ruleVersion: "2026.1", createdAt: NOW, updatedAt: NOW } },
    decisions: { id: randomUUID(), record: { id: "", recommendationId: recId, exerciseId: "dumbbell-curl", decision: "accepted", chosen: { weight: 3 }, decidedAt: NOW, updatedAt: NOW } },
    milestones: { id: randomUUID(), record: { id: "", key: "first_session", achievedAt: NOW, updatedAt: NOW } },
    journal: { id: randomUUID(), record: { id: "", date: "2026-11-09", feeling: "Felt strong", enjoyed: ["Glute bridge"], disliked: [], achievement: "Finished my first week", goal: "", mobilityNote: "", sharedWithSupporter: false, createdAt: NOW, updatedAt: NOW } },
  };
}
let cached: ReturnType<typeof samples> | null = null;
/** Stable across calls within one test run so "Jo's record id" means the same record everywhere. */
export function withIds() {
  if (cached) return cached;
  const s = samples();
  for (const k of ["scheduled", "sets", "decisions", "milestones", "journal"] as const) s[k].record.id = s[k].id;
  return (cached = s);
}
