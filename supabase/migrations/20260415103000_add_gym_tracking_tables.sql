create table if not exists public.gym_program_state (
  scope_id text primary key,
  program jsonb not null check (jsonb_typeof(program) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.gym_exercise_logs (
  id text primary key,
  scope_id text not null,
  program_exercise_id text not null,
  performed_option_key text not null,
  performed_option_label text not null,
  history_key text not null,
  week_number integer not null check (week_number between 1 and 12),
  day_name text not null check (day_name in ('Upper', 'Lower', 'Pull', 'Push', 'Legs')),
  logged_at timestamptz not null,
  exercise_note text,
  set_logs jsonb not null check (jsonb_typeof(set_logs) = 'array'),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists gym_exercise_logs_scope_history_logged_at_idx
  on public.gym_exercise_logs (scope_id, history_key, logged_at desc);

create index if not exists gym_exercise_logs_scope_logged_at_idx
  on public.gym_exercise_logs (scope_id, logged_at desc);

alter table public.gym_program_state enable row level security;
alter table public.gym_exercise_logs enable row level security;

create policy "gym_program_state_select"
  on public.gym_program_state
  for select
  to anon, authenticated
  using (true);

create policy "gym_program_state_insert"
  on public.gym_program_state
  for insert
  to anon, authenticated
  with check (true);

create policy "gym_program_state_update"
  on public.gym_program_state
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "gym_program_state_delete"
  on public.gym_program_state
  for delete
  to anon, authenticated
  using (true);

create policy "gym_exercise_logs_select"
  on public.gym_exercise_logs
  for select
  to anon, authenticated
  using (true);

create policy "gym_exercise_logs_insert"
  on public.gym_exercise_logs
  for insert
  to anon, authenticated
  with check (true);

create policy "gym_exercise_logs_update"
  on public.gym_exercise_logs
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "gym_exercise_logs_delete"
  on public.gym_exercise_logs
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
end;
$$;

grant execute on function public.replace_gym_program(text, jsonb) to anon, authenticated;
grant execute on function public.clear_gym_logs(text) to anon, authenticated;
