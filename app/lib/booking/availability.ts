import type { SupabaseClient } from "@supabase/supabase-js";

export type AvailabilityResult = {
  available: boolean;
  reason?: "outside_working_hours" | "blocked_time";
};

/** Normalizes DB TIME (or string) to HH:mm for comparisons. */
export function toHHmm(time: string): string {
  return time.slice(0, 5);
}

/** Parses HH:mm or HH:mm:ss from local salon time into minutes from midnight. */
export function parseTimeToMinutes(time: string): number {
  const h = toHHmm(time);
  const [hh, mm] = h.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
}

/** Formats minutes from midnight (0–1439) or beyond (wraps) to HH:mm. */
export function minutesToHHmm(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  const hh = Math.floor(t / 60);
  const mm = t % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Local calendar YYYY-MM-DD (runtime timezone). Matches how `getBookableSlotsForServiceDate`
 * and `new Date(\`${date}T${time}\`)` interpret the salon wall clock on the server.
 */
function localDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local HH:mm (runtime timezone), comparable to DB TIME strings. */
function localTimeHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export async function isStylistAvailable(
  supabase: SupabaseClient,
  stylistId: string,
  startAt: string,
  endAt: string,
): Promise<AvailabilityResult> {
  if (!stylistId || !startAt || !endAt) {
    return { available: false, reason: "outside_working_hours" };
  }

  const start = new Date(startAt);
  const end = new Date(endAt);
  // Must NOT use toISOString() for date/time-of-day: DB working hours and blocks are wall-clock
  // in the same local frame as getBookableSlotsForServiceDate (see suggestions.ts).
  const appointment_date = localDateYYYYMMDD(start);
  const startTime = localTimeHHmm(start);
  const endTime = localTimeHHmm(end);

  // Working hours — same day-of-week rule as suggestions.ts (local noon anchor)
  const dayOfWeek = new Date(appointment_date + "T12:00:00").getDay();

  const { data: workingRows, error: workingError } = await supabase
    .from("stylist_working_hours")
    .select("start_time, end_time, is_working")
    .eq("stylist_id", stylistId)
    .eq("day_of_week", dayOfWeek);

  if (workingError) {
    return { available: false, reason: "outside_working_hours" };
  }

  const working = workingRows?.find((r) => r.is_working);
  if (!working) {
    return { available: false, reason: "outside_working_hours" };
  }

  const workStart = toHHmm(String(working.start_time));
  const workEnd = toHHmm(String(working.end_time));
  if (startTime < workStart || endTime > workEnd) {
    return { available: false, reason: "outside_working_hours" };
  }

  // Blocked time
  const { data: blocks, error: blocksError } = await supabase
    .from("stylist_blocked_time")
    .select("start_time, end_time")
    .eq("stylist_id", stylistId)
    .eq("block_date", appointment_date);

  if (blocksError) {
    return { available: false, reason: "blocked_time" };
  }

  for (const b of blocks ?? []) {
    const blockStart = toHHmm(String(b.start_time));
    const blockEnd = toHHmm(String(b.end_time));
    if (blockStart < endTime && blockEnd > startTime) {
      return { available: false, reason: "blocked_time" };
    }
  }

  return { available: true };
}
