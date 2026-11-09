## What and why

## Checklist
- [ ] `npm run verify` and `npm run test:e2e` pass (CI runs both)
- [ ] No secrets or `.env` files committed
- [ ] New tables have **RLS + owner policies**, are added to `ENTITIES`/sync, and have DB test fixtures
- [ ] Migrations are new files (never edit an applied one) and `supabase/verify.sql` still passes
- [ ] Health/nutrition wording stays encouraging and weight-neutral (tone tests pass)
- [ ] UI changes: keyboard, screen-reader labels and reduced-motion considered

## Deployment notes
(env vars to add, migrations to run – use the manual "Supabase migrate" workflow, dry-run first)
