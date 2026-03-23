import type { SupabaseClient } from "@supabase/supabase-js";

export type GapFillSuggestion = {
  dateISO: string; // YYYY-MM-DD
  startTime: string; // HH:MM (local)
  endTime: string; // HH:MM (local)
  durationMinutes: number;
  stylist: { id: string; name: string };
  suggestedService?: { id: string; name: string; durationMinutes: number };
  suggestedClient?: { id: string; name: string; status: "due_soon" | "overdue" };
  bookingUrl: string;
};

type WorkingHourRow = {
  stylist_id: string;
  day_of_week: number; // 0=Sun
  start_time: string | null; // HH:MM:SS
  end_time: string | null; // HH:MM:SS
  is_working: boolean | null;
};

type BlockedRow = {
  stylist_id: string;
  block_date: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM:SS
  end_time: string | null; // HH:MM:SS
};

type AppointmentRow = {
  stylist_id: string | null;
  start_at: string;
  end_at: string | null;
  status: string;
  deleted_at?: string | null;
};

type ServiceRow = {
  id: string;
  name: string | null;
  duration_minutes: number | null;
};

type RetentionClient = {
  id: string;
  name: string;
  lastServiceName: string | null;
  status: "due_soon" | "overdue";
};

type Interval = { startMin: number; endMin: number };

function toMinutes(hhmmss: string): number {
  const [h, m] = hhmmss.split(":");
  return Number(h) * 60 + Number(m);
}

function toHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTimeToMinutes(value: string | null): number | null {
  if (!value) return null;
  // Accept HH:MM or HH:MM:SS
  const v = value.length >= 5 ? value.slice(0, 5) : value;
  if (!/^\d{2}:\d{2}$/.test(v)) return null;
  return toMinutes(v);
}

function intervalOverlap(a: Interval, b: Interval): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

function clipInterval(i: Interval, window: Interval): Interval | null {
  const startMin = Math.max(i.startMin, window.startMin);
  const endMin = Math.min(i.endMin, window.endMin);
  if (endMin <= startMin) return null;
  return { startMin, endMin };
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.startMin - b.startMin);
  const out: Interval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = out[out.length - 1];
    const cur = sorted[i];
    if (cur.startMin <= prev.endMin) {
      prev.endMin = Math.max(prev.endMin, cur.endMin);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

function computeGaps(occupied: Interval[], window: Interval, minGapMinutes: number): Interval[] {
  const clipped = occupied
    .map((i) => clipInterval(i, window))
    .filter(Boolean) as Interval[];
  const merged = mergeIntervals(clipped);

  const gaps: Interval[] = [];
  let cursor = window.startMin;
  for (const occ of merged) {
    if (occ.startMin - cursor >= minGapMinutes) {
      gaps.push({ startMin: cursor, endMin: occ.startMin });
    }
    cursor = Math.max(cursor, occ.endMin);
  }
  if (window.endMin - cursor >= minGapMinutes) {
    gaps.push({ startMin: cursor, endMin: window.endMin });
  }
  return gaps;
}

function serviceFitsGap(service: ServiceRow, gapMinutes: number): boolean {
  const dur = service.duration_minutes ?? 60;
  return dur > 0 && dur <= gapMinutes;
}

function pickServiceForGap(services: ServiceRow[], gapMinutes: number): ServiceRow | null {
  const candidates = services.filter((s) => serviceFitsGap(s, gapMinutes));
  if (candidates.length === 0) return null;
  // Prefer the longest service that still fits (gap-filling)
  candidates.sort((a, b) => (b.duration_minutes ?? 60) - (a.duration_minutes ?? 60));
  return candidates[0];
}

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase();
}

function clientMatchesService(client: RetentionClient, service: ServiceRow | null): boolean {
  if (!service) return false;
  const a = normalize(client.lastServiceName);
  const b = normalize(service.name);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function pickClientForGap(options: {
  clients: RetentionClient[];
  service: ServiceRow | null;
}): RetentionClient | null {
  const { clients, service } = options;
  if (clients.length === 0) return null;

  const overdue = clients.filter((c) => c.status === "overdue");
  const dueSoon = clients.filter((c) => c.status === "due_soon");

  const tryMatch = (pool: RetentionClient[]) => {
    const match = pool.find((c) => clientMatchesService(c, service));
    return match ?? null;
  };

  return (
    tryMatch(overdue) ||
    tryMatch(dueSoon) ||
    overdue[0] ||
    dueSoon[0] ||
    null
  );
}

function buildBookingUrl(options: { stylistId: string; dateISO: string; timeHHMM: string }): string {
  const params = new URLSearchParams();
  params.set("stylistId", options.stylistId);
  params.set("date", options.dateISO);
  params.set("time", options.timeHHMM);
  return `/dashboard/appointments/new?${params.toString()}`;
}

const OCCUPYING_STATUSES = new Set(["scheduled", "confirmed", "checked_in", "completed"]);

export async function getGapFillSuggestionsForDate(options: {
  supabase: SupabaseClient;
  dateISO: string; // YYYY-MM-DD (local date)
  minGapMinutes?: number; // default 30
  retentionClients: RetentionClient[]; // due soon + overdue; already computed elsewhere
}): Promise<GapFillSuggestion[]> {
  const { supabase, dateISO } = options;
  const minGapMinutes = options.minGapMinutes ?? 30;

  const dayOfWeek = new Date(dateISO + "T12:00:00").getDay(); // 0=Sun

  const [
    { data: stylists },
    { data: workingHours },
    { data: blockedRows },
    { data: appts },
    { data: services },
  ] = await Promise.all([
    supabase
      .from("stylists")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("first_name", { ascending: true }),
    supabase
      .from("stylist_working_hours")
      .select("stylist_id, day_of_week, start_time, end_time, is_working")
      .eq("day_of_week", dayOfWeek),
    supabase
      .from("stylist_blocked_time")
      .select("stylist_id, block_date, start_time, end_time")
      .eq("block_date", dateISO),
    supabase
      .from("appointments")
      .select("stylist_id, start_at, end_at, status, deleted_at")
      .eq("appointment_date", dateISO)
      .is("deleted_at", null)
      .order("start_at", { ascending: true }),
    supabase.from("services").select("id, name, duration_minutes").order("duration_minutes", { ascending: true }),
  ]);

  const stylistList = (stylists ?? []) as { id: string; first_name: string | null; last_name: string | null }[];
  const hoursList = (workingHours ?? []) as WorkingHourRow[];
  const blockedList = (blockedRows ?? []) as BlockedRow[];
  const apptList = (appts ?? []) as AppointmentRow[];
  const serviceList = (services ?? []) as ServiceRow[];

  const hoursByStylist = new Map<string, WorkingHourRow>();
  for (const h of hoursList) hoursByStylist.set(h.stylist_id, h);

  const blockedByStylist = new Map<string, BlockedRow[]>();
  for (const b of blockedList) {
    const list = blockedByStylist.get(b.stylist_id) ?? [];
    list.push(b);
    blockedByStylist.set(b.stylist_id, list);
  }

  const apptsByStylist = new Map<string, AppointmentRow[]>();
  for (const a of apptList) {
    const sid = a.stylist_id;
    if (!sid) continue;
    if (!OCCUPYING_STATUSES.has(a.status)) continue;
    const list = apptsByStylist.get(sid) ?? [];
    list.push(a);
    apptsByStylist.set(sid, list);
  }

  const retentionPool = options.retentionClients;

  const suggestions: GapFillSuggestion[] = [];

  for (const s of stylistList) {
    const h = hoursByStylist.get(s.id);
    if (!h || h.is_working === false) continue;

    const startMin = parseTimeToMinutes(h.start_time);
    const endMin = parseTimeToMinutes(h.end_time);
    if (startMin == null || endMin == null || endMin <= startMin) continue;
    const window: Interval = { startMin, endMin };

    const occupied: Interval[] = [];

    // Appointments occupy their start/end (local time)
    for (const a of apptsByStylist.get(s.id) ?? []) {
      const start = new Date(a.start_at);
      const end = a.end_at ? new Date(a.end_at) : null;
      const startOcc = start.getHours() * 60 + start.getMinutes();
      const endOcc = end ? end.getHours() * 60 + end.getMinutes() : startOcc + 60;
      if (endOcc > startOcc) occupied.push({ startMin: startOcc, endMin: endOcc });
    }

    // Blocked time occupies its range
    for (const b of blockedByStylist.get(s.id) ?? []) {
      const bStart = parseTimeToMinutes(b.start_time);
      const bEnd = parseTimeToMinutes(b.end_time);
      if (bStart == null || bEnd == null || bEnd <= bStart) continue;
      occupied.push({ startMin: bStart, endMin: bEnd });
    }

    const gaps = computeGaps(occupied, window, minGapMinutes);

    const stylistName =
      `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Stylist";

    for (const g of gaps) {
      const durationMinutes = g.endMin - g.startMin;
      // Also ensure the gap does not overlap any blocked time (already included in occupied),
      // but keep an extra guard in case working hours were missing.
      if (durationMinutes < minGapMinutes) continue;

      const pickedService = pickServiceForGap(serviceList, durationMinutes);
      const pickedClient = pickClientForGap({ clients: retentionPool, service: pickedService });

      suggestions.push({
        dateISO,
        startTime: toHHMM(g.startMin),
        endTime: toHHMM(g.endMin),
        durationMinutes,
        stylist: { id: s.id, name: stylistName },
        suggestedService: pickedService
          ? {
              id: pickedService.id,
              name: pickedService.name ?? "Service",
              durationMinutes: pickedService.duration_minutes ?? 60,
            }
          : undefined,
        suggestedClient: pickedClient
          ? { id: pickedClient.id, name: pickedClient.name, status: pickedClient.status }
          : undefined,
        bookingUrl: buildBookingUrl({ stylistId: s.id, dateISO, timeHHMM: toHHMM(g.startMin) }),
      });
    }
  }

  // Rank: smaller gaps first are harder to fill; then overdue-first; then earlier in day.
  suggestions.sort((a, b) => {
    if (a.durationMinutes !== b.durationMinutes) return a.durationMinutes - b.durationMinutes;
    const ao = a.suggestedClient?.status === "overdue" ? 0 : 1;
    const bo = b.suggestedClient?.status === "overdue" ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return a.startTime.localeCompare(b.startTime);
  });

  return suggestions.slice(0, 12);
}

