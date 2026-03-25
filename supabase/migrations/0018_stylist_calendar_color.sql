-- Optional hex color per stylist for calendar scanning (e.g. #6b8cae).

alter table public.stylists add column if not exists calendar_color text;

comment on column public.stylists.calendar_color is 'Optional calendar accent color as #rrggbb or #rgb; null uses a deterministic palette fallback.';
