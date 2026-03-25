"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import {
  BOOKING_UNAVAILABLE_MESSAGE,
  validateBookingSlot,
} from "@/app/lib/booking/conflicts";

export type RescheduleCalendarResult = { ok: true } | { ok: false; message: string };

function normalizeTimeForDb(time: string): string {
  const t = time.trim();
  if (t.length >= 5 && t[2] === ":") {
    const hhmm = t.slice(0, 5);
    return `${hhmm}:00`;
  }
  return t;
}

/**
 * Persists a calendar drag: updates date, time, start/end, and optionally stylist.
 * Reuses {@link validateBookingSlot} (hours, blocks, conflicts, eligibility).
 */
export async function rescheduleCalendarAppointment(params: {
  appointmentId: string;
  targetDate: string;
  targetTime: string;
  targetStylistId: string;
}): Promise<RescheduleCalendarResult> {
  const { appointmentId, targetDate, targetTime, targetStylistId } = params;

  if (!appointmentId || !targetDate || !targetTime?.trim() || !targetStylistId) {
    return { ok: false, message: BOOKING_UNAVAILABLE_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();

  const { data: row, error: fetchErr } = await supabase
    .from("appointments")
    .select("id, service_id, stylist_id, status, deleted_at, start_at, end_at")
    .eq("id", appointmentId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { ok: false, message: "Appointment not found." };
  }

  if (row.deleted_at) {
    return { ok: false, message: "Cannot reschedule a removed appointment." };
  }

  const st = String(row.status || "").toLowerCase();
  if (st !== "scheduled" && st !== "confirmed" && st !== "checked_in") {
    return {
      ok: false,
      message: "This appointment cannot be rescheduled from the calendar.",
    };
  }

  if (!row.service_id) {
    return { ok: false, message: "Appointment is missing a service." };
  }

  const timeForParse = targetTime.trim().length >= 8 ? targetTime.trim().slice(0, 5) : targetTime.trim();
  const startLocal = new Date(`${targetDate}T${timeForParse}`);
  if (Number.isNaN(startLocal.getTime())) {
    return { ok: false, message: BOOKING_UNAVAILABLE_MESSAGE };
  }

  let durationMinutes = 60;
  if (row.start_at && row.end_at) {
    const ms = new Date(row.end_at).getTime() - new Date(row.start_at).getTime();
    if (ms > 60 * 1000) {
      durationMinutes = Math.round(ms / (60 * 1000));
    }
  } else {
    const { data: svc } = await supabase
      .from("services")
      .select("duration_minutes")
      .eq("id", row.service_id)
      .maybeSingle();
    if (svc?.duration_minutes != null && !Number.isNaN(Number(svc.duration_minutes))) {
      durationMinutes = Number(svc.duration_minutes);
    }
  }

  const start_at = startLocal.toISOString();
  const end_at = new Date(startLocal.getTime() + durationMinutes * 60 * 1000).toISOString();

  const check = await validateBookingSlot(supabase, {
    stylistId: targetStylistId,
    startAt: start_at,
    endAt: end_at,
    excludeAppointmentId: appointmentId,
    serviceId: row.service_id,
  });

  if (!check.ok) {
    return { ok: false, message: check.message };
  }

  const appointment_time = normalizeTimeForDb(timeForParse);

  const { error: updErr } = await supabase
    .from("appointments")
    .update({
      appointment_date: targetDate,
      appointment_time,
      start_at,
      end_at,
      stylist_id: targetStylistId,
    })
    .eq("id", appointmentId);

  if (updErr) {
    return { ok: false, message: updErr.message || BOOKING_UNAVAILABLE_MESSAGE };
  }

  revalidatePath("/dashboard/appointments");
  return { ok: true };
}
