import type { SupabaseClient } from "@supabase/supabase-js";
import { timeRangesOverlap } from "./timeRangeOverlap";

const DEFAULT_MISSING_END_DURATION_MINUTES = 60;

/**
 * Checks if the given stylist has any non-cancelled appointment on the same date
 * whose time range overlaps the proposed slot (appointment_time + durationMinutes).
 * Used to prevent double-booking when creating or editing appointments.
 *
 * @param supabase - Supabase client
 * @param options - stylist_id, appointment_date, appointment_time, durationMinutes; optionally excludeAppointmentId when editing
 * @returns true if a conflict exists
 */
export async function hasStylistConflict(
  supabase: SupabaseClient,
  options: {
    stylist_id: string;
    appointment_date: string;
    appointment_time: string;
    durationMinutes: number;
    excludeAppointmentId?: string;
  }
): Promise<boolean> {
  const {
    stylist_id,
    appointment_date,
    appointment_time,
    durationMinutes,
    excludeAppointmentId,
  } = options;

  const blockingStatuses = ["scheduled", "completed", "no_show"];

  let query = supabase
    .from("appointments")
    .select("id, start_at, end_at")
    .eq("stylist_id", stylist_id)
    .eq("appointment_date", appointment_date)
    .in("status", blockingStatuses);

  if (excludeAppointmentId) {
    query = query.neq("id", excludeAppointmentId);
  }

  const { data: existing, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const proposedStartMs = new Date(`${appointment_date}T${appointment_time}`).getTime();
  const proposedEndMs = proposedStartMs + durationMinutes * 60 * 1000;

  for (const row of existing ?? []) {
    const existingStartMs = new Date(row.start_at).getTime();
    const existingEndMs = row.end_at
      ? new Date(row.end_at).getTime()
      : existingStartMs + DEFAULT_MISSING_END_DURATION_MINUTES * 60 * 1000;

    if (timeRangesOverlap(proposedStartMs, proposedEndMs, existingStartMs, existingEndMs)) {
      return true;
    }
  }

  return false;
}

export const CONFLICT_MESSAGE =
  "This stylist already has a booking that overlaps with that service duration.";
