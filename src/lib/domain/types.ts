// Core domain types for JoStrong. Pure data – no framework dependencies.

export type Requirement = "mat" | "chair" | "bands" | "dumbbells" | "bench" | "step";
export type EquipmentKey =
  | "none" | "mat" | "chair" | "bands" | "light_dumbbells"
  | "adjustable_dumbbells" | "bench" | "step" | "other";

export type ExerciseCategory =
  | "lower_body" | "upper_push" | "upper_pull" | "glutes_posterior"
  | "core" | "balance" | "mobility";

export type Difficulty = 1 | 2 | 3; // 1 = gentlest
export type BodyArea = "back" | "knee" | "shoulder" | "balance" | "wrist";
export type LoadType = "dumbbell" | "band" | "bodyweight" | "timed";

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  description: string;
  muscles: string[];
  requires: Requirement[]; // ALL must be available; empty = no equipment
  difficulty: Difficulty;
  loadType: LoadType;
  perSide: boolean;
  startingPosition: string;
  steps: string[];
  breathing: string;
  commonMistakes: string[];
  safetyNotes: string[];
  repRange: [number, number]; // or seconds when loadType === "timed"
  sets: number;
  restSeconds: number;
  progressions: string[]; // exercise ids – harder
  regressions: string[]; // exercise ids – easier
  cautions: BodyArea[]; // contraindication flags (areas where extra care is needed)
  media: ExerciseMedia;
}

export interface ExerciseMedia {
  kind: "none" | "video" | "animation" | "image";
  url?: string;
  licence?: string; // must be recorded for any approved media
  approved?: boolean;
  note?: string;
}

export type Discomfort = "none" | "occasional" | "frequent";
export type Experience = "new" | "little" | "regular_past" | "returning";

export interface Profile {
  name: string;
  dateOfBirth?: string; // YYYY-MM-DD, optional
  heightCm?: number;
  weightKg?: number;
  experience: Experience;
  activityLevel: "mostly_sitting" | "light" | "moderate" | "active";
  movementConfidence: 1 | 2 | 3 | 4 | 5;
  onboardedAt?: string;
  updatedAt: string;
}

export interface Preferences {
  timezone: string;
  trainingDays: number[]; // 1=Mon … 7=Sun
  trainingTime: string; // HH:MM
  daysPerWeek: number;
  sessionMinutes: number;
  restSeconds: number;
  theme: "system" | "light" | "dark";
  textScale: 100 | 115 | 130;
  highContrast: boolean;
  reducedMotion: "system" | "on" | "off";
  sound: boolean;
  vibration: boolean;
  photosEnabled: boolean;
  updatedAt: string;
}

export interface EquipmentInventory {
  items: EquipmentKey[];
  dumbbellWeightsKg: number[]; // exact weights available (sorted ascending)
  bandLevels: string[]; // e.g. ["Light", "Medium"]
  other: string;
  updatedAt: string;
}

export type Level3 = "good" | "some" | "limited";
export interface HealthConsiderations {
  mobility: Level3;
  chairRise: "easy" | "effort" | "difficult";
  armsOverhead: "full" | "partial" | "no";
  balance: "confident" | "somewhat" | "not_confident";
  backDiscomfort: Discomfort;
  kneeDiscomfort: Discomfort;
  shoulderDiscomfort: Discomfort;
  previousInjuries: string;
  conditions: string;
  hasProfessionalRestrictions: boolean;
  clearanceAcknowledged: boolean; // Jo confirms she has professional advice to proceed
  answered: boolean; // false if skipped
  updatedAt: string;
}

export type GoalKey =
  | "build_muscle" | "everyday_strength" | "balance" | "posture_mobility"
  | "confidence" | "general_fitness" | "independence";
export interface FitnessGoals {
  priorities: GoalKey[]; // ordered, first = top priority
  personalNote: string;
  updatedAt: string;
}

export interface NotificationPrefs {
  enabled: boolean;
  days: number[];
  time: string; // HH:MM
  quietStart: string;
  quietEnd: string;
  dayBefore: boolean;
  updatedAt: string;
}

// ---- Program -------------------------------------------------------------
export type PhaseKey = "foundation" | "building" | "development" | "ongoing";
export type WorkoutLetter = "A" | "B";
export type SlotKey =
  | "squat" | "row" | "push" | "bridge" | "core_a"
  | "hinge" | "press" | "stepup" | "curl" | "core_b"
  | "calf" | "extra_pull";

export interface SlotChoice {
  slot: SlotKey;
  exerciseId: string;
  optional?: boolean;
  /** Jo-chosen override, preserved when regenerating */
  custom?: boolean;
}
export interface WorkoutTemplate { letter: WorkoutLetter; name: string; slots: SlotChoice[]; }

export interface WeekPlan {
  week: number; // 1-based; > 12 = ongoing
  phase: PhaseKey;
  sessions: number;
  sets: number;
  maxSets: number;
  repRange: [number, number];
  note: string;
}

export type ClearanceStatus = "ok" | "caution" | "clearance_recommended";
export interface Screening { status: ClearanceStatus; reasons: string[]; modifications: string[]; }

export interface ExerciseTarget {
  weight?: number | null;
  sets?: number;
  updatedAt: string;
}

export interface Program {
  id: string;
  createdAt: string;
  startDate: string; // YYYY-MM-DD (Monday of start week)
  currentWeek: number; // pointer – advances only with Jo's confirmation
  templates: WorkoutTemplate[];
  screening: Screening;
  exerciseTargets: Record<string, ExerciseTarget>;
  updatedAt: string;
}

export interface ScheduledWorkout {
  id: string;
  date: string; // YYYY-MM-DD
  letter: WorkoutLetter;
  week: number;
  status: "planned" | "completed" | "skipped";
  sessionId?: string;
  moved?: boolean;
  updatedAt: string;
}

// ---- Logging -------------------------------------------------------------
export type Effort = "easy" | "comfortable" | "challenging" | "very_hard";
export type Technique = "unsure" | "ok" | "confident";
export type SetDiscomfort = "none" | "mild" | "concerning";

export interface SessionExercise {
  id: string;
  exerciseId: string;
  originalExerciseId?: string; // when substituted
  slot: SlotKey;
  targetSets: number;
  repMin: number;
  repMax: number;
  targetWeight: number | null;
  status: "pending" | "done" | "skipped";
  technique?: Technique;
  discomfort?: SetDiscomfort;
  tooHeavy?: boolean;
  note?: string;
}

export interface WorkoutSession {
  id: string;
  letter: WorkoutLetter;
  scheduledId?: string;
  date: string;
  week: number;
  phase: PhaseKey;
  mode: "normal" | "lighter";
  status: "in_progress" | "paused" | "completed" | "ended_early";
  startedAt: string;
  endedAt?: string;
  pausedAt?: string;
  totalPausedMs: number;
  exercises: SessionExercise[];
  currentIndex: number;
  setInProgressSince?: string;
  rest?: { endsAt?: string; pausedRemainingMs?: number; durationMs: number } | null;
  checkinId?: string;
  reflection?: { energy?: 1 | 2 | 3 | 4 | 5; confidence?: 1 | 2 | 3 | 4 | 5; enjoyment?: 1 | 2 | 3 | 4 | 5; note?: string };
  updatedAt: string;
}

export interface ExerciseSet {
  id: string;
  sessionId: string;
  sessionExerciseId: string;
  exerciseId: string;
  setIndex: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
  effort?: Effort;
  discomfort?: SetDiscomfort;
  note?: string;
  completedAt: string;
  updatedAt: string;
}

export interface ReadinessCheckin {
  id: string;
  date: string;
  energy: "great" | "good" | "tired" | "very_tired";
  muscles: "recovered" | "mild" | "quite_sore";
  pain: "none" | "familiar" | "new";
  outcome: ReadinessMode;
  createdAt: string;
  updatedAt: string;
}
export type ReadinessMode = "normal" | "lighter" | "recovery" | "seek_guidance";

export interface ProgressionAlternative { label: string; proposed: Proposed; }
export interface Proposed { weight?: number | null; sets?: number; targetReps?: number; exerciseId?: string; }
export type ProgressionAction =
  | "increase_weight" | "increase_reps" | "add_set" | "next_band" | "hold"
  | "decrease_weight" | "return_gently" | "consult" | "insufficient_evidence"
  | "suggest_variation" | "calibrate";

export interface ProgressionRecommendation {
  id: string;
  exerciseId: string;
  sessionId?: string;
  action: ProgressionAction;
  title: string;
  message: string;
  explanation: string[];
  proposed: Proposed | null;
  alternatives: ProgressionAlternative[];
  needsDecision: boolean; // true when Jo must accept/decline
  ruleVersion: string;
  createdAt: string;
  updatedAt: string;
}
export interface ProgressionDecision {
  id: string;
  recommendationId: string;
  exerciseId: string;
  decision: "accepted" | "declined" | "deferred";
  chosen: Proposed | null;
  decidedAt: string;
  updatedAt: string;
}

export interface Milestone { id: string; key: string; achievedAt: string; detail?: string; updatedAt: string; }

export interface JournalEntry {
  id: string;
  date: string;
  feeling: string;
  enjoyed: string[];
  disliked: string[];
  achievement: string;
  energy?: 1 | 2 | 3 | 4 | 5;
  confidence?: 1 | 2 | 3 | 4 | 5;
  goal: string;
  mobilityNote: string;
  photoPath?: string;
  sharedWithSupporter: boolean;
  createdAt: string;
  updatedAt: string;
}
