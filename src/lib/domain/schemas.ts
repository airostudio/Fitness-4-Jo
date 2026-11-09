import { z } from "zod";
import { isValidTimezone } from "./dates";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const ts = z.string().min(10).max(40);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const id = z.string().uuid();
const exId = z.string().min(1).max(64);
const text = (n: number) => z.string().max(n);
const rating = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const discomfort = z.enum(["none", "occasional", "frequent"]);

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Please enter a name").max(40),
  dateOfBirth: date.optional(),
  heightCm: z.number().min(80).max(250).optional(),
  weightKg: z.number().min(20).max(300).optional(),
  experience: z.enum(["new", "little", "regular_past", "returning"]),
  activityLevel: z.enum(["mostly_sitting", "light", "moderate", "active"]),
  movementConfidence: rating,
  onboardedAt: ts.optional(),
  updatedAt: ts,
}).strict();

export const preferencesSchema = z.object({
  timezone: z.string().refine(isValidTimezone, "Unknown timezone"),
  trainingDays: z.array(z.number().int().min(1).max(7)).max(7),
  trainingTime: hhmm,
  daysPerWeek: z.number().int().min(1).max(7),
  sessionMinutes: z.number().int().min(10).max(120),
  restSeconds: z.number().int().min(15).max(300),
  theme: z.enum(["system", "light", "dark"]),
  textScale: z.union([z.literal(100), z.literal(115), z.literal(130)]),
  highContrast: z.boolean(),
  reducedMotion: z.enum(["system", "on", "off"]),
  sound: z.boolean(), vibration: z.boolean(), photosEnabled: z.boolean(),
  updatedAt: ts,
}).strict();

export const equipmentSchema = z.object({
  items: z.array(z.enum(["none", "mat", "chair", "bands", "light_dumbbells", "adjustable_dumbbells", "bench", "step", "other"])).max(9),
  dumbbellWeightsKg: z.array(z.number().positive().max(60)).max(40),
  bandLevels: z.array(text(30)).max(10),
  other: text(200),
  updatedAt: ts,
}).strict();

export const healthSchema = z.object({
  mobility: z.enum(["good", "some", "limited"]),
  chairRise: z.enum(["easy", "effort", "difficult"]),
  armsOverhead: z.enum(["full", "partial", "no"]),
  balance: z.enum(["confident", "somewhat", "not_confident"]),
  backDiscomfort: discomfort, kneeDiscomfort: discomfort, shoulderDiscomfort: discomfort,
  previousInjuries: text(500), conditions: text(500),
  hasProfessionalRestrictions: z.boolean(), clearanceAcknowledged: z.boolean(), answered: z.boolean(),
  updatedAt: ts,
}).strict();

export const goalsSchema = z.object({
  priorities: z.array(z.enum(["build_muscle", "everyday_strength", "balance", "posture_mobility", "confidence", "general_fitness", "independence"])).max(7),
  personalNote: text(500), updatedAt: ts,
}).strict();

export const notificationSchema = z.object({
  enabled: z.boolean(), days: z.array(z.number().int().min(1).max(7)).max(7), time: hhmm,
  quietStart: hhmm, quietEnd: hhmm, dayBefore: z.boolean(), updatedAt: ts,
}).strict();

const slotKey = z.enum(["squat", "row", "push", "bridge", "core_a", "hinge", "press", "stepup", "curl", "core_b", "calf", "extra_pull"]);
export const programSchema = z.object({
  id, createdAt: ts, startDate: date, currentWeek: z.number().int().min(1).max(520),
  templates: z.array(z.object({
    letter: z.enum(["A", "B"]), name: text(40),
    slots: z.array(z.object({ slot: slotKey, exerciseId: exId, optional: z.boolean().optional(), custom: z.boolean().optional() }).strict()).max(14),
  }).strict()).max(4),
  screening: z.object({ status: z.enum(["ok", "caution", "clearance_recommended"]), reasons: z.array(text(400)).max(20), modifications: z.array(text(400)).max(20) }).strict(),
  exerciseTargets: z.record(z.string(), z.object({ weight: z.number().min(0).max(100).nullable().optional(), sets: z.number().int().min(1).max(6).optional(), updatedAt: ts }).strict()),
  reviewedUntil: date.optional(),
  updatedAt: ts,
}).strict();

export const scheduledSchema = z.object({
  id, date, letter: z.enum(["A", "B"]), week: z.number().int().min(1).max(520),
  status: z.enum(["planned", "completed", "skipped"]), sessionId: id.optional(), moved: z.boolean().optional(), updatedAt: ts,
}).strict();

const sessionExercise = z.object({
  id, exerciseId: exId, originalExerciseId: exId.optional(), slot: slotKey,
  targetSets: z.number().int().min(1).max(8), repMin: z.number().int().min(1).max(100), repMax: z.number().int().min(1).max(100),
  targetWeight: z.number().min(0).max(100).nullable(), status: z.enum(["pending", "done", "skipped"]),
  technique: z.enum(["unsure", "ok", "confident"]).optional(), discomfort: z.enum(["none", "mild", "concerning"]).optional(),
  tooHeavy: z.boolean().optional(), note: text(500).optional(),
}).strict();
export const sessionSchema = z.object({
  id, letter: z.enum(["A", "B"]), scheduledId: id.optional(), date, week: z.number().int().min(1).max(520),
  phase: z.enum(["foundation", "building", "development", "ongoing"]), mode: z.enum(["normal", "lighter"]),
  status: z.enum(["in_progress", "paused", "completed", "ended_early"]),
  startedAt: ts, endedAt: ts.optional(), pausedAt: ts.optional(), totalPausedMs: z.number().min(0),
  exercises: z.array(sessionExercise).max(20), currentIndex: z.number().int().min(0).max(20),
  setInProgressSince: ts.optional(),
  rest: z.object({ endsAt: ts.optional(), pausedRemainingMs: z.number().optional(), durationMs: z.number() }).strict().nullable().optional(),
  checkinId: id.optional(),
  reflection: z.object({ energy: rating.optional(), confidence: rating.optional(), enjoyment: rating.optional(), note: text(1000).optional() }).strict().optional(),
  updatedAt: ts,
}).strict();

export const setSchema = z.object({
  id, sessionId: id, sessionExerciseId: id, exerciseId: exId, setIndex: z.number().int().min(0).max(30),
  weight: z.number().min(0).max(300).nullable(), reps: z.number().int().min(0).max(500).nullable(),
  completed: z.boolean(), effort: z.enum(["easy", "comfortable", "challenging", "very_hard"]).optional(),
  discomfort: z.enum(["none", "mild", "concerning"]).optional(), note: text(500).optional(), completedAt: ts, updatedAt: ts,
}).strict();

export const checkinSchema = z.object({
  id, date, energy: z.enum(["great", "good", "tired", "very_tired"]), muscles: z.enum(["recovered", "mild", "quite_sore"]),
  pain: z.enum(["none", "familiar", "new"]), outcome: z.enum(["normal", "lighter", "recovery", "seek_guidance"]), createdAt: ts, updatedAt: ts,
}).strict();

const proposed = z.object({ weight: z.number().nullable().optional(), sets: z.number().int().optional(), targetReps: z.number().int().optional(), exerciseId: exId.optional() }).strict();
export const recommendationSchema = z.object({
  id, exerciseId: exId, sessionId: id.optional(),
  action: z.enum(["increase_weight", "increase_reps", "add_set", "next_band", "hold", "decrease_weight", "return_gently", "consult", "insufficient_evidence", "suggest_variation", "calibrate"]),
  title: text(120), message: text(600), explanation: z.array(text(400)).max(20), proposed: proposed.nullable(),
  alternatives: z.array(z.object({ label: text(200), proposed })).max(6), needsDecision: z.boolean(), ruleVersion: text(20), createdAt: ts, updatedAt: ts,
}).strict();
export const decisionSchema = z.object({
  id, recommendationId: id, exerciseId: exId, decision: z.enum(["accepted", "declined", "deferred"]), chosen: proposed.nullable(), decidedAt: ts, updatedAt: ts,
}).strict();
export const milestoneSchema = z.object({ id, key: text(60), achievedAt: ts, detail: text(300).optional(), updatedAt: ts }).strict();
export const journalSchema = z.object({
  id, date, feeling: text(2000), enjoyed: z.array(text(80)).max(20), disliked: z.array(text(80)).max(20), achievement: text(1000),
  energy: rating.optional(), confidence: rating.optional(), goal: text(500), mobilityNote: text(500),
  photoPath: text(200).optional(), sharedWithSupporter: z.boolean(), createdAt: ts, updatedAt: ts,
}).strict();

const group = z.number().int().min(0).max(12);
export const nutritionSchema = z.object({
  enabled: z.boolean(), style: z.enum(["everything", "pescatarian", "vegetarian", "vegan"]),
  avoid: z.array(z.enum(["dairy", "gluten", "nuts", "eggs", "soy", "fish", "shellfish", "sesame"])).max(8),
  avoidOther: text(200), showProteinGuide: z.boolean(), updatedAt: ts,
}).strict();
export const nutritionLogSchema = z.object({
  id, date, serves: z.object({ veg: group, fruit: group, grains: group, protein: group, dairy: group }).strict(),
  waterCups: z.number().int().min(0).max(30), note: text(500), createdAt: ts, updatedAt: ts,
}).strict();

// --- Registry: entity name → table, kind, schema --------------------------------
export const ENTITIES = {
  profile: { table: "profiles", single: true, schema: profileSchema },
  preferences: { table: "user_preferences", single: true, schema: preferencesSchema },
  equipment: { table: "equipment_inventory", single: true, schema: equipmentSchema },
  health: { table: "health_considerations", single: true, schema: healthSchema },
  goals: { table: "fitness_goals", single: true, schema: goalsSchema },
  notifications: { table: "notification_preferences", single: true, schema: notificationSchema },
  program: { table: "training_programs", single: false, schema: programSchema },
  scheduled: { table: "scheduled_workouts", single: false, schema: scheduledSchema },
  sessions: { table: "workout_sessions", single: false, schema: sessionSchema },
  sets: { table: "exercise_sets", single: false, schema: setSchema },
  checkins: { table: "readiness_checkins", single: false, schema: checkinSchema },
  recommendations: { table: "progression_recommendations", single: false, schema: recommendationSchema },
  decisions: { table: "progression_decisions", single: false, schema: decisionSchema },
  milestones: { table: "personal_milestones", single: false, schema: milestoneSchema },
  journal: { table: "journal_entries", single: false, schema: journalSchema },
  nutrition: { table: "nutrition_preferences", single: true, schema: nutritionSchema },
  nutritionLogs: { table: "nutrition_logs", single: false, schema: nutritionLogSchema },
} as const;
export type EntityName = keyof typeof ENTITIES;
export const ENTITY_NAMES = Object.keys(ENTITIES) as EntityName[];

export const syncOpSchema = z.object({
  opId: z.string().uuid(),
  entity: z.enum(ENTITY_NAMES as [EntityName, ...EntityName[]]),
  id: z.string().min(1).max(64),
  action: z.enum(["upsert", "delete"]),
  record: z.unknown().optional(),
  clientUpdatedAt: ts,
}).strict();
export const syncBatchSchema = z.object({ ops: z.array(syncOpSchema).min(1).max(100) }).strict();
export type SyncOp = z.infer<typeof syncOpSchema>;

export const journalInputSchema = journalSchema.pick({ feeling: true, achievement: true, goal: true, mobilityNote: true });
export const signInSchema = z.object({ email: z.string().email("Please enter a valid email"), password: z.string().min(8, "At least 8 characters") });
export const inviteSchema = z.object({
  email: z.string().email(),
  canSeeSessions: z.boolean(), canSeeAchievements: z.boolean(), canSeeMetrics: z.boolean(), canSeeNotes: z.boolean(), canEncourage: z.boolean(),
}).strict();
