-- Fix appointment_memories RLS policy:
-- The original policy used `FOR ALL` with only a `USING` clause.
-- Inserts/updates require a `WITH CHECK` clause, otherwise writes can be blocked.

alter table public.appointment_memories enable row level security;

drop policy if exists "Authenticated users can manage appointment_memories" on public.appointment_memories;

create policy "Authenticated users can manage appointment_memories"
  on public.appointment_memories
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

