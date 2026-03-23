# Feature Flags

This project uses feature flags to safely enable or disable incomplete or optional systems.

---

## FEATURE_INBOX_AND_INTAKE_DB

Controls intake, inbox, and AI receptionist features.

### Location (actual code)
app/lib/featureFlags.ts

Example:
export const FEATURE_INBOX_AND_INTAKE_DB = false;

---

## When FALSE
- Intake disabled
- Inbox disabled
- No queries to intake_sessions or chat_messages
- Core salon system remains stable

---

## When TRUE
- Intake form enabled
- Intake links to appointments
- Client profile shows intake
- Appointment detail shows intake

---

## Enable steps
1. Ensure DB tables exist
2. Update:
   export const FEATURE_INBOX_AND_INTAKE_DB = true;
3. Restart app

---

## Emergency
Set flag back to false if anything breaks.