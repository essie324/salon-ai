-- salon_role enum to align with AppRole in the app
create type public.salon_role as enum ('guest', 'stylist', 'manager', 'admin');

-- Core business entities

create table public.salons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists locations_salon_id_idx on public.locations (salon_id);

-- Profiles linked 1:1 with auth.users

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.salon_role not null default 'stylist',
  salon_id uuid references public.salons(id),
  location_id uuid references public.locations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_salon_id_idx on public.profiles (salon_id);
create index if not exists profiles_location_id_idx on public.profiles (location_id);

-- Keep updated_at fresh

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_current_timestamp_updated_at();

-- Automatically create a profile when a new auth user is created

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Row Level Security (RLS) direction

alter table public.salons enable row level security;
alter table public.locations enable row level security;
alter table public.profiles enable row level security;

-- Minimal safe policies:
-- - users can see and edit their own profile

create policy "Users can view own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id);

-- For now, allow authenticated users to see their salon + locations
-- (further scoping to roles/salons can be added later).

create policy "Authenticated users can view salons"
on public.salons
for select
using (auth.role() = 'authenticated');

create policy "Authenticated users can view locations"
on public.locations
for select
using (auth.role() = 'authenticated');

