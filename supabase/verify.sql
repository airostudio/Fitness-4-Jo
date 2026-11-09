-- JoStrong deployment check. Paste into the Supabase SQL editor (read-only; changes nothing).
-- Every row returned under "PROBLEM" needs fixing. An empty "PROBLEM" list means the checks passed.
with expected_tables(t) as (values
  ('profiles'),('user_preferences'),('equipment_inventory'),('health_considerations'),('fitness_goals'),('notification_preferences'),('push_subscriptions'),
  ('training_programs'),('scheduled_workouts'),('workout_sessions'),('exercise_sets'),('readiness_checkins'),('progression_recommendations'),
  ('progression_decisions'),('personal_milestones'),('journal_entries'),('nutrition_preferences'),('nutrition_logs'),('exercise_library'),
  ('exercise_variations'),('exercise_media'),('program_phases'),('program_weeks'),('workout_templates'),('workout_template_exercises'),
  ('supporter_invites'),('supporter_permissions'),('supporter_encouragements'),('app_admins'),('audit_events'),('offline_sync_operations'),('error_events')),
problems as (
  select 'missing table: ' || t as problem from expected_tables where to_regclass('public.' || t) is null
  union all
  select 'RLS DISABLED: ' || c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  union all
  select 'anon can read: ' || table_name from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon' and privilege_type = 'SELECT'
  union all
  select 'missing function: ' || f from unnest(array['create_supporter_invite','accept_supporter_invite','revoke_supporter','supporter_view','supporter_owners','supporter_send_encouragement','admin_health','is_admin']) f
    where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f)
  union all
  select 'photo bucket missing or PUBLIC' where not exists (select 1 from storage.buckets where id = 'journal-photos' and public = false)
  union all
  select 'exercise library not seeded (expected ≥ 30)' where (select count(*) from public.exercise_library) < 30
  union all
  select 'a SECURITY DEFINER function is executable by anon: ' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
)
select 'PROBLEM' as status, problem as detail from problems
union all
select 'INFO', 'public tables: ' || count(*) || ', policies: ' || (select count(*) from pg_policies where schemaname = 'public') || ', exercises: ' || (select count(*) from public.exercise_library) from pg_tables where schemaname = 'public'
order by 1 desc, 2;
