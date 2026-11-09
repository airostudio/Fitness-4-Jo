-- JoStrong 0002: Row Level Security, grants and server-side functions.
-- Principle: every personal row is reachable ONLY by its owner. Supporters and administrators get NO table
-- policies on personal data – supporters use narrow SECURITY DEFINER functions that check a live grant.

-- ---------------------------------------------------------------- admin check (no access to personal data is derived from it)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.app_admins where user_id = (select auth.uid()))
$$;

-- ---------------------------------------------------------------- enable RLS everywhere
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- owner-only policies for personal tables
do $$
declare t text;
begin
  foreach t in array array['profiles','user_preferences','equipment_inventory','health_considerations','fitness_goals','notification_preferences',
    'training_programs','scheduled_workouts','workout_sessions','exercise_sets','readiness_checkins','progression_recommendations',
    'progression_decisions','personal_milestones','journal_entries','push_subscriptions'] loop
    execute format($f$create policy "owner full access" on public.%I for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$f$, t);
  end loop;
end $$;

-- sync ledger and audit: owner may read and append their own rows only
create policy "own ledger read" on public.offline_sync_operations for select to authenticated using (user_id = (select auth.uid()));
create policy "own ledger insert" on public.offline_sync_operations for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own audit read" on public.audit_events for select to authenticated using (user_id = (select auth.uid()));
create policy "own audit insert" on public.audit_events for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- reference data: read for signed-in users, write for admins only
create policy "read library" on public.exercise_library for select to authenticated using (active or public.is_admin());
create policy "admin write library" on public.exercise_library for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read variations" on public.exercise_variations for select to authenticated using (true);
create policy "admin write variations" on public.exercise_variations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read approved media" on public.exercise_media for select to authenticated using (approved or public.is_admin());
create policy "admin write media" on public.exercise_media for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read phases" on public.program_phases for select to authenticated using (true);
create policy "read weeks" on public.program_weeks for select to authenticated using (true);
create policy "read templates" on public.workout_templates for select to authenticated using (true);
create policy "read template exercises" on public.workout_template_exercises for select to authenticated using (true);
create policy "admin write phases" on public.program_phases for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write weeks" on public.program_weeks for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write templates" on public.workout_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write template exercises" on public.workout_template_exercises for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- operational data: admins can read technical errors (sanitised); nobody can write except the service role
create policy "admin read errors" on public.error_events for select to authenticated using (public.is_admin());
create policy "admin sees own admin row" on public.app_admins for select to authenticated using (user_id = (select auth.uid()));

-- supporter tables: owners read their own; all writes go through functions below
create policy "owner reads invites" on public.supporter_invites for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner reads permissions" on public.supporter_permissions for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner updates permissions" on public.supporter_permissions for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner reads encouragements" on public.supporter_encouragements for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner marks encouragements read" on public.supporter_encouragements for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------- grants (explicit, not reliant on platform defaults)
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon;

grant select, insert, update, delete on
  public.profiles, public.user_preferences, public.equipment_inventory, public.health_considerations, public.fitness_goals,
  public.notification_preferences, public.push_subscriptions, public.training_programs, public.scheduled_workouts,
  public.workout_sessions, public.exercise_sets, public.readiness_checkins, public.progression_recommendations,
  public.progression_decisions, public.personal_milestones, public.journal_entries to authenticated;
grant select, insert on public.offline_sync_operations, public.audit_events to authenticated;
grant select, insert, update, delete on public.exercise_library, public.exercise_variations, public.exercise_media,
  public.program_phases, public.program_weeks, public.workout_templates, public.workout_template_exercises to authenticated;
grant select on public.error_events, public.app_admins, public.supporter_invites, public.supporter_encouragements to authenticated;
grant select on public.supporter_permissions to authenticated;
grant update (can_see_sessions, can_see_achievements, can_see_metrics, can_see_notes, can_encourage, updated_at) on public.supporter_permissions to authenticated;
grant update (read_at) on public.supporter_encouragements to authenticated;

-- ---------------------------------------------------------------- supporter functions
create or replace function public.create_supporter_invite(
  p_email text, p_token_hash text, p_sessions boolean, p_achievements boolean, p_metrics boolean, p_notes boolean, p_encourage boolean
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  insert into public.supporter_invites (owner_id, email, token_hash) values (v_uid, lower(trim(p_email)), p_token_hash) returning id into v_id;
  insert into public.supporter_permissions (invite_id, owner_id, can_see_sessions, can_see_achievements, can_see_metrics, can_see_notes, can_encourage)
    values (v_id, v_uid, p_sessions, p_achievements, p_metrics, p_notes, p_encourage);
  insert into public.audit_events (user_id, event) values (v_uid, 'supporter.invited');
  return v_id;
end $$;

create or replace function public.accept_supporter_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_email text := lower(coalesce(auth.jwt() ->> 'email', '')); v_inv public.supporter_invites;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_inv from public.supporter_invites where token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex') for update;
  if not found or v_inv.revoked_at is not null or v_inv.accepted_at is not null or v_inv.expires_at < now() or v_inv.email <> v_email then
    raise exception 'invite not valid' using errcode = '42501';     -- one generic error: reveals nothing about why
  end if;
  if v_inv.owner_id = v_uid then raise exception 'invite not valid' using errcode = '42501'; end if;
  update public.supporter_invites set supporter_id = v_uid, accepted_at = now() where id = v_inv.id;
  insert into public.audit_events (user_id, event) values (v_inv.owner_id, 'supporter.accepted');
  return v_inv.id;
end $$;

create or replace function public.revoke_supporter(p_invite uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.supporter_invites set revoked_at = now() where id = p_invite and owner_id = auth.uid() and revoked_at is null;
  if not found then raise exception 'not found' using errcode = '42501'; end if;
  insert into public.audit_events (user_id, event) values (auth.uid(), 'supporter.revoked');
end $$;

-- active grant check shared by supporter functions
create or replace function public.active_grant(p_owner uuid) returns public.supporter_permissions
language sql stable security definer set search_path = public, pg_temp as $$
  select p.* from public.supporter_invites i join public.supporter_permissions p on p.invite_id = i.id
  where i.owner_id = p_owner and i.supporter_id = auth.uid() and i.accepted_at is not null and i.revoked_at is null
  order by i.accepted_at desc limit 1
$$;

create or replace function public.supporter_owners() returns table (owner_id uuid, owner_name text, invite_id uuid)
language sql stable security definer set search_path = public, pg_temp as $$
  select i.owner_id, coalesce(pr.name, 'Your friend'), i.id
  from public.supporter_invites i left join public.profiles pr on pr.user_id = i.owner_id
  where i.supporter_id = auth.uid() and i.accepted_at is not null and i.revoked_at is null
$$;

create or replace function public.supporter_view(p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare g public.supporter_permissions; out jsonb;
begin
  g := public.active_grant(p_owner);
  if g.invite_id is null then raise exception 'no access' using errcode = '42501'; end if;
  out := jsonb_build_object(
    'ownerName', coalesce((select name from public.profiles where user_id = p_owner), 'Your friend'),
    'permissions', jsonb_build_object('canSeeSessions', g.can_see_sessions, 'canSeeAchievements', g.can_see_achievements,
      'canSeeMetrics', g.can_see_metrics, 'canSeeNotes', g.can_see_notes, 'canEncourage', g.can_encourage));
  if g.can_see_sessions then
    out := out || jsonb_build_object('sessions', coalesce((select jsonb_agg(jsonb_build_object('date', date, 'letter', letter, 'status', status) order by date desc)
      from (select date, letter, status from public.workout_sessions where user_id = p_owner and status in ('completed','ended_early') order by date desc limit 60) s), '[]'::jsonb));
  end if;
  if g.can_see_achievements then
    out := out || jsonb_build_object('achievements', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'achievedAt', achieved_at) order by achieved_at desc)
      from public.personal_milestones where user_id = p_owner), '[]'::jsonb));
  end if;
  if g.can_see_metrics then
    out := out || jsonb_build_object('metrics', coalesce((select jsonb_agg(jsonb_build_object('exerciseId', exercise_id, 'date', d, 'weight', weight, 'reps', reps) order by d desc)
      from (select e.exercise_id, e.completed_at::date as d, e.weight, e.reps from public.exercise_sets e where e.user_id = p_owner and e.completed order by e.completed_at desc limit 200) m), '[]'::jsonb));
  end if;
  if g.can_see_notes then   -- only entries Jo individually shared; health fields are never exposed
    out := out || jsonb_build_object('notes', coalesce((select jsonb_agg(jsonb_build_object('date', date, 'feeling', feeling, 'achievement', achievement) order by date desc)
      from public.journal_entries where user_id = p_owner and shared_with_supporter), '[]'::jsonb));
  end if;
  return out;
end $$;

create or replace function public.supporter_send_encouragement(p_owner uuid, p_message text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare g public.supporter_permissions; v_inv uuid;
begin
  g := public.active_grant(p_owner);
  if g.invite_id is null or not g.can_encourage then raise exception 'no access' using errcode = '42501'; end if;
  insert into public.supporter_encouragements (invite_id, owner_id, supporter_id, message) values (g.invite_id, p_owner, auth.uid(), left(trim(p_message), 280));
end $$;

-- admin health: aggregate counts only, never rows of personal data
create or replace function public.admin_health() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'accounts', (select count(*) from public.profiles),
    'sessionsLast7Days', (select count(*) from public.workout_sessions where server_updated_at > now() - interval '7 days'),
    'rejectedSyncOpsLast7Days', (select count(*) from public.offline_sync_operations where status = 'rejected' and created_at > now() - interval '7 days'),
    'errorsLast24h', (select count(*) from public.error_events where created_at > now() - interval '1 day'),
    'activeExercises', (select count(*) from public.exercise_library where active));
end $$;

revoke all on function public.is_admin(), public.active_grant(uuid) from public, anon, authenticated;
revoke all on function public.create_supporter_invite(text,text,boolean,boolean,boolean,boolean,boolean), public.accept_supporter_invite(text),
  public.revoke_supporter(uuid), public.supporter_owners(), public.supporter_view(uuid), public.supporter_send_encouragement(uuid,text), public.admin_health() from public, anon;
grant execute on function public.is_admin() to authenticated;   -- used inside policies
grant execute on function public.create_supporter_invite(text,text,boolean,boolean,boolean,boolean,boolean), public.accept_supporter_invite(text),
  public.revoke_supporter(uuid), public.supporter_owners(), public.supporter_view(uuid), public.supporter_send_encouragement(uuid,text), public.admin_health() to authenticated;
