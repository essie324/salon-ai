/**
 * Retention / rebooking nudges (BUILD_GUIDELINES: simple, extendable rules).
 * Uses only completed appointments; recommends next visit from the most recent completed service name.
 *
 * Interval rules (fixed weeks from last completed visit):
 * - Blonding / highlights / balayage / foil: 8 weeks
 * - Root touch-up, regrowth, toner, gloss: 6 weeks
 * - Extensions / move-up: 6 weeks
 * - Haircut / trim / cut: 6 weeks
 * - General color maintenance: 6 weeks
 * - Fallback: 6 weeks
 * - Consultation: no automated recommendation (interval 0)
 */

export type RebookingNudgeStatus = "not_due" | "due_soon" | "overdue";

/** @deprecated Use RebookingNudgeStatus */
export type RebookingStatus = RebookingNudgeStatus;

export type ClientRebookingDecision = {
  last_completed_date: Date | null;
  /** Service UUID from the most recent completed appointment, when present. */
  last_completed_service_id: string | null;
  last_completed_service: string | null;
  recommended_next_visit_date: Date | null;
  rebooking_status: RebookingNudgeStatus;
  /** Days from today (local) to recommended date; negative = overdue. Null if no recommendation. */
  days_until_or_overdue: number | null;
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

function addWeeks(date: Date, weeks: number): Date {
  const out = new Date(date.getTime());
  out.setDate(out.getDate() + weeks * 7);
  return out;
}

/**
 * Fixed week intervals by service name (case-insensitive). Order: most specific first.
 */
export function getRecommendedIntervalWeeksForServiceName(
  name: string | null | undefined,
): number {
  const lower = (name ?? "").toLowerCase();

  if (lower.includes("consult")) return 0;

  if (
    lower.includes("blond") ||
    lower.includes("highlight") ||
    lower.includes("balayage") ||
    lower.includes("foil")
  ) {
    return 8;
  }

  if (
    lower.includes("root") ||
    lower.includes("regrowth") ||
    lower.includes("touch-up") ||
    lower.includes("touch up") ||
    lower.includes("toner") ||
    lower.includes("gloss")
  ) {
    return 6;
  }

  if (
    lower.includes("extension") ||
    lower.includes("move-up") ||
    lower.includes("move up")
  ) {
    return 6;
  }

  if (lower.includes("haircut") || lower.includes("trim") || lower.includes("cut")) {
    return 6;
  }

  if (
    lower.includes("color") ||
    lower.includes("colour") ||
    lower.includes("gray") ||
    lower.includes("grey")
  ) {
    return 6;
  }

  return 6;
}

/**
 * Most recent completed appointment only; recommendation = last visit + interval weeks.
 */
export function computeClientRebookingDecision(options: {
  appointments: AppointmentLike[];
  serviceById: Map<string, ServiceLike>;
  today?: Date;
  /** Recommended date in this window (inclusive from today) => due_soon */
  dueSoonDays?: number;
}): ClientRebookingDecision {
  const { appointments, serviceById, today = new Date(), dueSoonDays = 14 } = options;

  const completed = appointments
    .filter((a) => a.status === "completed" && a.start_at)
    .sort((a, b) => (a.start_at < b.start_at ? 1 : -1));

  if (completed.length === 0) {
    return {
      last_completed_date: null,
      last_completed_service_id: null,
      last_completed_service: null,
      recommended_next_visit_date: null,
      rebooking_status: "not_due",
      days_until_or_overdue: null,
    };
  }

  const last = completed[0];
  const lastCompletedDate = new Date(last.start_at);
  const svc = last.service_id ? serviceById.get(last.service_id) ?? null : null;
  const lastServiceName = svc?.name ?? null;

  const weeks = getRecommendedIntervalWeeksForServiceName(lastServiceName);
  const todayStart = startOfLocalDay(today);

  if (weeks <= 0) {
    return {
      last_completed_date: lastCompletedDate,
      last_completed_service_id: last.service_id ?? null,
      last_completed_service: lastServiceName,
      recommended_next_visit_date: null,
      rebooking_status: "not_due",
      days_until_or_overdue: null,
    };
  }

  const recommended = addWeeks(startOfLocalDay(lastCompletedDate), weeks);
  const recDay = startOfLocalDay(recommended);

  const diffDays = Math.round(
    (recDay.getTime() - todayStart.getTime()) / MS_PER_DAY,
  );

  let rebooking_status: RebookingNudgeStatus;
  if (diffDays < 0) {
    rebooking_status = "overdue";
  } else if (diffDays <= dueSoonDays) {
    rebooking_status = "due_soon";
  } else {
    rebooking_status = "not_due";
  }

  return {
    last_completed_date: lastCompletedDate,
    last_completed_service_id: last.service_id ?? null,
    last_completed_service: lastServiceName,
    recommended_next_visit_date: recommended,
    rebooking_status,
    days_until_or_overdue: diffDays,
  };
}
