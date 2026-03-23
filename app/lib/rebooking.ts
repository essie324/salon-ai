/**
 * Client list / lightweight rebooking helpers.
 * Interval rules are defined in `rebooking/engine.ts`.
 */
import { getRecommendedIntervalWeeksForServiceName } from "@/app/lib/rebooking/engine";

export {
  computeClientRebookingDecision,
  getRecommendedIntervalWeeksForServiceName,
} from "@/app/lib/rebooking/engine";
export {
  buildRebookingNewAppointmentHref,
  newAppointmentHrefFromRebookingContext,
  prefillAppointmentDateFromRecommendation,
  rebookingTimingHint,
  parseLocalDateISO,
} from "@/app/lib/rebooking/bookingQuery";

/** @deprecated Use getRecommendedIntervalWeeksForServiceName */
export function getRecommendedWeeksForServiceName(
  name: string | null | undefined,
): number {
  return getRecommendedIntervalWeeksForServiceName(name);
}

export type RebookingInfo = {
  lastCompletedAt: Date | null;
  lastServiceName: string | null;
  recommendedDate: Date | null;
  overdue: boolean;
};

/**
 * Most recent completed appointment only; same interval as engine (no status flags).
 */
export function computeRebookingInfo(options: {
  appointments: { start_at: string; status: string; service_id: string | null }[];
  serviceById: Map<string, { name: string | null }>;
  today?: Date;
}): RebookingInfo {
  const { appointments, serviceById, today = new Date() } = options;

  const completed = appointments
    .filter((a) => a.status === "completed" && a.start_at)
    .sort((a, b) => (a.start_at < b.start_at ? 1 : -1));

  if (completed.length === 0) {
    return {
      lastCompletedAt: null,
      lastServiceName: null,
      recommendedDate: null,
      overdue: false,
    };
  }

  const last = completed[0];
  const lastDate = new Date(last.start_at);
  const service = last.service_id ? serviceById.get(last.service_id) ?? null : null;
  const lastServiceName = service?.name ?? null;

  const weeks = getRecommendedIntervalWeeksForServiceName(lastServiceName);
  if (weeks <= 0) {
    return {
      lastCompletedAt: lastDate,
      lastServiceName,
      recommendedDate: null,
      overdue: false,
    };
  }

  const recommendedDate = addWeeks(lastDate, weeks);
  const overdue = startOfDay(recommendedDate) < startOfDay(today);

  return {
    lastCompletedAt: lastDate,
    lastServiceName,
    recommendedDate,
    overdue,
  };
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}
