import { localDateISO } from "@/app/lib/dashboard/dateRanges";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Normalize a calendar date from the booking form (`YYYY-MM-DD`).
 * Validates the triplet as a real local calendar day (no rollover).
 */
export function normalizeAppointmentDate(raw: string): string | null {
  const s = raw.trim();
  const m = DATE_RE.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const test = new Date(y, mo - 1, d);
  if (
    test.getFullYear() !== y ||
    test.getMonth() !== mo - 1 ||
    test.getDate() !== d
  ) {
    return null;
  }
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Normalize time from the booking form (`HH:MM` or `HH:MM:SS`).
 * Returns `HH:MM:SS` for consistent Postgres `time` storage.
 */
export function normalizeAppointmentTime(raw: string): string | null {
  const s = raw.trim();
  const m = TIME_RE.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] != null ? Number(m[3]) : 0;
  if (
    !Number.isFinite(h) ||
    !Number.isFinite(min) ||
    !Number.isFinite(sec) ||
    h < 0 ||
    h > 23 ||
    min < 0 ||
    min > 59 ||
    sec < 0 ||
    sec > 59
  ) {
    return null;
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Build `start_at` / `end_at` as UTC instants from the **same** local calendar
 * date + time the user selected (no dependency on ISO date strings for display fields).
 */
export function localStartEndFromAppointmentFields(
  appointmentDate: string,
  appointmentTime: string,
  durationMinutes: number,
): { start_at: string; end_at: string; startLocal: Date } | null {
  const dateNorm = normalizeAppointmentDate(appointmentDate);
  const timeNorm = normalizeAppointmentTime(appointmentTime);
  if (!dateNorm || !timeNorm) return null;

  const [y, mo, d] = dateNorm.split("-").map(Number);
  const [h, min, sec] = timeNorm.split(":").map(Number);
  const startLocal = new Date(y, mo - 1, d, h, min, sec);
  const endLocal = new Date(
    startLocal.getTime() + durationMinutes * 60 * 1000,
  );

  return {
    start_at: startLocal.toISOString(),
    end_at: endLocal.toISOString(),
    startLocal,
  };
}

/**
 * Dev-only: warn if the local calendar day implied by `startLocal` does not match
 * the stored `appointment_date` string (signals drift / bad parsing).
 */
export function warnDevIfStartDateMismatch(
  appointmentDateNormalized: string,
  startLocal: Date,
): void {
  if (process.env.NODE_ENV !== "development") return;
  const localFromStart = localDateISO(startLocal);
  if (localFromStart !== appointmentDateNormalized) {
    console.warn(
      "[appointment] start_at local calendar date does not match appointment_date",
      {
        appointment_date: appointmentDateNormalized,
        localDateFromStartAt: localFromStart,
      },
    );
  }
}
