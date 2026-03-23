-- Deposit rules + booking restrictions fields.
-- Safe, idempotent migration: adds columns only if missing.

alter table public.clients
  add column if not exists deposit_required boolean default false;

alter table public.clients
  add column if not exists booking_restricted boolean default false;

alter table public.clients
  add column if not exists restriction_note text;

alter table public.appointments
  add column if not exists deposit_required boolean default false;

alter table public.appointments
  add column if not exists deposit_amount_cents integer;

alter table public.appointments
  add column if not exists deposit_status text default 'not_required';

