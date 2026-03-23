-- Core business tables required by the app. Safe to run if tables already exist
-- (creates only when missing; adds missing columns where applicable).

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.clients is 'Salon clients.';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'created_at'
  ) then
    alter table public.clients add column created_at timestamptz not null default now();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- stylists
-- ---------------------------------------------------------------------------
create table if not exists public.stylists (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.stylists is 'Salon stylists.';

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'stylists') then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'stylists' and column_name = 'is_active'
    ) then
      alter table public.stylists add column is_active boolean not null default true;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'stylists' and column_name = 'created_at'
    ) then
      alter table public.stylists add column created_at timestamptz not null default now();
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_minutes integer,
  price_cents integer,
  created_at timestamptz not null default now()
);

comment on table public.services is 'Services offered by the salon.';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'services' and column_name = 'created_at'
  ) then
    alter table public.services add column created_at timestamptz not null default now();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
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

comment on table public.appointments is 'Appointment bookings. status: scheduled, confirmed, completed, cancelled, no_show.';

-- If appointments table already existed (e.g. created elsewhere), add missing columns only
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'appointments') then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'appointments' and column_name = 'cancellation_note'
    ) then
      alter table public.appointments add column cancellation_note text;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'appointments' and column_name = 'appointment_date'
    ) then
      alter table public.appointments add column appointment_date date;
      update public.appointments set appointment_date = (start_at at time zone 'utc')::date where appointment_date is null;
      alter table public.appointments alter column appointment_date set not null;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'appointments' and column_name = 'appointment_time'
    ) then
      alter table public.appointments add column appointment_time time;
      update public.appointments set appointment_time = (start_at at time zone 'utc')::time where appointment_time is null;
      alter table public.appointments alter column appointment_time set not null;
    end if;
  end if;
end $$;

-- Indexes for common filters
create index if not exists appointments_client_id_idx on public.appointments (client_id);
create index if not exists appointments_stylist_id_idx on public.appointments (stylist_id);
create index if not exists appointments_appointment_date_idx on public.appointments (appointment_date);
create index if not exists appointments_start_at_idx on public.appointments (start_at);

-- RLS (allow read for authenticated; adjust policies for your auth model)
alter table public.clients enable row level security;
alter table public.stylists enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

create policy "Authenticated users can manage clients"
  on public.clients for all using (auth.role() = 'authenticated');

create policy "Authenticated users can manage stylists"
  on public.stylists for all using (auth.role() = 'authenticated');

create policy "Authenticated users can manage services"
  on public.services for all using (auth.role() = 'authenticated');

create policy "Authenticated users can manage appointments"
  on public.appointments for all using (auth.role() = 'authenticated');
