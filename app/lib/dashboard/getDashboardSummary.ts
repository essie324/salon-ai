import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeClientRebookingDecision,
  type RebookingNudgeStatus,
} from "@/app/lib/rebooking/engine";
import type { ClientCategory } from "@/app/lib/clients/intelligence/types";
import { computeClientVisitMetrics } from "@/app/lib/clients/intelligence/metrics";
import { computeClientTotalSpendCents } from "@/app/lib/clients/intelligence/spend";
import { classifyClientCategory } from "@/app/lib/clients/intelligence/classifyClient";
import type { AppointmentRevenueRow, RevenueInsights } from "@/app/lib/revenue/metrics";
import { getDashboardRevenueInsights } from "@/app/lib/dashboard/revenueRules";
import { getCurrentMonthRangeISO, getCurrentWeekRangeISO, localDateISO } from "./dateRanges";
import { formatLocalISO, startOfLocalDay } from "@/app/lib/retention";
import type { GapFillRetentionClient } from "@/app/lib/gapFill/matchClients";
import { getGapFillSuggestionsForDate, type GapFillSuggestion } from "@/app/lib/scheduling/optimizer";
import { addCalendarDays } from "@/app/lib/calendar/schedulerData";
import {
  collectOutreachKeysFromQueue,
  mergeOutreachActionsIntoQueue,
  partitionOutreachQueueByFollowUp,
  type OutreachActionRow,
  type OutreachQueueBuckets,
} from "@/app/lib/outreach/followUp";
import {
  buildOutreachQueue,
  type ReminderAppointmentRow,
} from "@/app/lib/outreach/queue";
import {
  buildTodaysActionCenter,
  type ActionCenterItem,
  type ActionCenterReminderRow,
} from "@/app/lib/actionCenter/today";

type MoneySummary = {
  revenueCents: number;
  completedCount: number;
};

export type DashboardSummary = {
  todayISO: string;
  week: { startISO: string; endISO: string };
  month: { startISO: string; endISO: string };

  totals: {
    clients: number;
    appointments: number;
    services: number;
    stylists: number;
  };

  revenue: {
    today: MoneySummary;
    week: MoneySummary;
    avgTicketWeekCents: number | null;
  };

  /** Week-scoped revenue (payment-aware when statuses exist); optional for charts / future UI. */
  weekRevenueInsights: RevenueInsights;

  todaysAppointments: {
    total: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    no_show: number;
    checked_in: number;
    scheduled: number;
  };

  rebooking: {
    clientsToRebook: {
      id: string;
      name: string;
      lastServiceName: string | null;
      lastServiceId: string | null;
      preferredStylistId: string | null;
      lastCompletedISO: string;
      recommendedNextISO: string;
      status: Extract<RebookingNudgeStatus, "due_soon" | "overdue">;
      daysUntilOrOverdue: number;
    }[];
  };

  clientIntelligence: {
    counts: Record<ClientCategory, number>;
    atRisk: {
      id: string;
      name: string;
      lastVisitISO: string | null;
      recommendedReturnISO: string | null;
      totalSpendCents: number;
      noShowCount: number;
      cancellationCount: number;
    }[];
    highValue: {
      id: string;
      name: string;
      lastVisitISO: string | null;
      totalSpendCents: number;
      avgVisitFrequencyDays: number | null;
      totalVisits: number;
    }[];
  };

  retention: {
    dueSoonClients: {
      id: string;
      name: string;
      lastServiceName: string | null;
      lastServiceId: string | null;
      preferredStylistId: string | null;
      lastCompletedISO: string;
      recommendedNextISO: string;
      status: "due_soon";
      hasVisitMemory: boolean;
      daysUntilOrOverdue: number;
    }[];
    overdueClients: {
      id: string;
      name: string;
      lastServiceName: string | null;
      lastServiceId: string | null;
      preferredStylistId: string | null;
      lastCompletedISO: string;
      recommendedNextISO: string;
      status: "overdue";
      hasVisitMemory: boolean;
      daysUntilOrOverdue: number;
    }[];
    opportunities: {
      id: string;
      name: string;
      lastServiceName: string | null;
      lastCompletedISO: string;
      recommendedNextISO: string;
      status: "due_soon" | "overdue";
      hasVisitMemory: boolean;
    }[];
  };

  noShows: {
    thisMonthCount: number;
    topClients: { id: string; name: string; noShowCount: number }[];
  };

  topServices: {
    serviceId: string;
    serviceName: string;
    completedCount: number;
    revenueCents: number;
  }[];

  stylistUtilization: {
    stylistId: string;
    stylistName: string;
    appointmentsToday: number;
    completedToday: number;
    revenueTodayCents: number;
  }[];

  gapFill: {
    dateISO: string;
    suggestions: GapFillSuggestion[];
  };

  /** Daily outreach actions (reminders + rebooking nudges); display-only — no automations. */
  outreachQueue: OutreachQueueBuckets;

  /** Prioritized owner-facing actions (gaps, outreach, reminders). */
  actionCenter: {
    items: ActionCenterItem[];
  };
};

function nameFromParts(first?: string | null, last?: string | null) {
  return `${first ?? ""} ${last ?? ""}`.trim() || "Unnamed";
}

export async function getDashboardSummary(
  supabase: SupabaseClient,
): Promise<DashboardSummary> {
  const now = new Date();
  const todayISO = localDateISO(now);
  const week = getCurrentWeekRangeISO(now);
  const month = getCurrentMonthRangeISO(now);

  const reminderRangeStart = addCalendarDays(todayISO, 1);
  const reminderRangeEnd = addCalendarDays(todayISO, 2);

  const [
    { count: clientsCount },
    { count: appointmentsCount },
    { count: servicesCount },
    { count: stylistsCount },
    { data: revenueWeekRows },
    { data: todayAppts },
    { data: todayCompletedRevenueRows },
    { data: monthNoShows },
    { data: topNoShowClients },
    { data: stylists },
    { data: services },
    { data: completedWeekForServices },
    { data: recentCompletedAppointments },
    { data: clients },
    { data: memoryJoinRows },
    { data: upcomingReminderAppointments },
  ] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("appointments").select("*", { count: "exact", head: true }),
    supabase.from("services").select("*", { count: "exact", head: true }),
    supabase.from("stylists").select("*", { count: "exact", head: true }),
    supabase
      .from("appointments")
      .select(
        "appointment_date, appointment_price_cents, tip_cents, payment_status, stylist_id",
      )
      .eq("status", "completed")
      .is("deleted_at", null)
      .gte("appointment_date", week.startISO)
      .lte("appointment_date", week.endISO),

    supabase
      .from("appointments")
      .select(
        "id, status, stylist_id, appointment_price_cents, tip_cents, payment_status",
      )
      .is("deleted_at", null)
      .eq("appointment_date", todayISO),

    supabase
      .from("appointments")
      .select(
        "appointment_date, stylist_id, appointment_price_cents, tip_cents, payment_status",
      )
      .eq("status", "completed")
      .is("deleted_at", null)
      .eq("appointment_date", todayISO),

    supabase
      .from("appointments")
      .select("id")
      .is("deleted_at", null)
      .eq("status", "no_show")
      .gte("appointment_date", month.startISO)
      .lte("appointment_date", month.endISO),

    supabase
      .from("clients")
      .select("id, first_name, last_name, no_show_count")
      .gt("no_show_count", 0)
      .order("no_show_count", { ascending: false })
      .limit(8),

    supabase
      .from("stylists")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("first_name", { ascending: true }),

    supabase.from("services").select("id, name").order("name", { ascending: true }),

    supabase
      .from("appointments")
      .select("service_id, appointment_price_cents, tip_cents")
      .is("deleted_at", null)
      .eq("status", "completed")
      .gte("appointment_date", week.startISO)
      .lte("appointment_date", week.endISO),

    supabase
      .from("appointments")
      .select(
        "client_id, service_id, start_at, status, appointment_price_cents, tip_cents, payment_status",
      )
      .is("deleted_at", null)
      .in("status", ["completed", "no_show", "cancelled"])
      .order("start_at", { ascending: false })
      .limit(2000),

    supabase
      .from("clients")
      .select(
        "id, first_name, last_name, no_show_count, deposit_required, booking_restricted, preferred_stylist_id",
      ),

    supabase
      .from("appointment_memories")
      .select("appointment_id, appointments!inner(client_id)")
      .limit(2000),

    supabase
      .from("appointments")
      .select("id, client_id, stylist_id, service_id, appointment_date, start_at, status")
      .is("deleted_at", null)
      .in("status", ["scheduled", "confirmed"])
      .gte("appointment_date", reminderRangeStart)
      .lte("appointment_date", reminderRangeEnd),
  ]);

  const weekRevenueInsights = getDashboardRevenueInsights(
    (revenueWeekRows ?? []) as AppointmentRevenueRow[],
  );

  const todayRevenueCents =
    weekRevenueInsights.revenueByDay.find((d) => d.dateISO === todayISO)?.revenueCents ?? 0;

  const todayCompletedRevInsights = getDashboardRevenueInsights(
    (todayCompletedRevenueRows ?? []) as AppointmentRevenueRow[],
  );
  const revenueTodayByStylistId = new Map(
    todayCompletedRevInsights.revenueByStylist.map((r) => [r.stylistId, r.revenueCents]),
  );

  const weekRevenueCents = weekRevenueInsights.totalRevenueCents;
  const weekCompletedCount = (revenueWeekRows ?? []).length;

  const counts = {
    total: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
    checked_in: 0,
    scheduled: 0,
  };
  for (const a of todayAppts ?? []) {
    counts.total += 1;
    const s = a.status as string;
    if (s === "confirmed") counts.confirmed += 1;
    else if (s === "completed") counts.completed += 1;
    else if (s === "cancelled") counts.cancelled += 1;
    else if (s === "no_show") counts.no_show += 1;
    else if (s === "checked_in") counts.checked_in += 1;
    else if (s === "scheduled") counts.scheduled += 1;
  }

  const todayCompletedCount = counts.completed;

  const apptsTodayByStylist = new Map<string, { total: number; completed: number }>();
  for (const a of todayAppts ?? []) {
    const sid = a.stylist_id as string | null;
    if (!sid) continue;
    const cur = apptsTodayByStylist.get(sid) ?? { total: 0, completed: 0 };
    cur.total += 1;
    if (a.status === "completed") cur.completed += 1;
    apptsTodayByStylist.set(sid, cur);
  }

  const stylistUtilization = (stylists ?? []).map((s) => {
    const name = nameFromParts(s.first_name, s.last_name);
    const stat = apptsTodayByStylist.get(s.id) ?? { total: 0, completed: 0 };
    return {
      stylistId: s.id,
      stylistName: name,
      appointmentsToday: stat.total,
      completedToday: stat.completed,
      revenueTodayCents: revenueTodayByStylistId.get(s.id) ?? 0,
    };
  });

  const thisMonthCount = (monthNoShows ?? []).length;
  const topClients = (topNoShowClients ?? []).map((c) => ({
    id: c.id,
    name: nameFromParts(c.first_name, c.last_name),
    noShowCount: c.no_show_count ?? 0,
  }));

  const serviceNameById = new Map((services ?? []).map((s) => [s.id, s.name ?? "Unnamed Service"]));
  const byService = new Map<string, { count: number; revenueCents: number }>();
  for (const row of completedWeekForServices ?? []) {
    const sid = row.service_id as string | null;
    if (!sid) continue;
    const cur = byService.get(sid) ?? { count: 0, revenueCents: 0 };
    cur.count += 1;
    cur.revenueCents += (row.appointment_price_cents ?? 0) + (row.tip_cents ?? 0);
    byService.set(sid, cur);
  }
  const topServices = Array.from(byService.entries())
    .map(([serviceId, v]) => ({
      serviceId,
      serviceName: serviceNameById.get(serviceId) ?? "Unnamed Service",
      completedCount: v.count,
      revenueCents: v.revenueCents,
    }))
    .sort((a, b) => b.completedCount - a.completedCount)
    .slice(0, 3);

  const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));
  const serviceMap = new Map((services ?? []).map((s) => [s.id, { name: s.name ?? null }]));
  const byClientAppointments = new Map<
    string,
    {
      start_at: string;
      status: string;
      service_id: string | null;
      appointment_price_cents?: number | null;
      tip_cents?: number | null;
      payment_status?: string | null;
    }[]
  >();

  for (const appt of recentCompletedAppointments ?? []) {
    if (!appt.client_id) continue;
    const list = byClientAppointments.get(appt.client_id) ?? [];
    list.push({
      start_at: appt.start_at,
      status: appt.status,
      service_id: appt.service_id,
      appointment_price_cents: (appt as { appointment_price_cents?: number | null })
        .appointment_price_cents ?? null,
      tip_cents: (appt as { tip_cents?: number | null }).tip_cents ?? null,
      payment_status: (appt as { payment_status?: string | null }).payment_status ?? null,
    });
    byClientAppointments.set(appt.client_id, list);
  }

  const startOfToday = startOfLocalDay(now);

  const hasMemoryByClientId = new Set<string>();
  for (const row of memoryJoinRows ?? []) {
    const clientId = (row as { appointments?: { client_id?: string } })?.appointments
      ?.client_id as string | undefined;
    if (clientId) hasMemoryByClientId.add(clientId);
  }

  type RetentionRow = {
    id: string;
    name: string;
    lastServiceName: string | null;
    lastServiceId: string | null;
    preferredStylistId: string | null;
    lastCompletedISO: string;
    recommendedNextISO: string;
    recommendedDate: Date;
    status: "due_soon" | "overdue";
    hasVisitMemory: boolean;
    daysUntilOrOverdue: number;
    bookingRestricted: boolean;
  };

  type RebookingClientRow = {
    id: string;
    name: string;
    lastCompletedDate: Date;
    recommendedNextDate: Date;
    status: Extract<RebookingNudgeStatus, "due_soon" | "overdue">;
    daysUntilOrOverdue: number;
    hasVisitMemory: boolean;
    lastServiceName: string | null;
    lastServiceId: string | null;
    preferredStylistId: string | null;
  };

  const allRetention: RetentionRow[] = [];
  const clientsToRebookAll: RebookingClientRow[] = [];

  const intelligenceCounts: Record<ClientCategory, number> = {
    high_value: 0,
    regular: 0,
    at_risk: 0,
    inactive: 0,
  };

  const atRiskClientsAll: {
    id: string;
    name: string;
    lastVisitAt: Date | null;
    recommendedReturnDate: Date | null;
    totalSpendCents: number;
    noShowCount: number;
    cancellationCount: number;
  }[] = [];

  const highValueClientsAll: {
    id: string;
    name: string;
    lastVisitAt: Date | null;
    totalSpendCents: number;
    avgVisitFrequencyDays: number | null;
    totalVisits: number;
  }[] = [];

  const processedClientIds = new Set<string>();

  for (const [clientId, appts] of byClientAppointments.entries()) {
    const client = clientMap.get(clientId);
    if (!client) continue;

    processedClientIds.add(clientId);

    const decision = computeClientRebookingDecision({
      appointments: appts,
      serviceById: serviceMap,
      today: startOfToday,
      dueSoonDays: 14,
    });

    const metrics = computeClientVisitMetrics(appts);
    const spend = computeClientTotalSpendCents(appts);
    const classification = classifyClientCategory({
      now: startOfToday,
      metrics,
      rebookingStatus: decision.rebooking_status,
      recommendedReturnDate: decision.recommended_next_visit_date,
      spendCents: spend.totalSpendCents,
    });

    intelligenceCounts[classification.category] += 1;

    if (classification.category === "at_risk") {
      atRiskClientsAll.push({
        id: clientId,
        name: nameFromParts(client.first_name, client.last_name),
        lastVisitAt: metrics.lastVisitAt,
        recommendedReturnDate: decision.recommended_next_visit_date,
        totalSpendCents: spend.totalSpendCents,
        noShowCount: metrics.noShowCount,
        cancellationCount: metrics.cancellationCount,
      });
    }

    if (classification.category === "high_value") {
      highValueClientsAll.push({
        id: clientId,
        name: nameFromParts(client.first_name, client.last_name),
        lastVisitAt: metrics.lastVisitAt,
        totalSpendCents: spend.totalSpendCents,
        avgVisitFrequencyDays: metrics.avgVisitFrequencyDays,
        totalVisits: metrics.totalVisits,
      });
    }

    if (!decision.recommended_next_visit_date) continue;
    if (decision.rebooking_status !== "due_soon" && decision.rebooking_status !== "overdue") {
      continue;
    }

    if (!decision.last_completed_date) continue;

    const lastCompletedISO = formatLocalISO(decision.last_completed_date);
    const recommendedNextISO = formatLocalISO(decision.recommended_next_visit_date);
    if (!lastCompletedISO || !recommendedNextISO) continue;

    const hasVisitMemory = hasMemoryByClientId.has(clientId);
    const preferredStylistId =
      (client as { preferred_stylist_id?: string | null }).preferred_stylist_id ?? null;

    clientsToRebookAll.push({
      id: clientId,
      name: nameFromParts(client.first_name, client.last_name),
      lastCompletedDate: decision.last_completed_date,
      recommendedNextDate: decision.recommended_next_visit_date,
      status: decision.rebooking_status,
      daysUntilOrOverdue: decision.days_until_or_overdue ?? 0,
      hasVisitMemory,
      lastServiceName: decision.last_completed_service,
      lastServiceId: decision.last_completed_service_id,
      preferredStylistId,
    });

    const retentionStatus = decision.rebooking_status;

    const bookingRestricted =
      (client as { booking_restricted?: boolean | null }).booking_restricted === true;

    allRetention.push({
      id: clientId,
      name: nameFromParts(client.first_name, client.last_name),
      lastServiceName: decision.last_completed_service,
      lastServiceId: decision.last_completed_service_id,
      preferredStylistId,
      lastCompletedISO,
      recommendedNextISO,
      recommendedDate: decision.recommended_next_visit_date,
      status: retentionStatus,
      hasVisitMemory,
      daysUntilOrOverdue: decision.days_until_or_overdue ?? 0,
      bookingRestricted,
    });
  }

  for (const [clientId] of clientMap.entries()) {
    if (!processedClientIds.has(clientId)) {
      intelligenceCounts.inactive += 1;
    }
  }

  const clientsToRebook = clientsToRebookAll
    .sort((a, b) => {
      const pa = a.status === "overdue" ? 0 : 1;
      const pb = b.status === "overdue" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return a.recommendedNextDate.getTime() - b.recommendedNextDate.getTime();
    })
    .slice(0, 12)
    .map((r) => ({
      id: r.id,
      name: r.name,
      lastServiceName: r.lastServiceName,
      lastServiceId: r.lastServiceId,
      preferredStylistId: r.preferredStylistId,
      lastCompletedISO: formatLocalISO(r.lastCompletedDate)!,
      recommendedNextISO: formatLocalISO(r.recommendedNextDate)!,
      status: r.status,
      daysUntilOrOverdue: r.daysUntilOrOverdue,
    }));

  const overdue = allRetention
    .filter((r) => r.status === "overdue")
    .sort((a, b) => a.recommendedDate.getTime() - b.recommendedDate.getTime());
  const dueSoon = allRetention
    .filter((r) => r.status === "due_soon")
    .sort((a, b) => a.recommendedDate.getTime() - b.recommendedDate.getTime());

  const opportunityEnd = startOfLocalDay(new Date(startOfToday.getTime()));
  opportunityEnd.setDate(opportunityEnd.getDate() + 7);
  const opportunities = allRetention
    .filter(
      (r) =>
        r.status === "overdue" || r.recommendedDate.getTime() <= opportunityEnd.getTime(),
    )
    .sort((a, b) => a.recommendedDate.getTime() - b.recommendedDate.getTime());

  const baseOutreachQueue = buildOutreachQueue({
    now,
    reminderAppointments: (upcomingReminderAppointments ?? []) as ReminderAppointmentRow[],
    dueSoon: dueSoon.slice(0, 20).map((r) => ({
      id: r.id,
      name: r.name,
      lastServiceName: r.lastServiceName,
      lastServiceId: r.lastServiceId,
      preferredStylistId: r.preferredStylistId,
      lastCompletedISO: r.lastCompletedISO,
      recommendedNextISO: r.recommendedNextISO,
      daysUntilOrOverdue: r.daysUntilOrOverdue,
      hasVisitMemory: r.hasVisitMemory,
      bookingRestricted: r.bookingRestricted,
    })),
    overdue: overdue.slice(0, 20).map((r) => ({
      id: r.id,
      name: r.name,
      lastServiceName: r.lastServiceName,
      lastServiceId: r.lastServiceId,
      preferredStylistId: r.preferredStylistId,
      lastCompletedISO: r.lastCompletedISO,
      recommendedNextISO: r.recommendedNextISO,
      daysUntilOrOverdue: r.daysUntilOrOverdue,
      hasVisitMemory: r.hasVisitMemory,
      bookingRestricted: r.bookingRestricted,
    })),
    clientNameById: new Map(
      (clients ?? []).map((c) => [c.id, nameFromParts(c.first_name, c.last_name)]),
    ),
    stylistNameById: new Map(
      (stylists ?? []).map((s) => [s.id, nameFromParts(s.first_name, s.last_name)]),
    ),
    serviceNameById: new Map((services ?? []).map((s) => [s.id, s.name ?? "Unnamed Service"])),
  });

  const outreachKeys = collectOutreachKeysFromQueue(baseOutreachQueue);
  let outreachActionRows: OutreachActionRow[] = [];
  if (outreachKeys.length > 0) {
    const { data: oaRows, error: oaErr } = await supabase
      .from("outreach_actions")
      .select(
        "id, outreach_key, outreach_type, client_id, appointment_id, action_state, scheduled_for, sent_at, is_ready, last_message_preview, created_at, updated_at",
      )
      .in("outreach_key", outreachKeys);
    if (!oaErr && oaRows) {
      outreachActionRows = oaRows as OutreachActionRow[];
    }
  }

  const mergedQueue = mergeOutreachActionsIntoQueue(baseOutreachQueue, outreachActionRows);
  const outreachQueue = partitionOutreachQueueByFollowUp(mergedQueue, now);

  const clientIntelligenceAtRisk = atRiskClientsAll
    .slice()
    .sort((a, b) => {
      const ra = a.recommendedReturnDate ? a.recommendedReturnDate.getTime() : Number.POSITIVE_INFINITY;
      const rb = b.recommendedReturnDate ? b.recommendedReturnDate.getTime() : Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      return b.totalSpendCents - a.totalSpendCents;
    })
    .slice(0, 8)
    .map((c) => ({
      id: c.id,
      name: c.name,
      lastVisitISO: c.lastVisitAt ? formatLocalISO(c.lastVisitAt) : null,
      recommendedReturnISO: c.recommendedReturnDate ? formatLocalISO(c.recommendedReturnDate) : null,
      totalSpendCents: c.totalSpendCents,
      noShowCount: c.noShowCount,
      cancellationCount: c.cancellationCount,
    }));

  const clientIntelligenceHighValue = highValueClientsAll
    .slice()
    .sort((a, b) => b.totalSpendCents - a.totalSpendCents)
    .slice(0, 8)
    .map((c) => ({
      id: c.id,
      name: c.name,
      lastVisitISO: c.lastVisitAt ? formatLocalISO(c.lastVisitAt) : null,
      totalSpendCents: c.totalSpendCents,
      avgVisitFrequencyDays: c.avgVisitFrequencyDays ?? null,
      totalVisits: c.totalVisits,
    }));

  const tomorrowISO = addCalendarDays(todayISO, 1);
  const retentionPoolForGaps: GapFillRetentionClient[] = [
    ...overdue.slice(0, 25).map((r) => ({
      id: r.id,
      name: r.name,
      lastServiceName: r.lastServiceName,
      lastServiceId: r.lastServiceId,
      preferredStylistId: r.preferredStylistId,
      status: "overdue" as const,
      hasVisitMemory: r.hasVisitMemory,
    })),
    ...dueSoon.slice(0, 25).map((r) => ({
      id: r.id,
      name: r.name,
      lastServiceName: r.lastServiceName,
      lastServiceId: r.lastServiceId,
      preferredStylistId: r.preferredStylistId,
      status: "due_soon" as const,
      hasVisitMemory: r.hasVisitMemory,
    })),
  ].slice(0, 40);

  const [
    gapFillSuggestions,
    gapFillTomorrowSuggestions,
    actionCenterReminderRes,
  ] = await Promise.all([
    getGapFillSuggestionsForDate({
      supabase,
      dateISO: todayISO,
      minGapMinutes: 30,
      retentionClients: retentionPoolForGaps,
    }),
    getGapFillSuggestionsForDate({
      supabase,
      dateISO: tomorrowISO,
      minGapMinutes: 30,
      retentionClients: retentionPoolForGaps,
    }),
    supabase
      .from("appointments")
      .select("id, client_id, stylist_id, service_id, appointment_date, start_at, status")
      .is("deleted_at", null)
      .in("status", ["scheduled", "confirmed"])
      .gte("appointment_date", todayISO)
      .lte("appointment_date", tomorrowISO)
      .order("appointment_date", { ascending: true })
      .order("start_at", { ascending: true }),
  ]);

  const actionCenterReminderRows =
    !actionCenterReminderRes.error && actionCenterReminderRes.data
      ? actionCenterReminderRes.data
      : [];

  const clientNameByIdForAction = new Map(
    (clients ?? []).map((c) => [c.id, nameFromParts(c.first_name, c.last_name)]),
  );
  const stylistNameByIdForAction = new Map(
    (stylists ?? []).map((s) => [s.id, nameFromParts(s.first_name, s.last_name)]),
  );
  const serviceNameByIdForAction = new Map(
    (services ?? []).map((s) => [s.id, s.name ?? "Unnamed Service"]),
  );

  const actionCenter = buildTodaysActionCenter({
    todayISO,
    tomorrowISO,
    gapFillToday: gapFillSuggestions,
    gapFillTomorrow: gapFillTomorrowSuggestions,
    outreachQueue,
    reminderAppointments: actionCenterReminderRows as ActionCenterReminderRow[],
    clientNameById: clientNameByIdForAction,
    stylistNameById: stylistNameByIdForAction,
    serviceNameById: serviceNameByIdForAction,
  });

  return {
    todayISO,
    week,
    month,
    totals: {
      clients: clientsCount ?? 0,
      appointments: appointmentsCount ?? 0,
      services: servicesCount ?? 0,
      stylists: stylistsCount ?? 0,
    },
    revenue: {
      today: {
        revenueCents: todayRevenueCents,
        completedCount: todayCompletedCount,
      },
      week: {
        revenueCents: weekRevenueCents,
        completedCount: weekCompletedCount,
      },
      avgTicketWeekCents: weekRevenueInsights.avgTicketCents,
    },
    weekRevenueInsights,
    todaysAppointments: counts,
    rebooking: {
      clientsToRebook,
    },
    clientIntelligence: {
      counts: intelligenceCounts,
      atRisk: clientIntelligenceAtRisk,
      highValue: clientIntelligenceHighValue,
    },
    retention: {
      dueSoonClients: dueSoon.slice(0, 8).map((r) => ({
        id: r.id,
        name: r.name,
        lastServiceName: r.lastServiceName,
        lastServiceId: r.lastServiceId,
        preferredStylistId: r.preferredStylistId,
        lastCompletedISO: r.lastCompletedISO,
        recommendedNextISO: r.recommendedNextISO,
        status: "due_soon",
        hasVisitMemory: r.hasVisitMemory,
        daysUntilOrOverdue: r.daysUntilOrOverdue,
      })),
      overdueClients: overdue.slice(0, 8).map((r) => ({
        id: r.id,
        name: r.name,
        lastServiceName: r.lastServiceName,
        lastServiceId: r.lastServiceId,
        preferredStylistId: r.preferredStylistId,
        lastCompletedISO: r.lastCompletedISO,
        recommendedNextISO: r.recommendedNextISO,
        status: "overdue",
        hasVisitMemory: r.hasVisitMemory,
        daysUntilOrOverdue: r.daysUntilOrOverdue,
      })),
      opportunities: opportunities.slice(0, 10).map((r) => ({
        id: r.id,
        name: r.name,
        lastServiceName: r.lastServiceName,
        lastCompletedISO: r.lastCompletedISO,
        recommendedNextISO: r.recommendedNextISO,
        status: r.status,
        hasVisitMemory: r.hasVisitMemory,
      })),
    },
    noShows: {
      thisMonthCount: thisMonthCount,
      topClients,
    },
    topServices,
    stylistUtilization,
    gapFill: {
      dateISO: todayISO,
      suggestions: gapFillSuggestions,
    },
    outreachQueue,
    actionCenter,
  };
}
