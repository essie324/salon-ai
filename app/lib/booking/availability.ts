import type { SupabaseClient } from "@supabase/supabase-js";

export type AvailabilityResult = {
  available: boolean;
  reason?: "outside_working_hours" | "blocked_time";
};

function toHHmm(time: string): string {
  return time.slice(0, 5);
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
  const appointment_date = start.toISOString().slice(0, 10);
  const startTime = toHHmm(start.toISOString().slice(11, 16));
  const endTime = toHHmm(end.toISOString().slice(11, 16));

  // Working hours
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

