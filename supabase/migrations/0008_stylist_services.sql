-- Stylist service eligibility: which stylists can perform which services.
-- Safe to run; creates table only if missing. No existing data removed.

create table if not exists public.stylist_services (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  unique(stylist_id, service_id)
);

comment on table public.stylist_services is 'Which stylists are eligible to perform which services.';

create index if not exists stylist_services_stylist_id_idx on public.stylist_services (stylist_id);
create index if not exists stylist_services_service_id_idx on public.stylist_services (service_id);

alter table public.stylist_services enable row level security;

drop policy if exists "Authenticated users can manage stylist_services" on public.stylist_services;
create policy "Authenticated users can manage stylist_services"
  on public.stylist_services for all using (auth.role() = 'authenticated');

-- Optional seed: assign first two services to first two active stylists (run manually if desired).
-- insert into public.stylist_services (stylist_id, service_id)
-- select s.id, sv.id
-- from (select id from public.stylists where is_active = true order by id limit 2) s
-- cross join (select id from public.services order by name limit 2) sv
-- on conflict (stylist_id, service_id) do nothing;
