# Supabase Schema Audit

## Summary

The app references **six** tables that must exist for full functionality. Current migrations only define **profiles**, **salons**, **locations**, **stylist_working_hours**, and **stylist_blocked_time**. The tables **clients**, **stylists**, **services**, and **appointments** are **not created by any migration** and must be created (or already exist in your project).

---

## 1. Tables That Must Exist

| Table | Created by migration? | Notes |
|-------|----------------------|--------|
| `profiles` | Yes (0001) | Auth/user profile |
| `salons` | Yes (0001) | Core entity |
| `locations` | Yes (0001) | Core entity |
| `stylist_working_hours` | Yes (0002) | FK to `stylists` if present |
| `stylist_blocked_time` | Yes (0002) | FK to `stylists` if present |
| **`clients`** | **No** | **Missing – app uses everywhere** |
| **`stylists`** | **No** | **Missing – app uses everywhere** |
| **`services`** | **No** | **Missing – app uses everywhere** |
| **`appointments`** | **No** | **Missing – app uses everywhere** |

---

## 2. Required Columns by Table

### clients (no migration creates this table)

| Column | Type | Used in |
|--------|------|---------|
| `id` | uuid PK | All selects, insert return |
| `first_name` | text not null | Insert, update, select (lists, detail, edit) |
| `last_name` | text | Insert, update, select |
| `email` | text | Insert, update, select (lists, detail, edit) |
| `phone` | text | Insert, update, select |
| `notes` | text | Insert, update, select |
| `created_at` | timestamptz | Select in `app/clients/page.tsx`, `app/dashboard/clients/page.tsx` |

### stylists (no migration creates this table)

| Column | Type | Used in |
|--------|------|---------|
| `id` | uuid PK | All selects, FKs in appointments & working hours |
| `first_name` | text | Select (lists, dropdowns) |
| `last_name` | text | Select |
| `is_active` | boolean | Filter `.eq("is_active", true)` in dashboard/new, appointments list, stylist availability |

### services (no migration creates this table)

| Column | Type | Used in |
|--------|------|---------|
| `id` | uuid PK | All selects, FKs in appointments |
| `name` | text | Select (dropdowns, display) |
| `duration_minutes` | integer | Select (conflict/availability logic, display) |
| `price_cents` | integer | Select (display, edit dropdowns) |

### appointments (no migration creates this table; 0003 only adds cancellation_note if table exists)

| Column | Type | Used in |
|--------|------|---------|
| `id` | uuid PK | All operations |
| `client_id` | uuid FK → clients | Insert, update, select, filter |
| `service_id` | uuid FK → services | Insert, update, select |
| `stylist_id` | uuid FK → stylists | Insert, update, select, filter (conflict/availability) |
| `start_at` | timestamptz | Insert, update, select (display, conflict logic) |
| `end_at` | timestamptz | Insert, update, select (display, conflict logic) |
| `appointment_date` | date | Insert, update, select, filter (conflict, availability, client page) |
| `appointment_time` | time or text | Insert, update, select (conflict, availability; stored as "HH:mm" or time) |
| `status` | text | Insert, update, select, filter (conflict uses .in("status", ...)) |
| `notes` | text | Insert, update, select |
| `cancellation_note` | text | Update (status action, edit), select (detail, edit); added by 0003 if appointments exists |

### stylist_working_hours (0002 creates this)

| Column | Type | In migration? |
|--------|------|----------------|
| `id` | uuid PK | Yes |
| `stylist_id` | uuid | Yes (FK if stylists exists) |
| `day_of_week` | smallint 0–6 | Yes |
| `start_time` | time | Yes |
| `end_time` | time | Yes |
| `is_working` | boolean | Yes |
| `created_at` | timestamptz | Yes |

App selects: `start_time`, `end_time`, `is_working`. All present.

### stylist_blocked_time (0002 creates this)

| Column | Type | In migration? |
|--------|------|----------------|
| `id` | uuid PK | Yes |
| `stylist_id` | uuid | Yes (FK if stylists exists) |
| `block_date` | date | Yes |
| `start_time` | time | Yes |
| `end_time` | time | Yes |
| `reason` | text | Yes |
| `created_at` | timestamptz | Yes |

App selects: `start_time`, `end_time`, `reason`. All present.

---

## 3. Comparison with Existing Migrations

- **0001_profiles_salons_locations.sql**: Creates `profiles`, `salons`, `locations` only. No `clients`, `stylists`, `services`, `appointments`.
- **0002_stylist_working_hours_blocked_time.sql**: Creates `stylist_working_hours` and `stylist_blocked_time`; adds FKs to `stylists` only if `stylists` already exists. Does not create `stylists`.
- **0003_appointment_status_cancellation_note.sql**: Only adds `cancellation_note` to `appointments` if the table already exists. Does not create `appointments`.

**Gap:** There is no migration that creates `clients`, `stylists`, `services`, or `appointments`. If these tables were created manually or by another process, the app will work and 0003 will add `cancellation_note`. If not, all appointment and client flows will fail until these tables exist.

---

## 4. Missing SQL Migrations

You need a migration that:

1. Creates **clients** with: id, first_name, last_name, email, phone, notes, created_at.
2. Creates **stylists** with: id, first_name, last_name, is_active.
3. Creates **services** with: id, name, duration_minutes, price_cents.
4. Creates **appointments** with: id, client_id, service_id, stylist_id, start_at, end_at, appointment_date, appointment_time, status, notes, cancellation_note (and optionally run 0003 after so cancellation_note exists, or include it in this migration).

---

## 5. SQL to Create or Update Missing Schema

**Migration file: `supabase/migrations/0004_clients_stylists_services_appointments.sql`**

This migration:

- Creates **clients**, **stylists**, **services**, and **appointments** with `create table if not exists` and all required columns.
- For existing tables (e.g. you already had `appointments` from another setup), adds only missing columns:
  - **clients:** `created_at` if missing
  - **stylists:** `is_active`, `created_at` if missing
  - **services:** `created_at` if missing
  - **appointments:** `cancellation_note`, `appointment_date`, `appointment_time` if missing (and backfills from `start_at` where needed).
- Adds indexes on `appointments` (client_id, stylist_id, appointment_date, start_at).
- Enables RLS and adds policies so authenticated users can manage these tables.

**Run order:** Apply migrations in order (0001 → 0002 → 0003 → 0004). If you already have 0001–0003 applied, run 0004 to create or backfill the four business tables. If you are starting fresh, run all four; 0002’s FKs to `stylists` will apply once 0004 has created `stylists`.
