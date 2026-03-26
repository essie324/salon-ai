import type { SupabaseClient } from "@supabase/supabase-js";
import { addCalendarDays } from "@/app/lib/calendar/schedulerData";
import { getServiceDuration } from "./duration";
import { validateBookingSlot } from "./conflicts";
import { SLOT_STEP_MINUTES } from "./suggestions";
import { getStylistIdsEligibleForService } from "@/app/lib/stylistServiceEligibility";
import { parseTimeToMinutes, minutesToHHmm } from "./availability";

/** Pad "H:mm" / "HH:mm" to "HH:mm" for stable Date parsing and URLs. */
export function normalizeTimeInput(value: string): string {
  const s = value.trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return s;
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export type SmartFallbackSuggestion = {
  stylistId: string;
  stylistName: string;
  /** YYYY-MM-DD (local calendar date string) */
  date: string;
  /** HH:mm */
  time: string;
  label: string;
  startAtMs: number;
};

export type GetSmartFallbackSuggestionsArgs = {
  serviceId: string;
  appointmentDate: string;
  appointmentTime: string;
  preferredStylistId: string;
  excludeAppointmentId?: string;
  /** Days including start date (default 7) */
  horizonDays?: number;
};

export type StylistLite = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function stylistName(s: StylistLite): string {
  return `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Stylist";
}

const MAX_SUGGESTIONS = 5;
const DEFAULT_HORIZON_DAYS = 7;
const MAX_VALIDATIONS = 280;

/**
 * Finds 3–5 alternative slots when the requested time fails validation.
 * Every candidate is checked with {@link validateBookingSlot} (hours, blocks, conflicts, eligibility).
 *
 * **Ranking / labels**
 * 1. **Soonest opening** — earliest valid start across all eligible stylists in the horizon.
 * 2. **Same stylist** — earliest valid start for the preferred stylist (if different from #1).
 * 3. **Next available** — earliest valid start on the *requested* date strictly after the requested time
 *    (prefers the same stylist when that slot exists).
 * 4. Remaining picks are the next earliest distinct slots, labeled **Open slot** when no other tag applies.
 */
export async function getSmartFallbackSuggestions(
  supabase: SupabaseClient,
  stylists: StylistLite[],
  args: GetSmartFallbackSuggestionsArgs,
): Promise<SmartFallbackSuggestion[]> {
  const {
    serviceId,
    appointmentDate,
    appointmentTime,
    preferredStylistId,
    excludeAppointmentId,
    horizonDays = DEFAULT_HORIZON_DAYS,
  } = args;

  if (!serviceId || !appointmentDate || !appointmentTime || !preferredStylistId) {
    return [];
  }

  const { data: serviceRow } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", serviceId)
    .maybeSingle();

  const durationMinutes = getServiceDuration(
    serviceRow as { duration_minutes?: number | null } | null,
  );

  const eligibleIds = await getStylistIdsEligibleForService(supabase, serviceId);
  const stylistSet = new Set(stylists.map((s) => s.id));
  let targetStylists = stylists.filter((s) => stylistSet.has(s.id));
  if (eligibleIds != null) {
    const allow = new Set(eligibleIds);
    targetStylists = targetStylists.filter((s) => allow.has(s.id));
  }

  if (targetStylists.length === 0) {
    return [];
  }

  const timeNorm = normalizeTimeInput(appointmentTime);
  let requestedStartMs = new Date(`${appointmentDate}T${timeNorm}`).getTime();
  if (Number.isNaN(requestedStartMs)) {
    return [];
  }

  type Candidate = {
    stylistId: string;
    stylistName: string;
    date: string;
    time: string;
    startAtMs: number;
  };

  const raw: Candidate[] = [];
  let validations = 0;

  outer: for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
    const date = addCalendarDays(appointmentDate, dayOffset);

    for (const st of targetStylists) {
      const dayOfWeek = new Date(date + "T12:00:00").getDay();

      const { data: workingRows, error: whErr } = await supabase
        .from("stylist_working_hours")
        .select("start_time, end_time, is_working")
        .eq("stylist_id", st.id)
        .eq("day_of_week", dayOfWeek);

      if (whErr) continue;

      const working = workingRows?.find((r) => r.is_working);
      if (!working) continue;

      const workStartMin = parseTimeToMinutes(String(working.start_time));
      const workEndMin = parseTimeToMinutes(String(working.end_time));

      for (let m = workStartMin; m + durationMinutes <= workEndMin; m += SLOT_STEP_MINUTES) {
        if (validations >= MAX_VALIDATIONS) break outer;

        const hhmm = minutesToHHmm(m);
        const startLocal = new Date(`${date}T${hhmm}`);
        const start_at = startLocal.toISOString();
        const end_at = new Date(
          startLocal.getTime() + durationMinutes * 60 * 1000,
        ).toISOString();

        validations += 1;
        const result = await validateBookingSlot(supabase, {
          stylistId: st.id,
          startAt: start_at,
          endAt: end_at,
          excludeAppointmentId,
          serviceId,
        });

        if (result.ok) {
          raw.push({
            stylistId: st.id,
            stylistName: stylistName(st),
            date,
            time: hhmm,
            startAtMs: startLocal.getTime(),
          });
        }
      }
    }
  }

  raw.sort((a, b) => a.startAtMs - b.startAtMs);

  const dedup: Candidate[] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    const key = `${c.startAtMs}-${c.stylistId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(c);
  }

  if (dedup.length === 0) return [];

  const out: SmartFallbackSuggestion[] = [];
  const used = new Set<string>();

  const take = (c: Candidate | undefined, label: string) => {
    if (!c) return;
    const key = `${c.startAtMs}-${c.stylistId}`;
    if (used.has(key)) return;
    used.add(key);
    out.push({ ...c, label });
  };

  const soonest = dedup[0];
  take(soonest, "Soonest opening");

  const sameStylist = dedup.find(
    (c) => c.stylistId === preferredStylistId && `${c.startAtMs}-${c.stylistId}` !== `${soonest.startAtMs}-${soonest.stylistId}`,
  );
  take(sameStylist, "Same stylist");

  const nextSameDayPreferred = dedup.find(
    (c) =>
      c.date === appointmentDate &&
      c.startAtMs > requestedStartMs &&
      c.stylistId === preferredStylistId &&
      !used.has(`${c.startAtMs}-${c.stylistId}`),
  );
  take(nextSameDayPreferred, "Next available");

  const nextSameDayAny = dedup.find(
    (c) =>
      c.date === appointmentDate &&
      c.startAtMs > requestedStartMs &&
      !used.has(`${c.startAtMs}-${c.stylistId}`),
  );
  if (!nextSameDayPreferred) {
    take(nextSameDayAny, "Next available");
  }

  for (const c of dedup) {
    if (out.length >= MAX_SUGGESTIONS) break;
    const key = `${c.startAtMs}-${c.stylistId}`;
    if (used.has(key)) continue;
    take(c, "Open slot");
  }

  return out.slice(0, MAX_SUGGESTIONS);
}
