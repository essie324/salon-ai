import type { SupabaseClient } from "@supabase/supabase-js";

export type ConflictResult = {
  conflict: boolean;
  conflictingAppointment?: {
    id: string;
    start_at: string;
    end_at: string | null;
    status: string;
  };
};

/**
 * Checks for overlapping appointments for a stylist between [startAt, endAt).
 * Ignores cancelled and deleted appointments.
 */
export async function checkAppointmentConflict(
  supabase: SupabaseClient,
  stylistId: string,
  startAt: string,
  endAt: string,
  excludeAppointmentId?: string,
): Promise<ConflictResult> {
  if (!stylistId || !startAt || !endAt) {
    return { conflict: false };
  }

  let query = supabase
    .from("appointments")
    .select("id, start_at, end_at, status", { head: false })
    .eq("stylist_id", stylistId)
    .not("status", "in", '("cancelled","no_show")')
    .is("deleted_at", null);

  if (excludeAppointmentId) {
    query = query.neq("id", excludeAppointmentId);
  }

  const { data, error } = await query;
  if (error || !data) {
    return { conflict: false };
  }

  const proposedStart = new Date(startAt).getTime();
  const proposedEnd = new Date(endAt).getTime();

  for (const appt of data as { id: string; start_at: string; end_at: string | null; status: string }[]) {
    const existingStart = new Date(appt.start_at).getTime();
    const existingEnd = appt.end_at
      ? new Date(appt.end_at).getTime()
      : existingStart;

    const overlaps =
      proposedStart < existingEnd &&
      proposedEnd > existingStart;

    if (overlaps) {
      return {
        conflict: true,
        conflictingAppointment: appt,
      };
    }
  }

  return { conflict: false };
}

