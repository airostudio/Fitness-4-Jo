-- JoStrong 0001: core schema.
-- Forward-only. Recovery: see docs/RUNBOOK.md (point-in-time restore / dump before applying).
-- All personal tables carry user_id → auth.users(id) ON DELETE CASCADE, so deleting an account removes every record.


-- ---------------------------------------------------------------- helpers
create or replace function public.touch_server_updated_at() returns trigger
language plpgsql as $$ begin new.server_updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------- profile & settings (one row per user)
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  date_of_birth date,
  height_cm double precision check (height_cm between 80 and 250),
  weight_kg double precision check (weight_kg between 20 and 300),
  experience text not null check (experience in ('new','little','regular_past','returning')),
  activity_level text not null check (activity_level in ('mostly_sitting','light','moderate','active')),
  movement_confidence smallint not null check (movement_confidence between 1 and 5),
  onboarded_at timestamptz,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Australia/Melbourne',
  training_days smallint[] not null default '{1,4}',
  training_time text not null default '09:00',
  days_per_week smallint not null check (days_per_week between 1 and 7),
  session_minutes smallint not null check (session_minutes between 10 and 120),
  rest_seconds smallint not null check (rest_seconds between 15 and 300),
  theme text not null check (theme in ('system','light','dark')),
  text_scale smallint not null check (text_scale in (100,115,130)),
  high_contrast boolean not null default false,
  reduced_motion text not null check (reduced_motion in ('system','on','off')),
  sound boolean not null default false,
  vibration boolean not null default true,
  photos_enabled boolean not null default false,   -- progress photos are OFF by default
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create table public.equipment_inventory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items text[] not null default '{}',
  dumbbell_weights_kg double precision[] not null default '{}',
  band_levels text[] not null default '{}',
  other text not null default '' check (char_length(other) <= 200),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create table public.health_considerations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mobility text not null check (mobility in ('good','some','limited')),
  chair_rise text not null check (chair_rise in ('easy','effort','difficult')),
  arms_overhead text not null check (arms_overhead in ('full','partial','no')),
  balance text not null check (balance in ('confident','somewhat','not_confident')),
  back_discomfort text not null check (back_discomfort in ('none','occasional','frequent')),
  knee_discomfort text not null check (knee_discomfort in ('none','occasional','frequent')),
  shoulder_discomfort text not null check (shoulder_discomfort in ('none','occasional','frequent')),
  previous_injuries text not null default '' check (char_length(previous_injuries) <= 500),
  conditions text not null default '' check (char_length(conditions) <= 500),
  has_professional_restrictions boolean not null default false,
  clearance_acknowledged boolean not null default false,
  answered boolean not null default false,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create table public.fitness_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  priorities text[] not null default '{}',
  personal_note text not null default '' check (char_length(personal_note) <= 500),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  days smallint[] not null default '{}',
  time text not null default '09:00',
  quiet_start text not null default '21:00',
  quiet_end text not null default '07:00',
  day_before boolean not null default true,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- programme & scheduling
create table public.training_programs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null,
  start_date date not null,
  current_week integer not null check (current_week >= 1),
  templates jsonb not null,
  screening jsonb not null,
  exercise_targets jsonb not null default '{}'::jsonb,
  reviewed_until date,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create table public.scheduled_workouts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  letter text not null check (letter in ('A','B')),
  week integer not null check (week >= 1),
  status text not null check (status in ('planned','completed','skipped')),
  session_id uuid,
  moved boolean,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- training log
create table public.workout_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  letter text not null check (letter in ('A','B')),
  scheduled_id uuid,
  date date not null,
  week integer not null check (week >= 1),
  phase text not null check (phase in ('foundation','building','development','ongoing')),
  mode text not null check (mode in ('normal','lighter')),
  status text not null check (status in ('in_progress','paused','completed','ended_early')),
  started_at timestamptz not null,
  ended_at timestamptz,
  paused_at timestamptz,
  total_paused_ms double precision not null default 0,
  exercises jsonb not null,
  current_index integer not null default 0,
  set_in_progress_since timestamptz,
  rest jsonb,
  checkin_id uuid,
  reflection jsonb,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.exercise_sets (
  id uuid primary key,                         -- client-generated → retries can never duplicate a set
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  session_exercise_id uuid not null,
  exercise_id text not null,
  set_index integer not null check (set_index >= 0),
  weight double precision check (weight >= 0),
  reps integer check (reps >= 0),
  completed boolean not null,
  effort text check (effort in ('easy','comfortable','challenging','very_hard')),
  discomfort text check (discomfort in ('none','mild','concerning')),
  note text check (char_length(note) <= 500),
  completed_at timestamptz not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  -- a set can only belong to a session owned by the SAME user
  foreign key (session_id, user_id) references public.workout_sessions (id, user_id) on delete cascade
);

create table public.readiness_checkins (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  energy text not null check (energy in ('great','good','tired','very_tired')),
  muscles text not null check (muscles in ('recovered','mild','quite_sore')),
  pain text not null check (pain in ('none','familiar','new')),
  outcome text not null check (outcome in ('normal','lighter','recovery','seek_guidance')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create table public.progression_recommendations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  session_id uuid,
  action text not null check (action in ('increase_weight','increase_reps','add_set','next_band','hold','decrease_weight','return_gently','consult','insufficient_evidence','suggest_variation','calibrate')),
  title text not null,
  message text not null,
  explanation jsonb not null default '[]'::jsonb,
  proposed jsonb,
  alternatives jsonb not null default '[]'::jsonb,
  needs_decision boolean not null,
  rule_version text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.progression_decisions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_id uuid not null,
  exercise_id text not null,
  decision text not null check (decision in ('accepted','declined','deferred')),
  chosen jsonb,
  decided_at timestamptz not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  foreign key (recommendation_id, user_id) references public.progression_recommendations (id, user_id) on delete cascade
);

create table public.personal_milestones (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  achieved_at timestamptz not null,
  detail text,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create table public.journal_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  feeling text not null default '' check (char_length(feeling) <= 2000),
  enjoyed text[] not null default '{}',
  disliked text[] not null default '{}',
  achievement text not null default '' check (char_length(achievement) <= 1000),
  energy smallint check (energy between 1 and 5),
  confidence smallint check (confidence between 1 and 5),
  goal text not null default '' check (char_length(goal) <= 500),
  mobility_note text not null default '' check (char_length(mobility_note) <= 500),
  photo_path text,
  shared_with_supporter boolean not null default false,   -- journal is private unless Jo shares an entry
  created_at timestamptz not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- shared reference data (no personal data)
create table public.exercise_library (
  id text primary key,
  name text not null,
  category text not null check (category in ('lower_body','upper_push','upper_pull','glutes_posterior','core','balance','mobility')),
  description text not null,
  muscles text[] not null,
  requires text[] not null default '{}',
  difficulty smallint not null check (difficulty between 1 and 3),
  load_type text not null check (load_type in ('dumbbell','band','bodyweight','timed')),
  per_side boolean not null default false,
  starting_position text not null,
  steps text[] not null,
  breathing text not null,
  common_mistakes text[] not null,
  safety_notes text[] not null,
  rep_min smallint not null,
  rep_max smallint not null,
  sets smallint not null,
  rest_seconds smallint not null,
  cautions text[] not null default '{}',
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table public.exercise_variations (
  exercise_id text not null references public.exercise_library(id) on delete cascade,
  variation_id text not null references public.exercise_library(id) on delete cascade,
  direction text not null check (direction in ('progression','regression')),
  primary key (exercise_id, variation_id, direction)
);

create table public.exercise_media (
  id uuid primary key default gen_random_uuid(),
  exercise_id text not null references public.exercise_library(id) on delete cascade,
  kind text not null check (kind in ('video','animation','image')),
  url text not null check (url ~ '^https://'),
  licence text not null check (char_length(licence) > 2),      -- every asset must record its licence
  approved boolean not null default false,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.program_phases (
  key text primary key, name text not null, blurb text not null, start_week integer not null, end_week integer
);
create table public.program_weeks (
  week integer primary key, phase_key text not null references public.program_phases(key),
  sessions smallint not null, sets smallint not null, max_sets smallint not null, rep_min smallint not null, rep_max smallint not null, note text not null
);
create table public.workout_templates (letter text primary key check (letter in ('A','B')), name text not null);
create table public.workout_template_exercises (
  letter text not null references public.workout_templates(letter) on delete cascade,
  slot text not null, exercise_id text not null references public.exercise_library(id),
  position smallint not null, optional boolean not null default false,
  primary key (letter, slot)
);

-- ---------------------------------------------------------------- supporters (enforcement in 0002 functions)
create table public.supporter_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) <= 254),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  supporter_id uuid references auth.users(id) on delete cascade,
  revoked_at timestamptz
);
create table public.supporter_permissions (
  invite_id uuid primary key references public.supporter_invites(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  can_see_sessions boolean not null default false,
  can_see_achievements boolean not null default false,
  can_see_metrics boolean not null default false,
  can_see_notes boolean not null default false,
  can_encourage boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.supporter_encouragements (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.supporter_invites(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  supporter_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 280),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- ---------------------------------------------------------------- operations
create table public.app_admins (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event text not null check (char_length(event) <= 80),
  meta jsonb not null default '{}'::jsonb,       -- never store health or journal content here
  created_at timestamptz not null default now()
);
create table public.offline_sync_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  op_id uuid not null,
  entity text not null,
  record_id text not null,
  status text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, op_id)
);
create table public.error_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  area text not null check (char_length(area) <= 60),
  message text not null check (char_length(message) <= 300),   -- sanitised, no personal data
  code text
);

-- ---------------------------------------------------------------- indexes for common queries
create index on public.scheduled_workouts (user_id, date);
create index on public.workout_sessions (user_id, date desc);
create index on public.exercise_sets (session_id);
create index on public.exercise_sets (user_id, exercise_id, completed_at desc);
create index on public.readiness_checkins (user_id, date desc);
create index on public.progression_recommendations (user_id, exercise_id, created_at desc);
create index on public.progression_decisions (user_id, exercise_id);
create index on public.journal_entries (user_id, date desc);
create index on public.training_programs (user_id);
create index on public.supporter_invites (owner_id);
create index on public.supporter_invites (supporter_id);
create index on public.audit_events (user_id, created_at desc);
create index on public.error_events (created_at desc);
create index on public.exercise_media (exercise_id);

-- server_updated_at triggers on every synced table
do $$
declare t text;
begin
  foreach t in array array['profiles','user_preferences','equipment_inventory','health_considerations','fitness_goals','notification_preferences',
    'training_programs','scheduled_workouts','workout_sessions','exercise_sets','readiness_checkins','progression_recommendations',
    'progression_decisions','personal_milestones','journal_entries'] loop
    execute format('create trigger touch_%1$s before insert or update on public.%1$I for each row execute function public.touch_server_updated_at()', t);
  end loop;
end $$;
