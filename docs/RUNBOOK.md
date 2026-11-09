# Operational runbook

## Release checklist
1. `npm run verify` and `npm run test:e2e` green on the release commit.
2. Confirm target Supabase project ref and that a backup exists. Review new migrations; never run destructive SQL in production without explicit sign-off.
3. `supabase db push`, then deploy on Vercel.
4. Smoke test: sign in, open a workout offline (airplane mode), log a set, go online, confirm "saved to your account".
5. As a second test user: confirm they cannot see the first user's data; as a supporter, confirm revoke blocks the next request.

## Recovery
- **Bad deploy:** Vercel → Deployments → Promote the previous build (instant rollback).
- **Bad migration:** migrations are forward-only; write a new corrective migration. For data loss restore from backup / Point-in-Time Recovery (Pro plan) into a *new* project, verify, then switch env vars.
- **User lost their phone:** data is in the account; sign in on a new device. Unsynced changes on the lost device cannot be recovered.
- **Sync "needs attention":** rejected operations are kept on the device and flagged. Check Admin → Application health (rejected syncs) and `error_events`.
- **Account deletion requests:** user self-serves in Settings. Operator fallback: delete the user in Supabase Auth (everything cascades) and remove `journal-photos/<uid>/`.

## Privileged operations (all audited in `audit_events`, event names only)
Exercise edits, media approval, starter-workout edits (Admin UI); granting admin (`insert into app_admins`, SQL editor only); service-role use is limited to account deletion, error logging and reminder dispatch.
Administrators have **no** RLS policy on health, journal, sessions, sets, or profiles (tested).

## Monitoring
Vercel logs for API routes (no health data is logged). Admin page shows counts and sanitised errors.
