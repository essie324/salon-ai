-- Additive execution layer: ready-to-send, send simulation timestamp, message snapshot.
-- Safe: IF NOT EXISTS columns; constraint replace extends allowed action_state values.

alter table public.outreach_actions
  add column if not exists sent_at timestamptz,
  add column if not exists is_ready boolean not null default false,
  add column if not exists last_message_preview text;

alter table public.outreach_actions drop constraint if exists outreach_actions_action_state_check;

alter table public.outreach_actions add constraint outreach_actions_action_state_check
  check (
    action_state in (
      'new',
      'reviewed',
      'copied',
      'scheduled',
      'dismissed',
      'ready_to_send',
      'sent'
    )
  );

comment on column public.outreach_actions.sent_at is 'When staff ran send-now (simulation only; no external messaging API).';
comment on column public.outreach_actions.is_ready is 'Staff marked ready to send (use with ready_to_send state).';
comment on column public.outreach_actions.last_message_preview is 'Snapshot of message text recorded at send simulation.';
