-- Soft delete / archive support for appointments.
-- Adds a nullable deleted_at column used to hide archived records from active views.

alter table public.appointments
  add column if not exists deleted_at timestamptz;

