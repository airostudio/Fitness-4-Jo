# Integrations: GitHub, Vercel, Supabase

How the three services connect to this repo, to CI/CD, and to Claude.

```
GitHub (airostudio/Fitness-4-Jo)  --push-->  Vercel project fit-nes  --env vars-->  Supabase gjryjzffjlirstzpgnnn
      │ Actions: CI on every push/PR            │ builds + hosts the PWA + cron           │ Auth, Postgres (RLS), Storage
      └ manual "Supabase migrate" workflow ─────┼─────────────────────────────────────────┘
```

## GitHub
- **CI** (`.github/workflows/ci.yml`): typecheck, lint, unit + RLS database tests, production build, seed-in-sync check, Playwright e2e, committed-secrets scan.
- **Supabase migrate** (`.github/workflows/supabase-migrate.yml`): manual only; dry-run by default; applying requires typing `YES` for "backup confirmed" and approval on the `production` environment.
- Dependabot (weekly npm, monthly actions), PR template with security/health checklist, `CODEOWNERS`.
- One-time settings (GitHub → Settings): create environment `production` with required reviewers and secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`; protect `main` (require CI, no force-push).

## Vercel (`fit-nes`)
Deploys from GitHub on push. Production env vars (names): see `CLAUDE.md`. `vercel.json` schedules the reminder cron (hourly needs a Pro plan; on Hobby use daily with `?catchup=1`). Turn off Vercel Authentication for production or Jo cannot install the PWA.

## Supabase (`gjryjzffjlirstzpgnnn`)
Migrations `0001`–`0005` in `supabase/migrations`; verify with `supabase/verify.sql`. Auth → URL configuration: Site URL = `NEXT_PUBLIC_SITE_URL`, redirect `https://<domain>/auth/callback`; invite Jo, then disable public sign-ups.

## Claude access (`.mcp.json`)
| Server | Auth | Scope |
|---|---|---|
| `vercel` | OAuth in the browser on first use | project `fit-nes` only |
| `supabase` | OAuth on first use (sign in to the account that owns the project) | project `gjryjzffjlirstzpgnnn`, **read-only** |
| `github` | `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable | whatever the token allows – use a fine-grained token limited to this repo (Contents, Pull requests, Actions, Issues: read/write as needed) |

Set the GitHub token in your shell (not in a file): `export GITHUB_PERSONAL_ACCESS_TOKEN=…`. Claude Code asks you to approve project MCP servers the first time. To let Claude write to Supabase, deliberately change `read_only=true` in `.mcp.json`; prefer a dev branch, and keep production changes going through the gated workflow.
