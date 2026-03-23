-- Appointment visit memory (formulas + photos).
-- Safe, idempotent migration: creates table only if missing.

create table if not exists public.appointment_memories (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  formula_notes text,
  developer_notes text,
  technique_notes text,
  processing_notes text,
  aftercare_notes text,
  photo_urls text[],
  created_at timestamptz not null default now(),
  unique (appointment_id)
);

comment on table public.appointment_memories is 'Per-appointment visit memory: formulas, techniques, aftercare, and photo references.';

create index if not exists appointment_memories_appointment_id_idx
  on public.appointment_memories (appointment_id);

alter table public.appointment_memories enable row level security;

drop policy if exists "Authenticated users can manage appointment_memories" on public.appointment_memories;
create policy "Authenticated users can manage appointment_memories"
  on public.appointment_memories for all
  using (auth.role() = 'authenticated');

