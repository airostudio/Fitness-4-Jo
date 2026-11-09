# JoStrong – guide for Claude (read this first)

Private home-strength PWA for Jo. Next.js 16 (App Router) · TypeScript strict · Tailwind 4 · Supabase (Postgres, Auth, Storage) · Vercel. Health-adjacent: safety and tone rules below are requirements, not preferences.

## Where things live (do not guess – look these up)
| Component | Identifier | How to inspect |
|---|---|---|
| GitHub repo | `airostudio/Fitness-4-Jo`, work branch `claude/focused-knuth-xj5jsn` | `github` MCP (needs `GITHUB_PERSONAL_ACCESS_TOKEN`) |
| Vercel | team `airostudios-projects` (`team_ji4B4UILUEcxGLqguJcEpesg`), project **`fit-nes`** (`prj_lraAknIph18CVrPzEChm1axbZFPJ`) | `vercel` MCP: deployments, build/runtime logs, env var *names* |
| Supabase | project ref **`gjryjzffjlirstzpgnnn`** (`https://gjryjzffjlirstzpgnnn.supabase.co`) | `supabase` MCP (read-only by default): migrations, tables, advisors, logs |
All three are configured in `.mcp.json`. They use OAuth (Vercel, Supabase) or a token from the environment (GitHub) – **never put credentials in the repo**.

## Before claiming anything about deployed state, check it
- "Is it deployed / which commit?" → Vercel `list_deployments` for `fit-nes`; compare `githubCommitSha` with `git rev-parse HEAD`.
- "Are env vars set?" → Vercel env **names only**; never decrypt or print values. Expected production vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_INVITE_ONLY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (optional: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
- "Is the database right?" → Supabase `list_migrations` (expect `0001`–`0005`), `list_tables`, `get_advisors` (security). Or have the user run `supabase/verify.sql` (no `PROBLEM` rows = pass).
- If an MCP call is denied (e.g. a project outside the connected account), **say so** – do not work around it or assume the result.

## Production safety (hard rules)
- No destructive or schema-changing SQL on production without explicit approval. Migrations are forward-only files in `supabase/migrations/`; never edit an applied one. Apply via the manual, approval-gated **Supabase migrate** workflow (dry-run first, confirm a backup).
- The Supabase MCP is configured `read_only=true`. To write, the user must change that deliberately – prefer a branch/dev project.
- Service-role key, `CRON_SECRET`, VAPID private key: server-only; never in client code, logs, commits, or chat output.
- Don't push to branches other than the one designated for the task; don't open PRs unless asked.

## Architecture in one paragraph
Domain rules are pure TS in `src/lib/domain` (exercise library, programme, **deterministic progression engine**, readiness, calendar, nutrition, sync protocol, Zod schemas). `src/lib/store` is local-first (IndexedDB) with an idempotent outbox synced via `/api/sync` to Supabase under RLS. Supabase supporter/admin access is enforced in SQL (`SECURITY DEFINER` functions), not in the UI. Adding a synced entity means: type → Zod schema + `ENTITIES` registry → sync order → `merge.ts` → `tx.ts` → migration with RLS → `tests/db/samples.ts`.

## Health & tone requirements
- Progression is rules-based and explained; **never** let an LLM decide loads. Nothing changes without Jo's confirmation.
- New/significant pain → no training offered. Health notes or restrictions → point to a professional; never diagnose.
- Australian English; encouraging, weight-neutral. Nutrition: food-group serves, no calories, no weight-loss or "good/bad food" language (tests enforce this). Allergen tags must match ingredients (tests enforce this).
- Exercise images are AI-generated and must stay labelled as illustrations; four have display crops (`VISIBLE_WIDTH_PX` in `src/lib/exercise-art.ts`).

## Commands
`npm run verify` (typecheck + lint + unit/DB tests + build) · `npm run test:e2e` (Playwright, mobile) · `npm run gen:seed` (regenerates `0004_seed_reference.sql` – CI fails if stale) · `npm run gen:icons`.
Playwright is pinned to 1.63 to match the preinstalled browser; use `axe()` from `tests/e2e/helpers.ts`.

## Accessibility bar
WCAG 2.2 AA: keyboard operable, labelled controls, ≥44px targets, reduced-motion respected, never colour-only meaning. axe runs in e2e for light and dark themes; token contrast is unit-tested.
