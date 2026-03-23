/**
 * Feature flags — toggle incomplete or DB-dependent features without deleting code.
 *
 * ## Inbox / intake_sessions / chat_messages / AI receptionist
 * Set `FEATURE_INBOX_AND_INTAKE_DB` to `true` after:
 * - `public.intake_sessions` exists (migration applied)
 * - `public.chat_messages` exists if you use chat UI
 * - RLS policies allow your auth model
 *
 * Then restore the full `app/dashboard/inbox/page.tsx` implementation if you replaced it
 * with a stub, or keep the stub until the feature is finished.
 */
export const FEATURE_INBOX_AND_INTAKE_DB = false;
