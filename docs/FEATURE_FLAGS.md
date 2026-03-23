# Feature flags

| Flag | Default | Purpose |
|------|---------|--------|
| `FEATURE_INBOX_AND_INTAKE_DB` | `false` | Gates `intake_sessions` queries, inbox UI, and `/api/ai/receptionist` until migrations are applied. |

## Re-enable inbox / intake / AI receptionist

1. Apply migrations: `intake_sessions`, `chat_messages` (and any related).
2. In `app/lib/featureFlags.ts`, set `FEATURE_INBOX_AND_INTAKE_DB` to `true`.
3. If `app/dashboard/inbox/page.tsx` was replaced with a stub, restore the full implementation from version control.
4. Deploy / restart the app.
