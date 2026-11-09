import { mustExercise } from "@/lib/domain/exercises";
import type { SessionPerformance, PerfSet } from "@/lib/domain/progression";
import type { EquipmentInventory, HealthConsiderations, Preferences, Profile, FitnessGoals } from "@/lib/domain/types";

const NOW = "2026-11-09T00:00:00.000Z";
export const inv = (items: EquipmentInventory["items"], weights: number[] = []): EquipmentInventory => ({ items, dumbbellWeightsKg: weights, bandLevels: [], other: "", updatedAt: NOW });
export const health = (o: Partial<HealthConsiderations> = {}): HealthConsiderations => ({
  mobility: "good", chairRise: "easy", armsOverhead: "full", balance: "confident", backDiscomfort: "none", kneeDiscomfort: "none",
  shoulderDiscomfort: "none", previousInjuries: "", conditions: "", hasProfessionalRestrictions: false, clearanceAcknowledged: false, answered: true, updatedAt: NOW, ...o,
});
export const profile = (): Profile => ({ name: "Jo", experience: "new", activityLevel: "light", movementConfidence: 3, updatedAt: NOW });
export const prefs = (o: Partial<Preferences> = {}): Preferences => ({
  timezone: "Australia/Melbourne", trainingDays: [1, 4], trainingTime: "09:00", daysPerWeek: 3, sessionMinutes: 45, restSeconds: 60, theme: "system",
  textScale: 100, highContrast: false, reducedMotion: "system", sound: false, vibration: true, photosEnabled: false, updatedAt: NOW, ...o,
});
export const goals = (): FitnessGoals => ({ priorities: ["build_muscle"], personalNote: "", updatedAt: NOW });
export const curl = () => mustExercise("dumbbell-curl");

export function perf(date: string, weight: number, reps: number[], o: Partial<SessionPerformance> & { effort?: PerfSet["effort"] } = {}): SessionPerformance {
  const { effort, ...rest } = o;
  return {
    sessionId: `s-${date}`, date, prescribedSets: reps.length, repMin: 8, repMax: 12,
    sets: reps.map((r) => ({ weight, reps: r, completed: true, effort: effort ?? "comfortable" })), technique: "ok", discomfort: "none", ...rest,
  };
}
