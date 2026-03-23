-- Seed example: stylist working hours and blocked time.
-- Run after migrations. Replace <STYLIST_UUID> with a real stylist id from your stylists table.
--
-- Example: one stylist works Mon–Fri 09:00–17:00, and has a lunch block on a specific day.
--
-- 1) Pick one stylist (example query):
--    select id from public.stylists where is_active = true limit 1;
--
-- 2) Insert working hours (Monday = 1 through Friday = 5). Sunday = 0, Saturday = 6.

-- insert working hours for stylist (replace <STYLIST_UUID> with actual uuid):
/*
insert into public.stylist_working_hours (stylist_id, day_of_week, start_time, end_time, is_working)
values
  ('<STYLIST_UUID>', 1, '09:00', '17:00', true),
  ('<STYLIST_UUID>', 2, '09:00', '17:00', true),
  ('<STYLIST_UUID>', 3, '09:00', '17:00', true),
  ('<STYLIST_UUID>', 4, '09:00', '17:00', true),
  ('<STYLIST_UUID>', 5, '09:00', '17:00', true);
*/

-- 3) Insert one blocked time (e.g. lunch 12:00–13:00 on a given date). Replace <STYLIST_UUID> and date.
/*
insert into public.stylist_blocked_time (stylist_id, block_date, start_time, end_time, reason)
values
  ('<STYLIST_UUID>', current_date, '12:00', '13:00', 'Lunch');
*/

-- Below: executable example using the first active stylist (run as a single script if you prefer).
do $$
declare
  sid uuid;
begin
  select id into sid from public.stylists where is_active = true limit 1;
  if sid is not null then
    insert into public.stylist_working_hours (stylist_id, day_of_week, start_time, end_time, is_working)
    values
      (sid, 1, '09:00', '17:00', true),
      (sid, 2, '09:00', '17:00', true),
      (sid, 3, '09:00', '17:00', true),
      (sid, 4, '09:00', '17:00', true),
      (sid, 5, '09:00', '17:00', true)
    on conflict (stylist_id, day_of_week) do update set start_time = excluded.start_time, end_time = excluded.end_time, is_working = excluded.is_working;

    insert into public.stylist_blocked_time (stylist_id, block_date, start_time, end_time, reason)
    values (sid, current_date, '12:00', '13:00', 'Lunch');
  end if;
end $$;
