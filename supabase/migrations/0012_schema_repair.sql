-- Schema repair / catch-up migration (SAFE + IDEMPOTENT).
-- Purpose: bring the database schema in line with what the app references.
--
-- Rules:
-- - Never drop tables/columns/data
-- - Use CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
-- - Add foreign keys and policies only when missing (defensive DO blocks)
--
-- IMPORTANT NOTE ABOUT ORDER:
-- This repository already contains `0012_deposit_rules_no_show_restrictions.sql`.
-- Supabase runs migrations in filename sort order, so ensure this file is applied
-- in the correct sequence for your environment (see run instructions in the audit output).

-- =============================================================================
-- 1) Roles / core org tables expected by auth + dashboard nav
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'salon_role' and typnamespace = 'public'::regnamespace) then
    create type public.salon_role as enum ('guest', 'stylist', 'manager', 'admin');
  end if;
end $$;

create table if not exists public.salons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists locations_salon_id_idx on public.locations (salon_id);

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='salons')
     and exists (select 1 from information_schema.tables where table_schema='public' and table_name='locations')
     and not exists (
       select 1
       from information_schema.table_constraints tc
       where tc.table_schema='public'
         and tc.table_name='locations'
         and tc.constraint_type='FOREIGN KEY'
         and tc.constraint_name='locations_salon_id_fkey'
     ) then
    alter table public.locations
      add constraint locations_salon_id_fkey
      foreign key (salon_id) references public.salons(id) on delete cascade;
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.salon_role not null default 'stylist',
  salon_id uuid,
  location_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text;
alter table public.profiles
  add column if not exists full_name text;
alter table public.profiles
  add column if not exists role public.salon_role;
alter table public.profiles
  add column if not exists salon_id uuid;
alter table public.profiles
  add column if not exists location_id uuid;
alter table public.profiles
  add column if not exists created_at timestamptz;
alter table public.profiles
  add column if not exists updated_at timestamptz;

create index if not exists profiles_salon_id_idx on public.profiles (salon_id);
create index if not exists profiles_location_id_idx on public.profiles (location_id);

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='salons')
     and not exists (
       select 1 from information_schema.table_constraints tc
       where tc.table_schema='public'
         and tc.table_name='profiles'
         and tc.constraint_type='FOREIGN KEY'
         and tc.constraint_name='profiles_salon_id_fkey'
     ) then
    alter table public.profiles
      add constraint profiles_salon_id_fkey
      foreign key (salon_id) references public.salons(id) on delete set null;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='locations')
     and not exists (
       select 1 from information_schema.table_constraints tc
       where tc.table_schema='public'
         and tc.table_name='profiles'
         and tc.constraint_type='FOREIGN KEY'
         and tc.constraint_name='profiles_location_id_fkey'
     ) then
    alter table public.profiles
      add constraint profiles_location_id_fkey
      foreign key (location_id) references public.locations(id) on delete set null;
  end if;
end $$;

-- =============================================================================
-- 2) Core business tables referenced throughout the app
-- =============================================================================

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.clients add column if not exists hair_history text;
alter table public.clients add column if not exists color_history text;
alter table public.clients add column if not exists allergy_notes text;
alter table public.clients add column if not exists preferred_stylist_id uuid;
alter table public.clients add column if not exists no_show_count integer default 0;
alter table public.clients add column if not exists last_no_show_at timestamptz;
alter table public.clients add column if not exists deposit_required boolean default false;
alter table public.clients add column if not exists booking_restricted boolean default false;
alter table public.clients add column if not exists restriction_note text;

create index if not exists clients_preferred_stylist_id_idx on public.clients (preferred_stylist_id);

create table if not exists public.stylists (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_minutes integer,
  price_cents integer,
  created_at timestamptz not null default now()
);

create index if not exists services_name_idx on public.services (name);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  service_id uuid,
  stylist_id uuid,
  start_at timestamptz not null,
  end_at timestamptz,
  appointment_date date not null,
  appointment_time time not null,
  status text not null default 'scheduled',
  notes text,
  cancellation_note text,
  service_goal text,
  consultation_required boolean default false,
  intake_notes text,
  deleted_at timestamptz,
  appointment_price_cents integer,
  tip_cents integer default 0,
  payment_status text default 'unpaid',
  paid_at timestamptz,
  deposit_required boolean default false,
  deposit_amount_cents integer,
  deposit_status text default 'not_required',
  created_at timestamptz not null default now()
);

-- Ensure columns exist even if appointments pre-dated migrations
alter table public.appointments add column if not exists client_id uuid;
alter table public.appointments add column if not exists service_id uuid;
alter table public.appointments add column if not exists stylist_id uuid;
alter table public.appointments add column if not exists start_at timestamptz;
alter table public.appointments add column if not exists end_at timestamptz;
alter table public.appointments add column if not exists appointment_date date;
alter table public.appointments add column if not exists appointment_time time;
alter table public.appointments add column if not exists status text default 'scheduled';
alter table public.appointments add column if not exists notes text;
alter table public.appointments add column if not exists cancellation_note text;
alter table public.appointments add column if not exists service_goal text;
alter table public.appointments add column if not exists consultation_required boolean default false;
alter table public.appointments add column if not exists intake_notes text;
alter table public.appointments add column if not exists deleted_at timestamptz;
alter table public.appointments add column if not exists appointment_price_cents integer;
alter table public.appointments add column if not exists tip_cents integer default 0;
alter table public.appointments add column if not exists payment_status text default 'unpaid';
alter table public.appointments add column if not exists paid_at timestamptz;
alter table public.appointments add column if not exists deposit_required boolean default false;
alter table public.appointments add column if not exists deposit_amount_cents integer;
alter table public.appointments add column if not exists deposit_status text default 'not_required';

create index if not exists appointments_client_id_idx on public.appointments (client_id);
create index if not exists appointments_stylist_id_idx on public.appointments (stylist_id);
create index if not exists appointments_appointment_date_idx on public.appointments (appointment_date);
create index if not exists appointments_start_at_idx on public.appointments (start_at);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints tc
    where tc.table_schema='public'
      and tc.table_name='appointments'
      and tc.constraint_type='FOREIGN KEY'
      and tc.constraint_name='appointments_client_id_fkey'
  ) then
    alter table public.appointments
      add constraint appointments_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints tc
    where tc.table_schema='public'
      and tc.table_name='appointments'
      and tc.constraint_type='FOREIGN KEY'
      and tc.constraint_name='appointments_service_id_fkey'
  ) then
    alter table public.appointments
      add constraint appointments_service_id_fkey
      foreign key (service_id) references public.services(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints tc
    where tc.table_schema='public'
      and tc.table_name='appointments'
      and tc.constraint_type='FOREIGN KEY'
      and tc.constraint_name='appointments_stylist_id_fkey'
  ) then
    alter table public.appointments
      add constraint appointments_stylist_id_fkey
      foreign key (stylist_id) references public.stylists(id) on delete set null;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='stylists')
     and not exists (
       select 1 from information_schema.table_constraints tc
       where tc.table_schema='public'
         and tc.table_name='clients'
         and tc.constraint_type='FOREIGN KEY'
         and tc.constraint_name='clients_preferred_stylist_id_fkey'
     ) then
    alter table public.clients
      add constraint clients_preferred_stylist_id_fkey
      foreign key (preferred_stylist_id) references public.stylists(id) on delete set null;
  end if;
end $$;

-- =============================================================================
-- 3) Scheduling support tables
-- =============================================================================

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

create index if not exists stylist_working_hours_stylist_id_idx on public.stylist_working_hours (stylist_id);

create table if not exists public.stylist_blocked_time (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null,
  block_date date not null,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists stylist_blocked_time_stylist_date_idx on public.stylist_blocked_time (stylist_id, block_date);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints tc
    where tc.table_schema='public'
      and tc.table_name='stylist_working_hours'
      and tc.constraint_type='FOREIGN KEY'
      and tc.constraint_name='stylist_working_hours_stylist_id_fkey'
  ) then
    alter table public.stylist_working_hours
      add constraint stylist_working_hours_stylist_id_fkey
      foreign key (stylist_id) references public.stylists(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints tc
    where tc.table_schema='public'
      and tc.table_name='stylist_blocked_time'
      and tc.constraint_type='FOREIGN KEY'
      and tc.constraint_name='stylist_blocked_time_stylist_id_fkey'
  ) then
    alter table public.stylist_blocked_time
      add constraint stylist_blocked_time_stylist_id_fkey
      foreign key (stylist_id) references public.stylists(id) on delete cascade;
  end if;
end $$;

-- =============================================================================
-- 4) Eligibility / memory / intake support tables
-- =============================================================================

create table if not exists public.stylist_services (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null,
  service_id uuid not null,
  unique (stylist_id, service_id)
);

create index if not exists stylist_services_stylist_id_idx on public.stylist_services (stylist_id);
create index if not exists stylist_services_service_id_idx on public.stylist_services (service_id);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints tc
    where tc.table_schema='public'
      and tc.table_name='stylist_services'
      and tc.constraint_type='FOREIGN KEY'
      and tc.constraint_name='stylist_services_stylist_id_fkey'
  ) then
    alter table public.stylist_services
      add constraint stylist_services_stylist_id_fkey
      foreign key (stylist_id) references public.stylists(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints tc
    where tc.table_schema='public'
      and tc.table_name='stylist_services'
      and tc.constraint_type='FOREIGN KEY'
      and tc.constraint_name='stylist_services_service_id_fkey'
  ) then
    alter table public.stylist_services
      add constraint stylist_services_service_id_fkey
      foreign key (service_id) references public.services(id) on delete cascade;
  end if;
end $$;

create table if not exists public.appointment_memories (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null,
  formula_notes text,
  developer_notes text,
  technique_notes text,
  processing_notes text,
  aftercare_notes text,
  photo_urls text[],
  created_at timestamptz not null default now(),
  unique (appointment_id)
);

create index if not exists appointment_memories_appointment_id_idx
  on public.appointment_memories (appointment_id);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints tc
    where tc.table_schema='public'
      and tc.table_name='appointment_memories'
      and tc.constraint_type='FOREIGN KEY'
      and tc.constraint_name='appointment_memories_appointment_id_fkey'
  ) then
    alter table public.appointment_memories
      add constraint appointment_memories_appointment_id_fkey
      foreign key (appointment_id) references public.appointments(id) on delete cascade;
  end if;
end $$;

create table if not exists public.intake_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid null,
  appointment_id uuid null,
  source text,
  requested_service text,
  requested_stylist text,
  timing_preference text,
  budget_notes text,
  concern_notes text,
  ai_summary text,
  created_at timestamptz not null default now()
);

create index if not exists intake_sessions_client_id_created_at_idx
  on public.intake_sessions (client_id, created_at desc);
create index if not exists intake_sessions_appointment_id_idx
  on public.intake_sessions (appointment_id);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints tc
    where tc.table_schema='public'
      and tc.table_name='intake_sessions'
      and tc.constraint_type='FOREIGN KEY'
      and tc.constraint_name='intake_sessions_client_id_fkey'
  ) then
    alter table public.intake_sessions
      add constraint intake_sessions_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints tc
    where tc.table_schema='public'
      and tc.table_name='intake_sessions'
      and tc.constraint_type='FOREIGN KEY'
      and tc.constraint_name='intake_sessions_appointment_id_fkey'
  ) then
    alter table public.intake_sessions
      add constraint intake_sessions_appointment_id_fkey
      foreign key (appointment_id) references public.appointments(id) on delete set null;
  end if;
end $$;

-- =============================================================================
-- 5) RLS + policies (repair partially-applied policies without dropping existing)
-- =============================================================================

alter table public.salons enable row level security;
alter table public.locations enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.stylists enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.stylist_working_hours enable row level security;
alter table public.stylist_blocked_time enable row level security;
alter table public.stylist_services enable row level security;
alter table public.intake_sessions enable row level security;
alter table public.appointment_memories enable row level security;

-- Profiles: self read/write (safe, only if missing)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Users can view own profile'
  ) then
    create policy "Users can view own profile"
      on public.profiles for select
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Users can update own profile'
  ) then
    create policy "Users can update own profile"
      on public.profiles for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

-- Minimal org read policies (only if missing)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='salons' and policyname='Authenticated users can view salons'
  ) then
    create policy "Authenticated users can view salons"
      on public.salons for select
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='locations' and policyname='Authenticated users can view locations'
  ) then
    create policy "Authenticated users can view locations"
      on public.locations for select
      using (auth.role() = 'authenticated');
  end if;
end $$;

-- Authenticated manage policies:
-- Many earlier migrations created `FOR ALL USING (...)` policies, which do NOT permit inserts/updates without WITH CHECK.
-- We add explicit INSERT/UPDATE/DELETE policies with WITH CHECK, without dropping existing policies.
do $$
declare
  t text;
begin
  foreach t in array ['clients','stylists','services','appointments','stylist_services','intake_sessions','appointment_memories'] loop
    if not exists (
      select 1 from pg_policies where schemaname='public' and tablename=t and policyname='Authenticated users can insert'
    ) then
      execute format(
        'create policy "Authenticated users can insert" on public.%I for insert with check (auth.role() = ''authenticated'');',
        t
      );
    end if;

    if not exists (
      select 1 from pg_policies where schemaname='public' and tablename=t and policyname='Authenticated users can update'
    ) then
      execute format(
        'create policy "Authenticated users can update" on public.%I for update using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'');',
        t
      );
    end if;

    if not exists (
      select 1 from pg_policies where schemaname='public' and tablename=t and policyname='Authenticated users can delete'
    ) then
      execute format(
        'create policy "Authenticated users can delete" on public.%I for delete using (auth.role() = ''authenticated'');',
        t
      );
    end if;
  end loop;
end $$;

-- Availability tables: allow SELECT for authenticated (only if missing)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='stylist_working_hours' and policyname='Authenticated users can view stylist working hours'
  ) then
    create policy "Authenticated users can view stylist working hours"
      on public.stylist_working_hours for select
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='stylist_blocked_time' and policyname='Authenticated users can view stylist blocked time'
  ) then
    create policy "Authenticated users can view stylist blocked time"
      on public.stylist_blocked_time for select
      using (auth.role() = 'authenticated');
  end if;
end $$;

