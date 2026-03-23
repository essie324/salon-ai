-- Development seed data. Safe to run multiple times (upserts by id / unique keys).
-- Run after migrations. Requires: clients, stylists, services, appointments, stylist_working_hours.
--
-- Run with: psql $DATABASE_URL -f supabase/seed.sql
-- Or via Supabase: run the SQL in the SQL Editor.

-- ---------------------------------------------------------------------------
-- Stylists (3)
-- ---------------------------------------------------------------------------
insert into public.stylists (id, first_name, last_name, is_active, created_at)
values
  ('a1000001-0000-4000-8000-000000000001', 'Maya', 'Chen', true, now()),
  ('a1000001-0000-4000-8000-000000000002', 'Jordan', 'Rivera', true, now()),
  ('a1000001-0000-4000-8000-000000000003', 'Sam', 'Taylor', true, now())
on conflict (id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  is_active = excluded.is_active;

-- ---------------------------------------------------------------------------
-- Services (5) with durations and prices
-- ---------------------------------------------------------------------------
insert into public.services (id, name, duration_minutes, price_cents, created_at)
values
  ('b2000002-0000-4000-8000-000000000001', 'Haircut', 45, 4500, now()),
  ('b2000002-0000-4000-8000-000000000002', 'Color & Highlights', 120, 12000, now()),
  ('b2000002-0000-4000-8000-000000000003', 'Blowout', 30, 3500, now()),
  ('b2000002-0000-4000-8000-000000000004', 'Balayage', 180, 18500, now()),
  ('b2000002-0000-4000-8000-000000000005', 'Consultation', 15, 0, now())
on conflict (id) do update set
  name = excluded.name,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents;

-- ---------------------------------------------------------------------------
-- Clients (10)
-- ---------------------------------------------------------------------------
insert into public.clients (id, first_name, last_name, email, phone, notes, created_at)
values
  ('c3000003-0000-4000-8000-000000000001', 'Alex', 'Kim', 'alex.kim@example.com', '555-0101', null, now()),
  ('c3000003-0000-4000-8000-000000000002', 'Blake', 'Martinez', 'blake.m@example.com', '555-0102', 'Prefers morning slots', now()),
  ('c3000003-0000-4000-8000-000000000003', 'Casey', 'Nguyen', 'casey.nguyen@example.com', '555-0103', null, now()),
  ('c3000003-0000-4000-8000-000000000004', 'Drew', 'Johnson', 'drew.j@example.com', null, null, now()),
  ('c3000003-0000-4000-8000-000000000005', 'Emery', 'Lee', 'emery.lee@example.com', '555-0105', 'Allergy note: patch test for color', now()),
  ('c3000003-0000-4000-8000-000000000006', 'Finley', 'Brown', 'finley.b@example.com', '555-0106', null, now()),
  ('c3000003-0000-4000-8000-000000000007', 'Jordan', 'Davis', 'jordan.d@example.com', '555-0107', null, now()),
  ('c3000003-0000-4000-8000-000000000008', 'Morgan', 'Wilson', 'morgan.w@example.com', null, 'First visit', now()),
  ('c3000003-0000-4000-8000-000000000009', 'Riley', 'Garcia', 'riley.g@example.com', '555-0109', null, now()),
  ('c3000003-0000-4000-8000-000000000010', 'Skyler', 'Anderson', 'skyler.a@example.com', '555-0110', null, now())
on conflict (id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  email = excluded.email,
  phone = excluded.phone,
  notes = excluded.notes;

-- ---------------------------------------------------------------------------
-- Working hours: Mon–Fri 09:00–17:00 for each stylist (day_of_week 1=Mon .. 5=Fri)
-- ---------------------------------------------------------------------------
insert into public.stylist_working_hours (stylist_id, day_of_week, start_time, end_time, is_working, created_at)
values
  ('a1000001-0000-4000-8000-000000000001', 1, '09:00', '17:00', true, now()),
  ('a1000001-0000-4000-8000-000000000001', 2, '09:00', '17:00', true, now()),
  ('a1000001-0000-4000-8000-000000000001', 3, '09:00', '17:00', true, now()),
  ('a1000001-0000-4000-8000-000000000001', 4, '09:00', '17:00', true, now()),
  ('a1000001-0000-4000-8000-000000000001', 5, '09:00', '17:00', true, now()),
  ('a1000001-0000-4000-8000-000000000002', 1, '09:00', '17:00', true, now()),
  ('a1000001-0000-4000-8000-000000000002', 2, '09:00', '17:00', true, now()),
  ('a1000001-0000-4000-8000-000000000002', 3, '09:00', '17:00', true, now()),
  ('a1000001-0000-4000-8000-000000000002', 4, '09:00', '17:00', true, now()),
  ('a1000001-0000-4000-8000-000000000002', 5, '09:00', '17:00', true, now()),
  ('a1000001-0000-4000-8000-000000000003', 1, '09:00', '17:00', true, now()),
  ('a1000001-0000-4000-8000-000000000003', 2, '09:00', '17:00', true, now()),
  ('a1000001-0000-4000-8000-000000000003', 3, '09:00', '17:00', true, now()),
  ('a1000001-0000-4000-8000-000000000003', 4, '09:00', '17:00', true, now()),
  ('a1000001-0000-4000-8000-000000000003', 5, '09:00', '17:00', true, now())
on conflict (stylist_id, day_of_week) do update set
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  is_working = excluded.is_working;

-- ---------------------------------------------------------------------------
-- Example appointments (today + tomorrow, mixed statuses)
-- Use current date so at least some show up in "upcoming" regardless of when seed runs.
-- ---------------------------------------------------------------------------
insert into public.appointments (
  id,
  client_id,
  service_id,
  stylist_id,
  start_at,
  end_at,
  appointment_date,
  appointment_time,
  status,
  notes,
  cancellation_note,
  created_at
)
values
  -- Today: a few scheduled/confirmed
  (
    'd4000004-0000-4000-8000-000000000001',
    'c3000003-0000-4000-8000-000000000001',
    'b2000002-0000-4000-8000-000000000001',
    'a1000001-0000-4000-8000-000000000001',
    (current_date + time '10:00') at time zone 'utc',
    (current_date + time '10:45') at time zone 'utc',
    current_date,
    '10:00',
    'scheduled',
    null,
    null,
    now()
  ),
  (
    'd4000004-0000-4000-8000-000000000002',
    'c3000003-0000-4000-8000-000000000002',
    'b2000002-0000-4000-8000-000000000003',
    'a1000001-0000-4000-8000-000000000001',
    (current_date + time '14:00') at time zone 'utc',
    (current_date + time '14:30') at time zone 'utc',
    current_date,
    '14:00',
    'confirmed',
    null,
    null,
    now()
  ),
  (
    'd4000004-0000-4000-8000-000000000003',
    'c3000003-0000-4000-8000-000000000003',
    'b2000002-0000-4000-8000-000000000001',
    'a1000001-0000-4000-8000-000000000002',
    (current_date + time '11:00') at time zone 'utc',
    (current_date + time '11:45') at time zone 'utc',
    current_date,
    '11:00',
    'completed',
    null,
    null,
    now()
  ),
  -- Tomorrow
  (
    'd4000004-0000-4000-8000-000000000004',
    'c3000003-0000-4000-8000-000000000004',
    'b2000002-0000-4000-8000-000000000001',
    'a1000001-0000-4000-8000-000000000002',
    (current_date + interval '1 day' + time '09:00') at time zone 'utc',
    (current_date + interval '1 day' + time '09:45') at time zone 'utc',
    current_date + interval '1 day',
    '09:00',
    'scheduled',
    null,
    null,
    now()
  ),
  (
    'd4000004-0000-4000-8000-000000000005',
    'c3000003-0000-4000-8000-000000000005',
    'b2000002-0000-4000-8000-000000000002',
    'a1000001-0000-4000-8000-000000000003',
    (current_date + interval '1 day' + time '13:00') at time zone 'utc',
    (current_date + interval '1 day' + time '15:00') at time zone 'utc',
    current_date + interval '1 day',
    '13:00',
    'scheduled',
    'Full highlight refresh',
    null,
    now()
  ),
  -- One cancelled (past or today)
  (
    'd4000004-0000-4000-8000-000000000006',
    'c3000003-0000-4000-8000-000000000006',
    'b2000002-0000-4000-8000-000000000001',
    'a1000001-0000-4000-8000-000000000001',
    (current_date + time '16:00') at time zone 'utc',
    (current_date + time '16:45') at time zone 'utc',
    current_date,
    '16:00',
    'cancelled',
    null,
    'Client rescheduled',
    now()
  )
on conflict (id) do update set
  client_id = excluded.client_id,
  service_id = excluded.service_id,
  stylist_id = excluded.stylist_id,
  start_at = excluded.start_at,
  end_at = excluded.end_at,
  appointment_date = excluded.appointment_date,
  appointment_time = excluded.appointment_time,
  status = excluded.status,
  notes = excluded.notes,
  cancellation_note = excluded.cancellation_note;
