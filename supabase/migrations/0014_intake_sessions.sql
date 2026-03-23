-- Intake sessions: conversational/request context for bookings.
-- Safe, idempotent migration: creates table only if missing.

create table if not exists public.intake_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid null references public.clients(id) on delete set null,
  appointment_id uuid null references public.appointments(id) on delete set null,
  source text,
  requested_service text,
  requested_stylist text,
  timing_preference text,
  budget_notes text,
  concern_notes text,
  ai_summary text,
  created_at timestamptz not null default now()
);

comment on table public.intake_sessions is 'Booking intake/request context (AI/SMS/web/call), separate from operational appointment facts.';

create index if not exists intake_sessions_client_id_created_at_idx
  on public.intake_sessions (client_id, created_at desc);

create index if not exists intake_sessions_appointment_id_idx
  on public.intake_sessions (appointment_id);

alter table public.intake_sessions enable row level security;

drop policy if exists "Authenticated users can manage intake_sessions" on public.intake_sessions;
create policy "Authenticated users can manage intake_sessions"
  on public.intake_sessions for all
  using (auth.role() = 'authenticated');

