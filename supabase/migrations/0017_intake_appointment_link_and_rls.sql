-- Optional link from appointments → intake_sessions + safer RLS on intake_sessions.
-- Idempotent.

-- ---------------------------------------------------------------------------
-- appointments.intake_session_id (optional FK)
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column if not exists intake_session_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_intake_session_id_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_intake_session_id_fkey
      foreign key (intake_session_id)
      references public.intake_sessions (id)
      on delete set null;
  end if;
end $$;

create index if not exists appointments_intake_session_id_idx
  on public.appointments (intake_session_id);

comment on column public.appointments.intake_session_id is 'Optional link to structured intake session (dashboard / future AI).';

-- ---------------------------------------------------------------------------
-- intake_sessions RLS: separate policies with USING + WITH CHECK (insert-safe)
-- ---------------------------------------------------------------------------
alter table public.intake_sessions enable row level security;

drop policy if exists "Authenticated users can manage intake_sessions" on public.intake_sessions;

create policy "intake_sessions_select_authenticated"
  on public.intake_sessions for select
  using (auth.role() = 'authenticated');

create policy "intake_sessions_insert_authenticated"
  on public.intake_sessions for insert
  with check (auth.role() = 'authenticated');

create policy "intake_sessions_update_authenticated"
  on public.intake_sessions for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "intake_sessions_delete_authenticated"
  on public.intake_sessions for delete
  using (auth.role() = 'authenticated');
