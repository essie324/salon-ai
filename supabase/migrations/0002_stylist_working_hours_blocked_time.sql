-- Stylist working hours: recurring weekly schedule per stylist.
-- day_of_week: 0 = Sunday, 1 = Monday, ... 6 = Saturday (matches JS Date.getDay()).
-- start_time / end_time: time of day in salon local time.

create table if not exists public.stylist_working_hours (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null,
  day_of_week smallint not null check (day_of_week >= 0 and day_of_week <= 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  is_working boolean not null default true,
  created_at timestamptz not null default now(),
  unique (stylist_id, day_of_week)
);

comment on table public.stylist_working_hours is 'Recurring weekly working hours per stylist.';
comment on column public.stylist_working_hours.day_of_week is '0=Sunday, 1=Monday, ..., 6=Saturday';

-- If stylists table exists, add FK. Omit if your schema has no stylists table yet.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'stylists') then
    alter table public.stylist_working_hours
      add constraint stylist_working_hours_stylist_id_fkey
      foreign key (stylist_id) references public.stylists(id) on delete cascade;
  end if;
end $$;

create index if not exists stylist_working_hours_stylist_id_idx on public.stylist_working_hours (stylist_id);

-- Blocked time: specific date ranges when a stylist is unavailable (lunch, meeting, off).
create table if not exists public.stylist_blocked_time (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null,
  block_date date not null,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  reason text,
  created_at timestamptz not null default now()
);

comment on table public.stylist_blocked_time is 'One-off blocked time slots per stylist (e.g. lunch, meeting).';

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'stylists') then
    alter table public.stylist_blocked_time
      add constraint stylist_blocked_time_stylist_id_fkey
      foreign key (stylist_id) references public.stylists(id) on delete cascade;
  end if;
end $$;

create index if not exists stylist_blocked_time_stylist_date_idx on public.stylist_blocked_time (stylist_id, block_date);

-- RLS: allow read for authenticated (adjust to match your policies).
alter table public.stylist_working_hours enable row level security;
alter table public.stylist_blocked_time enable row level security;

create policy "Authenticated users can view stylist working hours"
  on public.stylist_working_hours for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can view stylist blocked time"
  on public.stylist_blocked_time for select
  using (auth.role() = 'authenticated');
