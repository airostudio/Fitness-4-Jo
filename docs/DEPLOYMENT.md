# Deployment (Vercel + Supabase)

Status: **not deployed.** No JoStrong Supabase or Vercel project exists in the connected accounts, and none was created automatically. Follow these steps.

## 1. Supabase
1. Create a project (choose a region near Melbourne, e.g. `ap-southeast-2`). Note the project URL, anon key and service-role key.
2. **Backup first** for any project that already holds data (Dashboard → Database → Backups, or `supabase db dump`). A brand-new project needs none.
3. Apply migrations in order (`supabase/migrations/0001…0004`):
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push        # review the plan it prints before confirming
   ```
   Migrations are forward-only. Never run them against a project you haven't confirmed is the intended target.
4. Auth → Providers → Email: enable. Auth → URL configuration: Site URL = your production URL; add `https://<domain>/auth/callback` as a redirect URL.
5. **Invitation-only:** create Jo's user in Auth → Users (Invite user), then turn **off** "Allow new users to sign up". Set `NEXT_PUBLIC_INVITE_ONLY=true` to hide the sign-up UI.
6. Make yourself an administrator (optional): `insert into public.app_admins (user_id) values ('<your auth user id>');`

Verify the database: paste `supabase/verify.sql` into the SQL editor. No `PROBLEM` rows means tables, RLS, grants, functions, the private photo bucket and seed data are all in place (the script is itself tested against the migrations).

## 2. Vercel
1. Import the GitHub repo. Framework: Next.js (auto). Build command `npm run build`.
2. Environment variables (Production and Preview use *different* Supabase projects ideally) — see `.env.example`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_INVITE_ONLY`, and for push: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
3. Cron: `vercel.json` schedules `/api/cron/reminders` hourly. **Vercel Hobby only allows daily crons** — if the deploy is rejected, change the schedule to `0 20 * * *` and path to `/api/cron/reminders?catchup=1` (sends one reminder per planned session regardless of preferred hour).
4. Deploy, then run the release checklist in `docs/RUNBOOK.md`.

## 3. Sharing JoStrong with Jo
1. Invite Jo's email in Supabase (step 1.5). She receives a sign-in email.
2. Send her the production URL. On Android Chrome: menu → *Install app*. On iPhone: Safari → Share → *Add to Home Screen* (needed for notifications, iOS 16.4+).
3. She signs in, completes onboarding, and her programme is created. Optionally walk her through Settings → Private supporter (off by default).

## Local development against Supabase
`npx supabase start`, copy the printed URL/anon key into `.env.local`.
