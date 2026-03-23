-- Appointment revenue and payment tracking.
-- Safe, idempotent migration: adds columns only if they are missing.

alter table public.appointments
  add column if not exists appointment_price_cents integer;

alter table public.appointments
  add column if not exists tip_cents integer default 0;

alter table public.appointments
  add column if not exists payment_status text default 'unpaid';

alter table public.appointments
  add column if not exists paid_at timestamptz;

