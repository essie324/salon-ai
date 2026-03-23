/**
 * Automated rebooking intelligence (COMPETITOR_BENCHMARK: better retention;
 * BUILD_GUIDELINES: client intelligence, simple and extendable).
 *
 * Core logic:
 * - Find last completed (maintenance) appointment per client.
 * - Service-based return window: hair color 4–8w, haircut 3–6w, extensions 6–10w, fallback 4w.
 * - recommended_date = last_visit + chosen weeks; status = overdue | due | upcoming.
 * - Optional: client cadence and risk (no-show/deposit) nudge earlier.
 */
export type RebookingStatus = "upcoming" | "due" | "overdue";

export type ClientRebookingDecision = {
  recommended_date: Date | null;
  status: RebookingStatus;
  days_since_last_visit: number | null;

  // Extra context (useful for UI)
  last_completed_at: Date | null;
  last_service_name: string | null;

  // Personalization signals (optional / UI-friendly)
  avg_visit_frequency_weeks?: number | null;
  window_weeks?: { minWeeks: number; maxWeeks: number } | null;
  reasoning?: string | null;
};

type AppointmentLike = {
  start_at: string;
  status: string;
  service_id: string | null;
};

type ServiceLike = {
  name: string | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date.getTime());
  out.setDate(out.getDate() + days);
  return out;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function getRebookingWindowWeeks(serviceName: string | null | undefined): {
  minWeeks: number;
  maxWeeks: number;
} {
  const lower = (serviceName ?? "").toLowerCase();

  // Consultation-only (no recommendation)
  if (lower.includes("consult")) {
    return { minWeeks: 0, maxWeeks: 0 };
  }

  // Extensions
  if (lower.includes("extension") || lower.includes("extensions") || lower.includes("move-up") || lower.includes("move up")) {
    return { minWeeks: 6, maxWeeks: 10 };
  }

  // Haircut (cut/trim)
  if (lower.includes("cut") || lower.includes("haircut") || lower.includes("trim")) {
    return { minWeeks: 3, maxWeeks: 6 };
  }

  // Hair color / maintenance (color, highlights, balayage, toner, roots, gloss, etc.)
  if (
    lower.includes("color") ||
    lower.includes("blond") ||
    lower.includes("highlight") ||
    lower.includes("balayage") ||
    lower.includes("foil") ||
    lower.includes("toner") ||
    lower.includes("gloss") ||
    lower.includes("root") ||
    lower.includes("touch") ||
    lower.includes("regrowth") ||
    lower.includes("greying") ||
    lower.includes("gray") ||
    lower.includes("grey")
  ) {
    return { minWeeks: 4, maxWeeks: 8 };
  }

  // Fallback
  return { minWeeks: 4, maxWeeks: 4 };
}

/**
 * Simple rule-based rebooking recommendation:
 * - Uses ONLY the most recent completed appointment.
 * - Maps service name keywords to a service-specific weeks range.
 * - Picks a single recommended_date = last_completed_at + maxWeeks.
 *
 * Later you can extend this to incorporate past client behavior,
 * formula memory signals, or variability within the min/max range.
 */
export function computeClientRebookingDecision(options: {
  appointments: AppointmentLike[];
  serviceById: Map<string, ServiceLike>;
  clientRisk?: {
    noShowCount?: number | null;
    depositRequired?: boolean | null;
    bookingRestricted?: boolean | null;
  };
  today?: Date;
  dueSoonDays?: number; // inclusive window: today..today+dueSoonDays => "due"
}): ClientRebookingDecision {
  const {
    appointments,
    serviceById,
    clientRisk,
    today = new Date(),
    dueSoonDays = 14,
  } = options;

  const completed = appointments
    .filter((a) => a.status === "completed" && a.start_at)
    .sort((a, b) => (a.start_at < b.start_at ? 1 : -1));

  if (completed.length === 0) {
    return {
      recommended_date: null,
      status: "upcoming",
      days_since_last_visit: null,
      last_completed_at: null,
      last_service_name: null,
      avg_visit_frequency_weeks: null,
      window_weeks: null,
      reasoning: null,
    };
  }

  // Ignore consultation-only appointments for timing recommendations.
  // This preserves retention value even when clients book "consultations" as an intake step.
  const maintenanceCompleted = completed.filter((a) => {
    if (!a.service_id) return false;
    const svc = serviceById.get(a.service_id) ?? null;
    const name = (svc?.name ?? "").toLowerCase();
    if (!name) return false;
    return !name.includes("consult");
  });

  const lastMaintenance = maintenanceCompleted[0] ?? null;
  const lastMaintenanceAt = lastMaintenance ? new Date(lastMaintenance.start_at) : null;
  const lastMaintenanceService = lastMaintenance?.service_id
    ? serviceById.get(lastMaintenance.service_id) ?? null
    : null;
  const lastMaintenanceServiceName = lastMaintenanceService?.name ?? null;

  const todayStart = startOfLocalDay(today);

  // For display: use the most recent completed appointment even if it's a consultation.
  const lastOverall = completed[0];
  const lastOverallAt = lastOverall ? new Date(lastOverall.start_at) : null;
  const lastOverallService =
    lastOverall?.service_id ? serviceById.get(lastOverall.service_id) ?? null : null;
  const lastOverallServiceName = lastOverallService?.name ?? null;

  // Still compute days-since based on the most recent maintenance visit (not consult).
  // If maintenance doesn't exist, fall back to the most recent completed appointment.
  const daysAnchorAt = lastMaintenanceAt ?? lastOverallAt;
  const daysAnchorStart = daysAnchorAt ? startOfLocalDay(daysAnchorAt) : null;
  const daysSince =
    daysAnchorStart != null
      ? Math.max(0, Math.floor((todayStart.getTime() - daysAnchorStart.getTime()) / MS_PER_DAY))
      : null;

  if (!lastMaintenanceAt) {
    // Only consults (or no identifiable non-consult service names) => no maintenance recommendation,
    // but still provide last_completed_* for UI clarity.
    return {
      recommended_date: null,
      status: "upcoming",
      days_since_last_visit: daysSince,
      last_completed_at: lastOverallAt,
      last_service_name: lastOverallServiceName,
      avg_visit_frequency_weeks: null,
      window_weeks: null,
      reasoning: "Consultation-only history; waiting on a maintenance visit.",
    };
  }

  const lastStart = startOfLocalDay(lastMaintenanceAt);

  const windowWeeks = getRebookingWindowWeeks(lastMaintenanceServiceName);
  if (windowWeeks.maxWeeks <= 0) {
    return {
      recommended_date: null,
      status: "upcoming",
      days_since_last_visit: daysSince,
      last_completed_at: lastMaintenanceAt,
      last_service_name: lastMaintenanceServiceName,
      avg_visit_frequency_weeks: null,
      window_weeks: windowWeeks,
      reasoning: "Service is consultation-only; no rebooking window available.",
    };
  }

  // Compute cadence from the client's real visit spacing (maintenance-only).
  // This makes recommendations feel personalized vs a fixed service window.
  const maintenanceSortedAsc = [...maintenanceCompleted].sort((a, b) =>
    a.start_at < b.start_at ? -1 : 1,
  );
  const deltasWeeks: number[] = [];
  // Use up to the last 6 deltas (7 visits) to reduce noise.
  const capped = maintenanceSortedAsc.slice(-8);
  for (let i = 1; i < capped.length; i++) {
    const prev = new Date(capped[i - 1].start_at);
    const cur = new Date(capped[i].start_at);
    const deltaDays = (cur.getTime() - prev.getTime()) / MS_PER_DAY;
    if (deltaDays > 0) deltasWeeks.push(deltaDays / 7);
  }

  const avgVisitFrequencyWeeks =
    deltasWeeks.length > 0
      ? Math.round(
          (deltasWeeks.reduce((a, b) => a + b, 0) / deltasWeeks.length) * 10,
        ) / 10
      : null;

  const baseWeeksFromCadence =
    avgVisitFrequencyWeeks != null
      ? Math.min(Math.max(avgVisitFrequencyWeeks, windowWeeks.minWeeks), windowWeeks.maxWeeks)
      : windowWeeks.maxWeeks;

  const noShowCount = clientRisk?.noShowCount ?? 0;
  const depositRequired = clientRisk?.depositRequired ?? false;
  const bookingRestricted = clientRisk?.bookingRestricted ?? false;

  let recommendedWeeks = baseWeeksFromCadence;
  let riskAdjusted = false;

  // Riskier clients should be nudged earlier (more aggressive window end),
  // which improves retention vs generic "maxWeeks" rules.
  if (bookingRestricted || noShowCount >= 3) {
    recommendedWeeks = windowWeeks.minWeeks;
    riskAdjusted = true;
  } else if (depositRequired || noShowCount >= 2) {
    // Bias earlier but don't always jump to the absolute minimum.
    recommendedWeeks = Math.max(windowWeeks.minWeeks, Math.min(recommendedWeeks, windowWeeks.minWeeks + 1));
    if (recommendedWeeks !== baseWeeksFromCadence) riskAdjusted = true;
  }

  const recommendedDate = addWeeks(lastMaintenanceAt, recommendedWeeks);
  const recStart = startOfLocalDay(recommendedDate);

  let status: RebookingStatus;
  if (recStart.getTime() < todayStart.getTime()) status = "overdue";
  else {
    const dueEnd = startOfLocalDay(addDays(todayStart, dueSoonDays));
    status = recStart.getTime() <= dueEnd.getTime() ? "due" : "upcoming";
  }

  const reasoningParts: string[] = [];
  if (avgVisitFrequencyWeeks != null) {
    reasoningParts.push(`Personalized cadence ~${avgVisitFrequencyWeeks}w avg`);
  } else {
    reasoningParts.push(`Based on ${lastMaintenanceServiceName ?? "service"} window`);
  }
  reasoningParts.push(`${windowWeeks.minWeeks}-${windowWeeks.maxWeeks}w window`);
  if (riskAdjusted) reasoningParts.push("Earlier nudge due to booking risk");

  const reasoning = reasoningParts.join(" · ");

  return {
    recommended_date: recommendedDate,
    status,
    days_since_last_visit: daysSince,
    last_completed_at: lastMaintenanceAt,
    last_service_name: lastMaintenanceServiceName,

    avg_visit_frequency_weeks: avgVisitFrequencyWeeks,
    window_weeks: windowWeeks,
    reasoning,
  };
}

