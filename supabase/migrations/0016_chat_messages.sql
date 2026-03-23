-- Chat messages linked to intake sessions (AI receptionist / inbox).
-- Safe, idempotent: IF NOT EXISTS for table, index, and policies.

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.intake_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

comment on table public.chat_messages is 'Per-session chat turns for intake / AI receptionist flows.';

create index if not exists chat_messages_session_id_idx
  on public.chat_messages (session_id);

alter table public.chat_messages enable row level security;

drop policy if exists "authenticated users can read chat_messages" on public.chat_messages;
create policy "authenticated users can read chat_messages"
  on public.chat_messages
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated users can insert chat_messages" on public.chat_messages;
create policy "authenticated users can insert chat_messages"
  on public.chat_messages
  for insert
  to authenticated
  with check (true);
