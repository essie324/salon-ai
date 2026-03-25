import {
  getCurrentWeekRangeISO,
  localDateISO,
  type DateRange,
} from "@/app/lib/dashboard/dateRanges";

/**
 * Monday–Sunday week (local) that contains `dateISO` (YYYY-MM-DD).
 */
export function getWeekRangeForDateISO(dateISO: string): DateRange {
  const parts = dateISO.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return getCurrentWeekRangeISO();
  const anchor = new Date(y, m - 1, d);
  return getCurrentWeekRangeISO(anchor);
}

/** Inclusive list of calendar dates from startISO through endISO. */
/** Shift a YYYY-MM-DD by `deltaDays` (local calendar). */
export function addCalendarDays(dateISO: string, deltaDays: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const cur = new Date(y, m - 1, d);
  cur.setDate(cur.getDate() + deltaDays);
  return localDateISO(cur);
}

export function enumerateDatesInclusive(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const [ys, ms, ds] = startISO.split("-").map(Number);
  const [ye, me, de] = endISO.split("-").map(Number);
  const cur = new Date(ys, ms - 1, ds);
  const end = new Date(ye, me - 1, de);
  while (cur.getTime() <= end.getTime()) {
    out.push(localDateISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function formatSchedulerTimeRange(
  startIso: string,
  endIso: string | null,
): string {
  const start = new Date(startIso);
  const startTime = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!endIso) return startTime;
  const end = new Date(endIso);
  const endTime = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${startTime} – ${endTime}`;
}

export type SchedulerAppointmentInput = {
  id: string;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
  stylist_id: string | null;
  service_id: string | null;
  appointment_date: string | null;
  clientName: string;
  serviceName: string;
  durationMinutes: number;
  /** Resolved hex accent for calendar blocks */
  stylistCalendarColor?: string;
  clientNoShowCount?: number;
};

export type SchedulerAppointment = {
  id: string;
  start_at: string;
  end_at: string | null;
  status: string;
  stylist_id: string | null;
  service_id: string | null;
  appointment_date?: string;
  clientName: string;
  serviceName: string;
  durationMinutes?: number;
  stylistCalendarColor?: string;
  clientNoShowCount?: number;
};

/**
 * Maps DB rows to scheduler props; skips rows without start_at (cannot place on grid).
 */
export function toSchedulerAppointments(
  rows: SchedulerAppointmentInput[],
): SchedulerAppointment[] {
  const out: SchedulerAppointment[] = [];
  for (const r of rows) {
    if (!r.start_at?.trim()) continue;
    out.push({
      id: r.id,
      start_at: r.start_at,
      end_at: r.end_at,
      status: r.status ?? "scheduled",
      stylist_id: r.stylist_id,
      service_id: r.service_id,
      appointment_date: r.appointment_date ?? undefined,
      clientName: r.clientName,
      serviceName: r.serviceName,
      durationMinutes: r.durationMinutes,
      stylistCalendarColor: r.stylistCalendarColor,
      clientNoShowCount: r.clientNoShowCount,
    });
  }
  return out;
}
