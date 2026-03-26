-- Outreach follow-up / send-later prep (no automations — staff-managed state only).
-- Safe + idempotent: IF NOT EXISTS patterns; no drops.

-- Self-contained: trigger helper may not exist if earlier migrations were skipped.
create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.outreach_actions (
  id uuid primary key default gen_random_uuid(),
  outreach_key text not null,
  outreach_type text not null,
  client_id uuid not null references public.clients (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  action_state text not null default 'new',
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outreach_actions_outreach_key_unique unique (outreach_key),
  constraint outreach_actions_action_state_check check (
    action_state in ('new', 'reviewed', 'copied', 'scheduled', 'dismissed')
  )
);

create index if not exists outreach_actions_client_id_idx on public.outreach_actions (client_id);
create index if not exists outreach_actions_scheduled_for_idx on public.outreach_actions (scheduled_for)
  where scheduled_for is not null;

drop trigger if exists set_outreach_actions_updated_at on public.outreach_actions;
create trigger set_outreach_actions_updated_at
  before update on public.outreach_actions
  for each row execute function public.set_current_timestamp_updated_at();

alter table public.outreach_actions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'outreach_actions'
      and policyname = 'Authenticated users can manage outreach_actions'
  ) then
    create policy "Authenticated users can manage outreach_actions"
      on public.outreach_actions for all using (auth.role() = 'authenticated');
  end if;
end $$;
