/**
 * Stable query params for "rebook" → new appointment flow.
 *
 * Params (aligned with app/dashboard/appointments/new/page.tsx):
 * - rebook=1 — show rebooking context panel
 * - clientId — client UUID
 * - date — YYYY-MM-DD (appointment date; bumped forward if recommendation is in the past)
 * - serviceId — optional; preselect if still in catalog
 * - stylistId — optional preferred stylist; preselect if active
 */
import { localDateISO } from "@/app/lib/dashboard/dateRanges";

/** Parse YYYY-MM-DD as local calendar date (no UTC shift). */
export function parseLocalDateISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

/**
 * If the recommended visit date is before today (local), use today so the date input stays valid.
 */
export function prefillAppointmentDateFromRecommendation(
  recommendedNextVisit: Date,
  today: Date = new Date(),
): string {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const r0 = new Date(
    recommendedNextVisit.getFullYear(),
    recommendedNextVisit.getMonth(),
    recommendedNextVisit.getDate(),
  );
  const use = r0.getTime() < t0.getTime() ? t0 : r0;
  return localDateISO(use);
}

export function buildRebookingNewAppointmentHref(args: {
  clientId: string;
  /** Appointment date for the form (typically from prefillAppointmentDateFromRecommendation). */
  appointmentDateISO: string;
  lastServiceId?: string | null;
  preferredStylistId?: string | null;
}): string {
  const q = new URLSearchParams();
  q.set("rebook", "1");
  q.set("clientId", args.clientId);
  q.set("date", args.appointmentDateISO);
  if (args.lastServiceId) q.set("serviceId", args.lastServiceId);
  if (args.preferredStylistId) q.set("stylistId", args.preferredStylistId);
  return `/dashboard/appointments/new?${q.toString()}`;
}

/**
 * Primary entry for dashboard + client profile CTAs.
 */
export function newAppointmentHrefFromRebookingContext(args: {
  clientId: string;
  recommendedNextVisitISO: string | null;
  lastServiceId?: string | null;
  preferredStylistId?: string | null;
  today?: Date;
}): string {
  const { clientId, recommendedNextVisitISO, lastServiceId, preferredStylistId } = args;
  const today = args.today ?? new Date();

  if (!recommendedNextVisitISO?.trim()) {
    const q = new URLSearchParams();
    q.set("clientId", clientId);
    if (preferredStylistId) q.set("stylistId", preferredStylistId);
    const qs = q.toString();
    return `/dashboard/appointments/new?${qs}`;
  }

  const rec = parseLocalDateISO(recommendedNextVisitISO.trim());
  const appointmentDateISO = prefillAppointmentDateFromRecommendation(rec, today);

  return buildRebookingNewAppointmentHref({
    clientId,
    appointmentDateISO,
    lastServiceId,
    preferredStylistId,
  });
}

/** Secondary line for dashboard list: timing hint. */
export function rebookingTimingHint(args: {
  status: "due_soon" | "overdue";
  daysUntilOrOverdue: number;
  recommendedNextISO: string;
  weekStartISO: string;
  weekEndISO: string;
}): string | null {
  const { status, daysUntilOrOverdue, recommendedNextISO, weekStartISO, weekEndISO } = args;

  if (status === "overdue" && daysUntilOrOverdue < 0) {
    const n = Math.abs(daysUntilOrOverdue);
    return `Overdue by ${n} day${n === 1 ? "" : "s"}`;
  }

  if (
    recommendedNextISO >= weekStartISO &&
    recommendedNextISO <= weekEndISO
  ) {
    return "Suggested for this week";
  }

  if (status === "due_soon" && daysUntilOrOverdue >= 0) {
    return `Due in ${daysUntilOrOverdue} day${daysUntilOrOverdue === 1 ? "" : "s"}`;
  }

  return null;
}
