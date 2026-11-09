// Supporter sharing. ENFORCEMENT lives in Postgres (see supabase/migrations/0002_rls_and_functions.sql):
// supporters have no direct table access; they can only call SECURITY DEFINER functions that check an
// un-revoked, accepted grant and return only the fields Jo allowed.
export interface SupporterPermissions {
  canSeeSessions: boolean; canSeeAchievements: boolean; canSeeMetrics: boolean; canSeeNotes: boolean; canEncourage: boolean;
}
export const NO_SHARING: SupporterPermissions = {
  canSeeSessions: false, canSeeAchievements: false, canSeeMetrics: false, canSeeNotes: false, canEncourage: false,
};
export const PERMISSION_LABELS: Record<keyof SupporterPermissions, { label: string; help: string }> = {
  canSeeSessions: { label: "Which days I trained", help: "Shows when sessions were completed, and how many each week." },
  canSeeAchievements: { label: "My achievements", help: "Shows milestones such as '10 workouts'." },
  canSeeMetrics: { label: "Strength progress", help: "Shows weights and repetitions per exercise." },
  canSeeNotes: { label: "Journal entries I choose to share", help: "Only entries you individually mark as shared. Health details are never included." },
  canEncourage: { label: "Let them send me encouragement", help: "Short supportive messages. They cannot change your workouts." },
};
export interface SupporterView {
  ownerName: string;
  permissions: SupporterPermissions;
  sessions?: { date: string; letter: string; status: string }[];
  achievements?: { key: string; achievedAt: string }[];
  metrics?: { exerciseId: string; date: string; weight: number | null; reps: number | null }[];
  notes?: { date: string; feeling: string; achievement: string }[];
}
export interface Invite {
  id: string; email: string; createdAt: string; acceptedAt: string | null; revokedAt: string | null; expiresAt: string;
}
export type InviteState = "pending" | "active" | "revoked" | "expired";
export function inviteState(i: Invite, now: Date): InviteState {
  if (i.revokedAt) return "revoked";
  if (i.acceptedAt) return "active";
  return new Date(i.expiresAt) < now ? "expired" : "pending";
}
