# JoStrong

*A little stronger, every day.* — a private, mobile-first home strength companion (Next.js 16, TypeScript strict, Tailwind 4, Supabase, PWA).

## What it does
Personal onboarding → deterministic 12-week programme (then ongoing) → guided workout player with rest timer → conservative, explainable progressive-overload suggestions that Jo accepts or declines → dashboard, charts, journal, editable calendar → optional supporter sharing, reminders and offline use. No AI is required or used for health decisions.

## Quick start (no accounts needed)
```bash
npm install
npm run dev          # http://localhost:3000 – runs in "this device only" mode
```
With no Supabase variables the app stores everything in the browser (IndexedDB) and clearly says so. Add accounts and cloud sync by following `docs/DEPLOYMENT.md`.

## Scripts
| Command | Purpose |
|---|---|
| `npm run verify` | typecheck + lint + unit/DB tests + production build |
| `npm test` | Vitest: domain rules, workout flow, auth gate/API, contrast, **Postgres RLS tests (PGlite running the real migrations)** |
| `npm run test:e2e` | Playwright (mobile viewport): onboarding, workout, offline, calendar, export/delete, accessibility (axe) |
| `npm run gen:seed` | Regenerate `supabase/migrations/0004_seed_reference.sql` from the TypeScript library |
| `npm run gen:icons` | Re-render PWA icons from `public/icons/icon.svg` |

## Layout
- `src/lib/domain` – pure, deterministic rules (exercise library, programme, progression engine, readiness, calendar, sync protocol, schemas).
- `src/lib/store` – local-first state: pure actions, IndexedDB persistence, sync client.
- `src/app`, `src/components` – UI (App Router). `src/app/api` – sync, account deletion, push, cron, log.
- `supabase/migrations` – forward-only SQL: schema, RLS + functions, storage, seed.
- `docs/` – DEPLOYMENT, RUNBOOK, SECURITY.

## Design decisions worth knowing
- **Local-first.** Workouts are written to the device first and queued as idempotent operations (client UUIDs; server ledger). Status shows "saved to your account" only after the server acknowledges.
- **Progression** (`src/lib/domain/progression.ts`): needs two consecutive sessions at the same weight near the top of the range, manageable effort, good technique, no discomfort, no recent volume change; steps larger than 2.5 kg offer an extra set first; every recommendation stores its reasons and rule version; nothing changes without confirmation.
- **Safety:** professional-restriction or frequent-discomfort answers lock the programme until Jo confirms she has guidance; new/significant pain on the check-in never offers training.
- **Starting loads** come from calibration in the first session, never from age or body weight.
