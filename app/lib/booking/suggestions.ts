import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceDuration } from "./duration";
import { isStylistAvailable } from "./availability";
import { checkAppointmentConflict } from "./conflicts";
import { isStylistEligibleForService } from "@/app/lib/stylistServiceEligibility";

export type SlotSuggestion = {
  stylistId: string;
  stylistName: string;
  startAt: string;
  endAt: string;
};

/**
 * Returns available time slots for all stylists eligible for the service on a given date.
 * First implementation: simple scan of working hours in 30-min increments, filtered by
 * availability + conflicts.
 */
export async function getAvailableSlots(
  supabase: SupabaseClient,
  serviceId: string,
  date: string,
): Promise<SlotSuggestion[]> {
  if (!serviceId || !date) return [];

  const [{ data: serviceRow }, { data: stylistRows }] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("id", serviceId)
      .maybeSingle(),
    supabase
      .from("stylists")
      .select("id, first_name, last_name, is_active")
      .eq("is_active", true),
  ]);

  const service =
    serviceRow as { id: string; name: string | null; duration_minutes?: number | null } | null;
  const durationMinutes = getServiceDuration(service);
  const dayOfWeek = new Date(date + "T12:00:00").getDay();

  const suggestions: SlotSuggestion[] = [];

  for (const stylist of stylistRows ?? []) {
    const stylistId = stylist.id as string;
    const eligible = await isStylistEligibleForService(supabase, stylistId, serviceId);
    if (!eligible) continue;

    const { data: workingRows } = await supabase
      .from("stylist_working_hours")
      .select("start_time, end_time, is_working")
      .eq("stylist_id", stylistId)
      .eq("day_of_week", dayOfWeek);

    const working = workingRows?.find((r) => r.is_working);
    if (!working) continue;

    const workStart = String(working.start_time).slice(0, 5); // HH:mm
    const workEnd = String(working.end_time).slice(0, 5);

    const slots = await generateSlotsForStylist(supabase, {
      stylistId,
      stylistName:
        `${stylist.first_name ?? ""} ${stylist.last_name ?? ""}`.trim() || "Stylist",
      date,
      workStart,
      workEnd,
      durationMinutes,
    });

    suggestions.push(...slots);
  }

  return suggestions;
}

async function generateSlotsForStylist(
  supabase: SupabaseClient,
  options: {
    stylistId: string;
    stylistName: string;
    date: string;
    workStart: string;
    workEnd: string;
    durationMinutes: number;
  },
): Promise<SlotSuggestion[]> {
  const { stylistId, stylistName, date, workStart, workEnd, durationMinutes } = options;
  const results: SlotSuggestion[] = [];

  let current = workStart;
  while (current < workEnd) {
    const startAt = new Date(`${date}T${current}`);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
    const endTime = endAt.toISOString().slice(11, 16);

    if (endTime <= workEnd) {
      const startIso = startAt.toISOString();
      const endIso = endAt.toISOString();
      const availability = await isStylistAvailable(supabase, stylistId, startIso, endIso);
      if (availability.available) {
        const conflict = await checkAppointmentConflict(supabase, stylistId, startIso, endIso);
        if (!conflict.conflict) {
          results.push({
            stylistId,
            stylistName,
            startAt: startIso,
            endAt: endIso,
          });
        }
      }
    }

    current = addMinutes(current, 30);
  }

  return results;
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

