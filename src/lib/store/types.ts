import type { QueuedOp } from "@/lib/domain/sync";
import type {
  EquipmentInventory, ExerciseSet, FitnessGoals, HealthConsiderations, JournalEntry, Milestone, NotificationPrefs, Preferences,
  ProgressionDecision, ProgressionRecommendation, Profile, Program, ReadinessCheckin, ScheduledWorkout, WorkoutSession,
} from "@/lib/domain/types";
import { DEFAULT_TZ } from "@/lib/domain/dates";

export interface AppData {
  v: 1;
  profile: Profile | null;
  preferences: Preferences;
  equipment: EquipmentInventory;
  health: HealthConsiderations;
  goals: FitnessGoals;
  notifications: NotificationPrefs;
  program: Program | null;
  scheduled: ScheduledWorkout[];
  sessions: WorkoutSession[];
  sets: ExerciseSet[];
  checkins: ReadinessCheckin[];
  recommendations: ProgressionRecommendation[];
  decisions: ProgressionDecision[];
  milestones: Milestone[];
  journal: JournalEntry[];
  meta: { queue: QueuedOp[]; lastPullAt?: string; lastSyncAt?: string; lastError?: string };
}

const EPOCH = "1970-01-01T00:00:00.000Z";
export function emptyData(): AppData {
  return {
    v: 1, profile: null,
    preferences: {
      timezone: DEFAULT_TZ, trainingDays: [1, 4], trainingTime: "09:00", daysPerWeek: 3, sessionMinutes: 45, restSeconds: 60,
      theme: "system", textScale: 100, highContrast: false, reducedMotion: "system", sound: false, vibration: true, photosEnabled: false, updatedAt: EPOCH,
    },
    equipment: { items: [], dumbbellWeightsKg: [], bandLevels: [], other: "", updatedAt: EPOCH },
    health: {
      mobility: "good", chairRise: "easy", armsOverhead: "full", balance: "confident", backDiscomfort: "none", kneeDiscomfort: "none", shoulderDiscomfort: "none",
      previousInjuries: "", conditions: "", hasProfessionalRestrictions: false, clearanceAcknowledged: false, answered: false, updatedAt: EPOCH,
    },
    goals: { priorities: ["everyday_strength"], personalNote: "", updatedAt: EPOCH },
    notifications: { enabled: false, days: [1, 4], time: "09:00", quietStart: "21:00", quietEnd: "07:00", dayBefore: true, updatedAt: EPOCH },
    program: null, scheduled: [], sessions: [], sets: [], checkins: [], recommendations: [], decisions: [], milestones: [], journal: [],
    meta: { queue: [] },
  };
}

export interface Ctx { now: string; today: string; id: () => string; }
export interface TxResult<T = void> { data: AppData; ops: QueuedOp[]; result: T; }
