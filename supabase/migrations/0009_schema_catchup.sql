-- Schema catch-up migration.
-- Goal: ensure all columns/indexes referenced by the app exist, without
-- dropping or overwriting any existing data.
--
-- This file is safe to run multiple times:
-- - Uses CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
-- - Uses defensive checks before adding foreign keys.

-- ============================================================================
-- clients
-- ============================================================================

-- Core columns (table itself is already created in 0004, but guard just in case).
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

-- History / intake / preferences / no-show tracking
alter table public.clients
  add column if not exists hair_history text;

alter table public.clients
  add column if not exists color_history text;

alter table public.clients
  add column if not exists allergy_notes text;

alter table public.clients
  add column if not exists preferred_stylist_id uuid;

alter table public.clients
  add column if not exists no_show_count integer default 0;

alter table public.clients
  add column if not exists last_no_show_at timestamptz;

-- Preferred stylist FK (only if not already present).
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'stylists'
  ) then
    if not exists (
      select 1
      from information_schema.table_constraints tc
      where tc.table_schema = 'public'
        and tc.table_name = 'clients'
        and tc.constraint_type = 'FOREIGN KEY'
        and tc.constraint_name = 'clients_preferred_stylist_id_fkey'
    ) then
      alter table public.clients
        add constraint clients_preferred_stylist_id_fkey
        foreign key (preferred_stylist_id) references public.stylists(id) on delete set null;
    end if;
  end if;
end $$;

create index if not exists clients_preferred_stylist_id_idx
  on public.clients (preferred_stylist_id);

-- ============================================================================
-- stylists
-- ============================================================================

create table if not exists public.stylists (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- services
-- ============================================================================

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_minutes integer,
  price_cents integer,
  created_at timestamptz not null default now()
);

create index if not exists services_name_idx
  on public.services (name);

-- ============================================================================
-- appointments
-- ============================================================================

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  stylist_id uuid references public.stylists(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz,
  appointment_date date not null,
  appointment_time time not null,
  status text not null default 'scheduled',
  notes text,
  cancellation_note text,
  created_at timestamptz not null default now()
);

-- Ensure all columns expected by the app exist even if the table pre-dated migrations.
alter table public.appointments
  add column if not exists client_id uuid;

alter table public.appointments
  add column if not exists service_id uuid;

alter table public.appointments
  add column if not exists stylist_id uuid;

alter table public.appointments
  add column if not exists start_at timestamptz;

alter table public.appointments
  add column if not exists end_at timestamptz;

alter table public.appointments
  add column if not exists appointment_date date;

alter table public.appointments
  add column if not exists appointment_time time;

alter table public.appointments
  add column if not exists status text default 'scheduled';

alter table public.appointments
  add column if not exists notes text;

alter table public.appointments
  add column if not exists cancellation_note text;

alter table public.appointments
  add column if not exists service_goal text;

alter table public.appointments
  add column if not exists consultation_required boolean default false;

alter table public.appointments
  add column if not exists intake_notes text;

alter table public.appointments
  add column if not exists deleted_at timestamptz;

-- (Re)assert foreign keys only if missing.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'clients'
  ) then
    if not exists (
      select 1
      from information_schema.table_constraints tc
      where tc.table_schema = 'public'
        and tc.table_name = 'appointments'
        and tc.constraint_type = 'FOREIGN KEY'
        and tc.constraint_name = 'appointments_client_id_fkey'
    ) then
      alter table public.appointments
        add constraint appointments_client_id_fkey
        foreign key (client_id) references public.clients(id) on delete set null;
    end if;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'services'
  ) then
    if not exists (
      select 1
      from information_schema.table_constraints tc
      where tc.table_schema = 'public'
        and tc.table_name = 'appointments'
        and tc.constraint_type = 'FOREIGN KEY'
        and tc.constraint_name = 'appointments_service_id_fkey'
    ) then
      alter table public.appointments
        add constraint appointments_service_id_fkey
        foreign key (service_id) references public.services(id) on delete set null;
    end if;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'stylists'
  ) then
    if not exists (
      select 1
      from information_schema.table_constraints tc
      where tc.table_schema = 'public'
        and tc.table_name = 'appointments'
        and tc.constraint_type = 'FOREIGN KEY'
        and tc.constraint_name = 'appointments_stylist_id_fkey'
    ) then
      alter table public.appointments
        add constraint appointments_stylist_id_fkey
        foreign key (stylist_id) references public.stylists(id) on delete set null;
    end if;
  end if;
end $$;

-- Indexes for common filters used in the app.
create index if not exists appointments_client_id_idx
  on public.appointments (client_id);

create index if not exists appointments_stylist_id_idx
  on public.appointments (stylist_id);

create index if not exists appointments_appointment_date_idx
  on public.appointments (appointment_date);

create index if not exists appointments_start_at_idx
  on public.appointments (start_at);

-- ============================================================================
-- stylist_working_hours and stylist_blocked_time
-- (tables and basic indexes are created in 0002; we just ensure presence)
-- ============================================================================

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

create index if not exists stylist_working_hours_stylist_id_idx
  on public.stylist_working_hours (stylist_id);

create table if not exists public.stylist_blocked_time (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null,
  block_date date not null,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists stylist_blocked_time_stylist_date_idx
  on public.stylist_blocked_time (stylist_id, block_date);

-- ============================================================================
-- stylist_services
-- ============================================================================

create table if not exists public.stylist_services (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  unique (stylist_id, service_id)
);

create index if not exists stylist_services_stylist_id_idx
  on public.stylist_services (stylist_id);

create index if not exists stylist_services_service_id_idx
  on public.stylist_services (service_id);

-- ============================================================================
-- profiles / salons / locations
-- (initially created in 0001; here we only ensure key columns exist)
-- ============================================================================

-- Enum and core tables should already exist, but guard for safety.
do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'salon_role'
  ) then
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
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists locations_salon_id_idx
  on public.locations (salon_id);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.salon_role not null default 'stylist',
  salon_id uuid references public.salons(id),
  location_id uuid references public.locations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists role public.salon_role not null default 'stylist';

alter table public.profiles
  add column if not exists salon_id uuid;

alter table public.profiles
  add column if not exists location_id uuid;

create index if not exists profiles_salon_id_idx
  on public.profiles (salon_id);

create index if not exists profiles_location_id_idx
  on public.profiles (location_id);

