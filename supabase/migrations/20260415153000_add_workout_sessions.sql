alter table public.gym_exercise_logs
  add column if not exists day_id text,
  add column if not exists session_id text;

create index if not exists gym_exercise_logs_scope_day_id_idx
  on public.gym_exercise_logs (scope_id, day_id);

create index if not exists gym_exercise_logs_scope_session_id_idx
  on public.gym_exercise_logs (scope_id, session_id);

create table if not exists public.gym_workout_sessions (
  id text primary key,
  scope_id text not null,
  day_id text not null,
  day_name text not null check (day_name in ('Upper', 'Lower', 'Pull', 'Push', 'Legs')),
  week_number integer not null check (week_number between 1 and 12),
  status text not null check (status in ('in_progress', 'completed')),
  started_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (status = 'in_progress' and completed_at is null) or
    (status = 'completed' and completed_at is not null)
  )
);

create index if not exists gym_workout_sessions_scope_day_id_idx
  on public.gym_workout_sessions (scope_id, day_id);

create index if not exists gym_workout_sessions_scope_status_started_at_idx
  on public.gym_workout_sessions (scope_id, status, started_at desc);

create index if not exists gym_workout_sessions_scope_completed_at_idx
  on public.gym_workout_sessions (scope_id, completed_at desc);

alter table public.gym_workout_sessions enable row level security;

create policy "gym_workout_sessions_select"
  on public.gym_workout_sessions
  for select
  to anon, authenticated
  using (true);

create policy "gym_workout_sessions_insert"
  on public.gym_workout_sessions
  for insert
  to anon, authenticated
  with check (true);

create policy "gym_workout_sessions_update"
  on public.gym_workout_sessions
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "gym_workout_sessions_delete"
  on public.gym_workout_sessions
  for delete
  to anon, authenticated
  using (true);

create or replace function public.replace_gym_program(p_scope_id text, p_program jsonb)
returns void
language plpgsql
set search_path = public
as $$
begin
  insert into public.gym_program_state (scope_id, program, updated_at)
  values (p_scope_id, p_program, timezone('utc', now()))
  on conflict (scope_id) do update
    set program = excluded.program,
        updated_at = excluded.updated_at;

  delete from public.gym_exercise_logs
  where scope_id = p_scope_id;

  delete from public.gym_workout_sessions
  where scope_id = p_scope_id;
end;
$$;

create or replace function public.clear_gym_logs(p_scope_id text)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.gym_exercise_logs
  where scope_id = p_scope_id;

  delete from public.gym_workout_sessions
  where scope_id = p_scope_id;
end;
$$;

grant execute on function public.replace_gym_program(text, jsonb) to anon, authenticated;
grant execute on function public.clear_gym_logs(text) to anon, authenticated;
