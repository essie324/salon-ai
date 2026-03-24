import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceDuration } from "./duration";
import { getStylistIdsEligibleForService } from "@/app/lib/stylistServiceEligibility";
import { minutesToHHmm, parseTimeToMinutes } from "./availability";

export const SLOT_STEP_MINUTES = 15;
export const MAX_SLOTS_TOTAL = 120;

export type BookableSlot = {
  /** HH:mm for `<input type="time" />` and URL `time` param */
  startTime: string;
  stylistId: string;
  stylistName: string;
  durationMinutes: number;
};

export type StylistSlotGroup = {
  stylistId: string;
  stylistName: string;
  slots: BookableSlot[];
};

export type StylistAvailabilityRow = {
  stylistId: string;
  stylistName: string;
  eligible: boolean;
  /** Soft hint when no slots (e.g. no shift, not eligible) */
  hint?: string;
  slots: BookableSlot[];
};

export type BookableSlotsResult = {
  durationMinutes: number;
  /** Flat list, sorted by time then stylist name */
  slots: BookableSlot[];
  groupedByStylist: StylistSlotGroup[];
  stylistRows: StylistAvailabilityRow[];
};

type StylistLite = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function displayStylistName(s: StylistLite): string {
  return `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Stylist";
}

function overlapsBlocks(
  slotStartMin: number,
  slotEndMin: number,
  blocks: { start_time: string; end_time: string }[],
): boolean {
  for (const b of blocks) {
    const b0 = parseTimeToMinutes(String(b.start_time));
    const b1 = parseTimeToMinutes(String(b.end_time));
    if (b0 < slotEndMin && b1 > slotStartMin) return true;
  }
  return false;
}

function overlapsAppointments(
  proposedStart: number,
  proposedEnd: number,
  appointments: { start_at: string; end_at: string | null }[],
): boolean {
  for (const a of appointments) {
    const existingStart = new Date(a.start_at).getTime();
    const existingEnd = a.end_at ? new Date(a.end_at).getTime() : existingStart;
    if (proposedStart < existingEnd && proposedEnd > existingStart) return true;
  }
  return false;
}

export type GetBookableSlotsArgs = {
  serviceId: string;
  appointmentDate: string;
  /** When set, only this stylist’s column is computed (must still be eligible). */
  stylistFilterId?: string | null;
  stylists: StylistLite[];
};

/**
 * Computes open slots for a service on a date using:
 * - stylist_working_hours (is_working + window)
 * - stylist_blocked_time (same calendar date)
 * - existing appointments (non-cancelled/no_show, not deleted)
 * - service duration + 15-minute step
 * - stylist_services eligibility when that table has rows
 */
export async function getBookableSlotsForServiceDate(
  supabase: SupabaseClient,
  args: GetBookableSlotsArgs,
): Promise<BookableSlotsResult> {
  const { serviceId, appointmentDate, stylistFilterId, stylists } = args;

  if (!serviceId || !appointmentDate) {
    return {
      durationMinutes: 60,
      slots: [],
      groupedByStylist: [],
      stylistRows: [],
    };
  }

  const { data: serviceRow } = await supabase
    .from("services")
    .select("id, duration_minutes")
    .eq("id", serviceId)
    .maybeSingle();

  const durationMinutes = getServiceDuration(
    serviceRow as { duration_minutes?: number | null } | null,
  );

  const eligibleIds = await getStylistIdsEligibleForService(supabase, serviceId);
  const stylistIdSet = new Set(stylists.map((s) => s.id));

  let targetIds: string[] = stylists.map((s) => s.id);
  if (eligibleIds != null) {
    targetIds = eligibleIds.filter((id) => stylistIdSet.has(id));
  }

  if (stylistFilterId?.trim()) {
    const fid = stylistFilterId.trim();
    if (!targetIds.includes(fid)) {
      return {
        durationMinutes,
        slots: [],
        groupedByStylist: [],
        stylistRows: [
          {
            stylistId: fid,
            stylistName: stylists.find((x) => x.id === fid)
              ? displayStylistName(stylists.find((x) => x.id === fid)!)
              : "Stylist",
            eligible: false,
            hint: "Selected stylist is not eligible for this service.",
            slots: [],
          },
        ],
      };
    }
    targetIds = [fid];
  }

  if (targetIds.length === 0) {
    return {
      durationMinutes,
      slots: [],
      groupedByStylist: [],
      stylistRows: [],
    };
  }

  const dayOfWeek = new Date(appointmentDate + "T12:00:00").getDay();

  const [{ data: whRows }, { data: blockRows }, { data: apptRows }] = await Promise.all([
    supabase
      .from("stylist_working_hours")
      .select("stylist_id, start_time, end_time, is_working")
      .in("stylist_id", targetIds)
      .eq("day_of_week", dayOfWeek),
    supabase
      .from("stylist_blocked_time")
      .select("stylist_id, start_time, end_time")
      .in("stylist_id", targetIds)
      .eq("block_date", appointmentDate),
    supabase
      .from("appointments")
      .select("stylist_id, start_at, end_at, status")
      .in("stylist_id", targetIds)
      .eq("appointment_date", appointmentDate)
      .is("deleted_at", null)
      .not("status", "in", '("cancelled","no_show")'),
  ]);

  const workingByStylist = new Map<
    string,
    { start_time: string; end_time: string; is_working: boolean }[]
  >();
  for (const row of whRows ?? []) {
    const sid = (row as { stylist_id: string }).stylist_id;
    if (!workingByStylist.has(sid)) workingByStylist.set(sid, []);
    workingByStylist.get(sid)!.push(
      row as { start_time: string; end_time: string; is_working: boolean },
    );
  }

  const blocksByStylist = new Map<string, { start_time: string; end_time: string }[]>();
  for (const row of blockRows ?? []) {
    const sid = (row as { stylist_id: string }).stylist_id;
    if (!blocksByStylist.has(sid)) blocksByStylist.set(sid, []);
    blocksByStylist.get(sid)!.push({
      start_time: String((row as { start_time: string }).start_time),
      end_time: String((row as { end_time: string }).end_time),
    });
  }

  const apptsByStylist = new Map<string, { start_at: string; end_at: string | null }[]>();
  for (const row of apptRows ?? []) {
    const sid = (row as { stylist_id: string }).stylist_id;
    if (!apptsByStylist.has(sid)) apptsByStylist.set(sid, []);
    apptsByStylist.get(sid)!.push({
      start_at: (row as { start_at: string }).start_at,
      end_at: (row as { end_at: string | null }).end_at ?? null,
    });
  }

  const flat: BookableSlot[] = [];
  const stylistRows: StylistAvailabilityRow[] = [];

  for (const sid of targetIds) {
    const meta = stylists.find((s) => s.id === sid);
    const name = meta ? displayStylistName(meta) : "Stylist";
    const workingList = workingByStylist.get(sid) ?? [];
    const working = workingList.find((r) => r.is_working);
    if (!working) {
      stylistRows.push({
        stylistId: sid,
        stylistName: name,
        eligible: true,
        hint: "No working hours this day.",
        slots: [],
      });
      continue;
    }

    const workStartMin = parseTimeToMinutes(String(working.start_time));
    const workEndMin = parseTimeToMinutes(String(working.end_time));
    const blocks = blocksByStylist.get(sid) ?? [];
    const appts = apptsByStylist.get(sid) ?? [];

    const rowSlots: BookableSlot[] = [];

    for (let m = workStartMin; m + durationMinutes <= workEndMin; m += SLOT_STEP_MINUTES) {
      if (flat.length >= MAX_SLOTS_TOTAL) break;

      const slotEndMin = m + durationMinutes;
      if (overlapsBlocks(m, slotEndMin, blocks)) continue;

      const startTime = minutesToHHmm(m);
      const startLocal = new Date(`${appointmentDate}T${startTime}`);
      const startMs = startLocal.getTime();
      const endMs = startMs + durationMinutes * 60 * 1000;

      if (overlapsAppointments(startMs, endMs, appts)) continue;

      const slot: BookableSlot = {
        startTime,
        stylistId: sid,
        stylistName: name,
        durationMinutes,
      };
      rowSlots.push(slot);
      flat.push(slot);
    }

    stylistRows.push({
      stylistId: sid,
      stylistName: name,
      eligible: true,
      hint:
        rowSlots.length === 0
          ? "No open slots left in this shift (bookings, blocks, or duration)."
          : undefined,
      slots: rowSlots,
    });

    if (flat.length >= MAX_SLOTS_TOTAL) break;
  }

  if (!stylistFilterId?.trim() && eligibleIds != null) {
    for (const s of stylists) {
      if (eligibleIds.includes(s.id)) continue;
      stylistRows.push({
        stylistId: s.id,
        stylistName: displayStylistName(s),
        eligible: false,
        hint: "Not assigned to this service.",
        slots: [],
      });
    }
  }

  flat.sort((a, b) => {
    const t = a.startTime.localeCompare(b.startTime);
    if (t !== 0) return t;
    return a.stylistName.localeCompare(b.stylistName);
  });

  const groupedByStylist: StylistSlotGroup[] = stylistRows
    .filter((r) => r.eligible && r.slots.length > 0)
    .map((r) => ({
      stylistId: r.stylistId,
      stylistName: r.stylistName,
      slots: r.slots,
    }));

  return {
    durationMinutes,
    slots: flat,
    groupedByStylist,
    stylistRows,
  };
}

/**
 * @deprecated Use `getBookableSlotsForServiceDate` for dashboard booking UI.
 * Legacy flat list with ISO timestamps (kept for any callers).
 */
export type SlotSuggestion = {
  stylistId: string;
  stylistName: string;
  startAt: string;
  endAt: string;
};

export async function getAvailableSlots(
  supabase: SupabaseClient,
  serviceId: string,
  date: string,
): Promise<SlotSuggestion[]> {
  if (!serviceId || !date) return [];

  const { data: stylistRows } = await supabase
    .from("stylists")
    .select("id, first_name, last_name, is_active")
    .eq("is_active", true);

  const stylists = (stylistRows ?? []) as StylistLite[];
  const res = await getBookableSlotsForServiceDate(supabase, {
    serviceId,
    appointmentDate: date,
    stylists,
  });

  return res.slots.map((s) => {
    const startLocal = new Date(`${date}T${s.startTime}`);
    const endLocal = new Date(
      startLocal.getTime() + s.durationMinutes * 60 * 1000,
    );
    return {
      stylistId: s.stylistId,
      stylistName: s.stylistName,
      startAt: startLocal.toISOString(),
      endAt: endLocal.toISOString(),
    };
  });
}
