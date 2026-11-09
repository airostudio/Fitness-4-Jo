-- JoStrong 0005: optional nutrition support (food-group serves, preferences). Private to the owner; never visible to supporters or admins.
create table public.nutrition_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,                       -- opt-in
  style text not null check (style in ('everything','pescatarian','vegetarian','vegan')),
  avoid text[] not null default '{}',
  avoid_other text not null default '' check (char_length(avoid_other) <= 200),
  show_protein_guide boolean not null default true,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);
create table public.nutrition_logs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  serves jsonb not null,
  water_cups smallint not null default 0 check (water_cups between 0 and 30),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);
create index on public.nutrition_logs (user_id, date desc);

create trigger touch_nutrition_preferences before insert or update on public.nutrition_preferences for each row execute function public.touch_server_updated_at();
create trigger touch_nutrition_logs before insert or update on public.nutrition_logs for each row execute function public.touch_server_updated_at();

alter table public.nutrition_preferences enable row level security;
alter table public.nutrition_logs enable row level security;
create policy "owner full access" on public.nutrition_preferences for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owner full access" on public.nutrition_logs for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.nutrition_preferences, public.nutrition_logs from anon, authenticated;
grant select, insert, update, delete on public.nutrition_preferences, public.nutrition_logs to authenticated;
