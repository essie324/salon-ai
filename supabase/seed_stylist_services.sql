-- Optional: assign a few services to stylists for testing eligibility.
-- Run after 0008_stylist_services.sql. Safe to run multiple times (unique constraint).

insert into public.stylist_services (stylist_id, service_id)
select s.id, sv.id
from (select id from public.stylists where is_active = true order by id limit 2) s
cross join (select id from public.services order by name limit 2) sv
on conflict (stylist_id, service_id) do nothing;
