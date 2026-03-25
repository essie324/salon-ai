import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BOOKING_UNAVAILABLE_MESSAGE,
  checkAppointmentConflict,
} from "@/app/lib/booking/conflicts";

/**
 * @deprecated Prefer `checkAppointmentConflict` or `validateBookingSlot` from `@/app/lib/booking/conflicts`.
 * Thin wrapper kept for stylistAvailability / legacy call sites.
 */
export async function hasStylistConflict(
  supabase: SupabaseClient,
  options: {
    stylist_id: string;
    appointment_date: string;
    appointment_time: string;
    durationMinutes: number;
    excludeAppointmentId?: string;
  },
): Promise<boolean> {
  const {
    stylist_id,
    appointment_date,
    appointment_time,
    durationMinutes,
    excludeAppointmentId,
  } = options;

  const startAtLocal = new Date(`${appointment_date}T${appointment_time}`);
  const start_at = startAtLocal.toISOString();
  const end_at = new Date(
    startAtLocal.getTime() + durationMinutes * 60 * 1000,
  ).toISOString();

  const r = await checkAppointmentConflict(
    supabase,
    stylist_id,
    start_at,
    end_at,
    excludeAppointmentId,
  );
  return r.conflict;
}

export const CONFLICT_MESSAGE = BOOKING_UNAVAILABLE_MESSAGE;
