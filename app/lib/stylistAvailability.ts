import type { SupabaseClient } from "@supabase/supabase-js";
import { timeRangesOverlap } from "./timeRangeOverlap";
import { hasStylistConflict } from "./appointmentConflicts";

export type AvailabilityResult =
  | { valid: true }
  | { valid: false; message: string };

const SLOT_STEP_MINUTES = 15;
const DEFAULT_MISSING_END_DURATION_MINUTES = 60;
const MAX_SUGGESTIONS_SAME_DAY = 3;

/**
 * Normalizes "HH:mm" or "HH:mm:ss" to "HH:mm" for comparison.
 */
function toHHmm(t: string): string {
  const part = t.slice(0, 5);
  return part.length === 5 ? part : t;
}

/**
 * Formats "HH:mm" for receptionist-friendly display (e.g. "9:00", "1:30").
 */
export function formatTimeForDisplay(hhmm: string): string {
  const [hStr, mStr] = toHHmm(hhmm).split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${String(m).padStart(2, "0")}`;
}

/**
 * Formats an array of time strings for "Try X, Y, or Z." in error messages.
 */
export function formatSuggestionsTry(suggestions: string[]): string {
  if (suggestions.length === 0) return "";
  if (suggestions.length === 1) return `Try ${suggestions[0]}.`;
  const last = suggestions[suggestions.length - 1];
  const rest = suggestions.slice(0, -1);
  return `Try ${rest.join(", ")}, or ${last}.`;
}

/**
 * Formats an array of time strings for "Available options: X, Y, Z." in error messages.
 */
export function formatSuggestionsOptions(suggestions: string[]): string {
  if (suggestions.length === 0) return "";
  return `Available options: ${suggestions.join(", ")}.`;
}

/**
 * Returns day of week from "YYYY-MM-DD". 0 = Sunday, 1 = Monday, ... 6 = Saturday.
 */
function dayOfWeekFromDate(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  return d.getDay();
}

/**
 * Adds minutes to "HH:mm" and returns "HH:mm".
 */
function addMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

/**
 * Generates candidate start times from workStart in 15-min steps until slot end would exceed workEnd.
 * Each slot is [start, start + durationMinutes); only includes slots that fit within [workStart, workEnd].
 */
function generateCandidateTimes(
  workStart: string,
  workEnd: string,
  durationMinutes: number
): string[] {
  const candidates: string[] = [];
  let current = toHHmm(workStart);
  const end = toHHmm(workEnd);
  while (current < end) {
    const slotEnd = addMinutes(current, durationMinutes);
    if (slotEnd <= end) candidates.push(current);
    current = addMinutes(current, SLOT_STEP_MINUTES);
  }
  return candidates;
}

/**
 * Returns up to maxSlots available start times (same day) for the given stylist, date, and duration.
 * Respects working hours, blocked time, and existing appointments. Exclude one appointment by id when editing.
 */
export async function getSuggestedTimeSlots(
  supabase: SupabaseClient,
  options: {
    stylist_id: string;
    appointment_date: string;
    durationMinutes: number;
    excludeAppointmentId?: string;
    maxSlots?: number;
  }
): Promise<string[]> {
  const {
    stylist_id,
    appointment_date,
    durationMinutes,
    excludeAppointmentId,
    maxSlots = MAX_SUGGESTIONS_SAME_DAY,
  } = options;

  const dayOfWeek = dayOfWeekFromDate(appointment_date);

  const { data: workingRows, error: workingError } = await supabase
    .from("stylist_working_hours")
    .select("start_time, end_time, is_working")
    .eq("stylist_id", stylist_id)
    .eq("day_of_week", dayOfWeek);

  if (workingError) throw new Error(workingError.message);

  const working = workingRows?.find((r) => r.is_working);
  if (!working) return [];

  const workStart = toHHmm(String(working.start_time));
  const workEnd = toHHmm(String(working.end_time));
  const candidates = generateCandidateTimes(workStart, workEnd, durationMinutes);

  const [{ data: blocks }, { data: existingAppointments }] = await Promise.all([
    supabase
      .from("stylist_blocked_time")
      .select("start_time, end_time")
      .eq("stylist_id", stylist_id)
      .eq("block_date", appointment_date),
    (() => {
      let q = supabase
        .from("appointments")
        .select("start_at, end_at")
        .eq("stylist_id", stylist_id)
        .eq("appointment_date", appointment_date)
        .in("status", ["scheduled", "completed", "no_show"]);
      if (excludeAppointmentId) q = q.neq("id", excludeAppointmentId);
      return q;
    })(),
  ]);

  const suggestions: string[] = [];
  for (const candidate of candidates) {
    if (suggestions.length >= maxSlots) break;
    const slotEnd = addMinutes(candidate, durationMinutes);

    let overlapsBlock = false;
    for (const b of blocks ?? []) {
      const blockStart = toHHmm(String(b.start_time));
      const blockEnd = toHHmm(String(b.end_time));
      if (candidate < blockEnd && slotEnd > blockStart) {
        overlapsBlock = true;
        break;
      }
    }
    if (overlapsBlock) continue;

    const proposedStartMs = new Date(`${appointment_date}T${candidate}`).getTime();
    const proposedEndMs = proposedStartMs + durationMinutes * 60 * 1000;
    let overlapsAppointment = false;
    for (const row of existingAppointments ?? []) {
      const existingStartMs = new Date(row.start_at).getTime();
      const existingEndMs = row.end_at
        ? new Date(row.end_at).getTime()
        : existingStartMs + DEFAULT_MISSING_END_DURATION_MINUTES * 60 * 1000;
      if (timeRangesOverlap(proposedStartMs, proposedEndMs, existingStartMs, existingEndMs)) {
        overlapsAppointment = true;
        break;
      }
    }
    if (overlapsAppointment) continue;

    suggestions.push(formatTimeForDisplay(candidate));
  }

  return suggestions;
}

const MAX_ALTERNATE_STYLISTS = 3;

export type AlternateStylistSuggestion = { name: string; time: string };

/**
 * Returns true if the given slot is available for the stylist (no conflict, within working hours, no blocked time).
 */
export async function isSlotAvailableForStylist(
  supabase: SupabaseClient,
  options: {
    stylist_id: string;
    appointment_date: string;
    appointment_time: string;
    durationMinutes: number;
    excludeAppointmentId?: string;
  }
): Promise<boolean> {
  const conflict = await hasStylistConflict(supabase, {
    ...options,
    appointment_time: toHHmm(options.appointment_time),
  });
  if (conflict) return false;
  const availability = await validateStylistAvailability(supabase, {
    stylist_id: options.stylist_id,
    appointment_date: options.appointment_date,
    appointment_time: toHHmm(options.appointment_time),
    durationMinutes: options.durationMinutes,
  });
  return availability.valid;
}

/**
 * Formats alternate stylist suggestions for display: "Essie at 2:00, Sofia at 2:30".
 */
export function formatAlternateStylists(alternates: AlternateStylistSuggestion[]): string {
  if (alternates.length === 0) return "";
  return alternates.map((a) => `${a.name} at ${a.time}`).join(", ");
}

/**
 * Returns up to 3 alternate stylists who can take the appointment (exact time preferred, then nearest available).
 * Excludes the selected stylist. When service_id is provided, only stylists eligible for that service are considered.
 */
export async function getAlternateStylistSuggestions(
  supabase: SupabaseClient,
  options: {
    appointment_date: string;
    appointment_time: string;
    durationMinutes: number;
    selectedStylistId: string;
    service_id?: string;
    excludeAppointmentId?: string;
    maxAlternates?: number;
  }
): Promise<{
  selectedStylistName: string | null;
  alternates: AlternateStylistSuggestion[];
}> {
  const {
    appointment_date,
    appointment_time,
    durationMinutes,
    selectedStylistId,
    service_id: serviceId,
    excludeAppointmentId,
    maxAlternates = MAX_ALTERNATE_STYLISTS,
  } = options;

  const { data: stylistRows } = await supabase
    .from("stylists")
    .select("id, first_name, last_name")
    .eq("is_active", true)
    .order("first_name", { ascending: true });

  const allStylists = stylistRows ?? [];
  const selected = allStylists.find((s) => s.id === selectedStylistId);
  const selectedStylistName = selected
    ? `${selected.first_name ?? ""} ${selected.last_name ?? ""}`.trim() || null
    : null;
  let others = allStylists.filter((s) => s.id !== selectedStylistId);

  if (serviceId) {
    const { getStylistIdsEligibleForService } = await import("./stylistServiceEligibility");
    const eligibleIds = await getStylistIdsEligibleForService(supabase, serviceId);
    if (eligibleIds !== null) {
      const eligibleSet = new Set(eligibleIds);
      others = others.filter((s) => eligibleSet.has(s.id));
    }
  }

  const exactMatch: AlternateStylistSuggestion[] = [];
  const exactMatchIds = new Set<string>();
  const nearestMatch: AlternateStylistSuggestion[] = [];

  for (const s of others) {
    const name = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Stylist";
    const availableAtExact = await isSlotAvailableForStylist(supabase, {
      stylist_id: s.id,
      appointment_date,
      appointment_time,
      durationMinutes,
      excludeAppointmentId,
    });
    if (availableAtExact) {
      exactMatch.push({ name, time: formatTimeForDisplay(toHHmm(appointment_time)) });
      exactMatchIds.add(s.id);
      if (exactMatch.length >= maxAlternates) break;
    }
  }

  if (exactMatch.length >= maxAlternates) {
    return { selectedStylistName, alternates: exactMatch.slice(0, maxAlternates) };
  }

  for (const s of others) {
    if (exactMatchIds.has(s.id)) continue;
    const name = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Stylist";
    const slots = await getSuggestedTimeSlots(supabase, {
      stylist_id: s.id,
      appointment_date,
      durationMinutes,
      excludeAppointmentId,
      maxSlots: 1,
    });
    if (slots.length > 0) {
      nearestMatch.push({ name, time: slots[0] });
      if (exactMatch.length + nearestMatch.length >= maxAlternates) break;
    }
  }

  const alternates = [...exactMatch, ...nearestMatch].slice(0, maxAlternates);
  return { selectedStylistName, alternates };
}

/**
 * Validates that a requested appointment slot (start through start + durationMinutes) is within
 * the stylist's working hours and does not overlap any blocked time. Does not check for
 * double-booking (use hasStylistConflict for that).
 *
 * @param supabase - Supabase client
 * @param options - stylist_id, appointment_date (YYYY-MM-DD), appointment_time (HH:mm), durationMinutes
 * @returns AvailabilityResult
 */
export async function validateStylistAvailability(
  supabase: SupabaseClient,
  options: {
    stylist_id: string;
    appointment_date: string;
    appointment_time: string;
    durationMinutes: number;
  }
): Promise<AvailabilityResult> {
  const {
    stylist_id,
    appointment_date,
    appointment_time,
    durationMinutes,
  } = options;

  const startTime = toHHmm(appointment_time);
  const endTime = addMinutes(startTime, durationMinutes);
  const dayOfWeek = dayOfWeekFromDate(appointment_date);

  // 1) Working hours: is the stylist scheduled to work that day?
  const { data: workingRows, error: workingError } = await supabase
    .from("stylist_working_hours")
    .select("start_time, end_time, is_working")
    .eq("stylist_id", stylist_id)
    .eq("day_of_week", dayOfWeek);

  if (workingError) {
    throw new Error(workingError.message);
  }

  const working = workingRows?.find((r) => r.is_working);
  if (!working) {
    return {
      valid: false,
      message:
        "This stylist is not scheduled to work on this day. Please choose another date or stylist.",
    };
  }

  const workStart = toHHmm(String(working.start_time));
  const workEnd = toHHmm(String(working.end_time));

  if (startTime < workStart || endTime > workEnd) {
    return {
      valid: false,
      message: `The appointment time is outside this stylist's working hours (${workStart}–${workEnd}). Please choose a time within that window.`,
    };
  }

  // 2) Blocked time: any overlap on this date?
  const { data: blocks, error: blocksError } = await supabase
    .from("stylist_blocked_time")
    .select("start_time, end_time, reason")
    .eq("stylist_id", stylist_id)
    .eq("block_date", appointment_date);

  if (blocksError) {
    throw new Error(blocksError.message);
  }

  for (const b of blocks ?? []) {
    const blockStart = toHHmm(String(b.start_time));
    const blockEnd = toHHmm(String(b.end_time));
    // Overlap: block starts before our end and block ends after our start
    if (blockStart < endTime && blockEnd > startTime) {
      const reason = b.reason ? ` (${b.reason})` : "";
      return {
        valid: false,
        message: `This time overlaps with blocked time${reason}. Please choose another time.`,
      };
    }
  }

  return { valid: true };
}
