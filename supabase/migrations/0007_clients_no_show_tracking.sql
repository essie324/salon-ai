-- No-show tracking at client level for front desk visibility.
-- Safe to run multiple times; only adds columns when missing.

alter table public.clients
  add column if not exists no_show_count integer default 0;

alter table public.clients
  add column if not exists last_no_show_at timestamptz;
