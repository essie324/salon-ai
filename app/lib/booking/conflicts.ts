import type { SupabaseClient } from "@supabase/supabase-js";
import { timeRangesOverlap } from "@/app/lib/timeRangeOverlap";
import { isStylistEligibleForService } from "@/app/lib/stylistServiceEligibility";
import { isStylistAvailable } from "./availability";

/** When `end_at` is null, assume this duration for overlap checks (matches appointmentConflicts legacy). */
export const DEFAULT_MISSING_END_DURATION_MINUTES = 60;

export const BOOKING_UNAVAILABLE_MESSAGE =
  "This time is not available for the selected stylist";

export type ConflictResult = {
  conflict: boolean;
  conflictingAppointment?: {
    id: string;
    start_at: string;
    end_at: string | null;
    status: string;
  };
};

export type BookingSlotValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "outside_working_hours"
        | "blocked_time"
        | "appointment_conflict"
        | "stylist_not_eligible";
      message: string;
    };

/**
 * Half-open interval overlap: proposedStart < existingEnd && proposedEnd > existingStart.
 * Delegates to shared `timeRangesOverlap` (ms timestamps).
 */
export function appointmentsOverlap(
  proposedStartMs: number,
  proposedEndMs: number,
  existingStartMs: number,
  existingEndMs: number,
): boolean {
  return timeRangesOverlap(proposedStartMs, proposedEndMs, existingStartMs, existingEndMs);
}

/**
 * Checks for overlapping appointments for a stylist between [startAt, endAt).
 * Ignores cancelled, no_show, and deleted appointments.
 * If an existing row has no `end_at`, uses start + {@link DEFAULT_MISSING_END_DURATION_MINUTES}.
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
  const fallbackEndMs = DEFAULT_MISSING_END_DURATION_MINUTES * 60 * 1000;

  for (const appt of data as { id: string; start_at: string; end_at: string | null; status: string }[]) {
    const existingStart = new Date(appt.start_at).getTime();
    const existingEnd = appt.end_at
      ? new Date(appt.end_at).getTime()
      : existingStart + fallbackEndMs;

    if (appointmentsOverlap(proposedStart, proposedEnd, existingStart, existingEnd)) {
      return {
        conflict: true,
        conflictingAppointment: appt,
      };
    }
  }

  return { conflict: false };
}

/**
 * Working hours + blocked time + no overlapping appointments (same rules as booking engine).
 * No manual bypass: always enforced server-side.
 */
export async function validateBookingSlot(
  supabase: SupabaseClient,
  args: {
    stylistId: string;
    startAt: string;
    endAt: string;
    excludeAppointmentId?: string;
    /** When set, stylist must be eligible for this service (stylist_services rules). */
    serviceId?: string;
  },
): Promise<BookingSlotValidationResult> {
  const { stylistId, startAt, endAt, excludeAppointmentId, serviceId } = args;

  if (!stylistId || !startAt || !endAt) {
    return {
      ok: false,
      reason: "outside_working_hours",
      message: BOOKING_UNAVAILABLE_MESSAGE,
    };
  }

  if (serviceId) {
    const eligible = await isStylistEligibleForService(supabase, stylistId, serviceId);
    if (!eligible) {
      return {
        ok: false,
        reason: "stylist_not_eligible",
        message: BOOKING_UNAVAILABLE_MESSAGE,
      };
    }
  }

  const availability = await isStylistAvailable(supabase, stylistId, startAt, endAt);
  if (!availability.available) {
    return {
      ok: false,
      reason: availability.reason ?? "outside_working_hours",
      message: BOOKING_UNAVAILABLE_MESSAGE,
    };
  }

  const conflict = await checkAppointmentConflict(
    supabase,
    stylistId,
    startAt,
    endAt,
    excludeAppointmentId,
  );
  if (conflict.conflict) {
    return {
      ok: false,
      reason: "appointment_conflict",
      message: BOOKING_UNAVAILABLE_MESSAGE,
    };
  }

  return { ok: true };
}

