-- Optional intake and consultation fields for AI-assisted booking
-- Safe to run multiple times; only adds columns when missing.

-- ---------------------------------------------------------------------------
-- clients: hair/color history, allergies, preferred stylist
-- ---------------------------------------------------------------------------

alter table public.clients
  add column if not exists hair_history text;

alter table public.clients
  add column if not exists color_history text;

alter table public.clients
  add column if not exists allergy_notes text;

alter table public.clients
  add column if not exists preferred_stylist_id uuid;

alter table public.clients
  add constraint if not exists clients_preferred_stylist_id_fkey
  foreign key (preferred_stylist_id) references public.stylists(id) on delete set null;

-- ---------------------------------------------------------------------------
-- appointments: structured intake / consultation fields
-- ---------------------------------------------------------------------------

alter table public.appointments
  add column if not exists service_goal text;

alter table public.appointments
  add column if not exists consultation_required boolean default false;

alter table public.appointments
  add column if not exists intake_notes text;

