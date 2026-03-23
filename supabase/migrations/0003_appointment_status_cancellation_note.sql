-- Optional: add cancellation_note for cancelled appointments.
-- Run only if your appointments table already exists (e.g. created elsewhere).
-- Supported status values: scheduled, confirmed, completed, cancelled, no_show

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'appointments'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'appointments'
        and column_name = 'cancellation_note'
    ) then
      alter table public.appointments
        add column cancellation_note text;
      comment on column public.appointments.cancellation_note is 'Optional reason/note when status is cancelled.';
    end if;
  end if;
end $$;
