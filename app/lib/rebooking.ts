/**
 * Simple service-based rebooking rules (first implementation).
 * Uses service name matching, case-insensitive.
 */
export function getRecommendedWeeksForServiceName(name: string | null | undefined): number {
  if (!name) return 6;
  const lower = name.toLowerCase();

  if (lower.includes("consultation")) return 0; // no recommendation

  // Haircut
  if (lower.includes("cut") || lower.includes("trim")) return 6;

  // Blonding / highlights
  if (
    lower.includes("blond") ||
    lower.includes("highlight") ||
    lower.includes("balayage") ||
    lower.includes("foil")
  ) {
    return 8;
  }

  // Root touch-up / color maintenance
  if (
    lower.includes("root") ||
    lower.includes("touch") ||
    lower.includes("regrowth") ||
    lower.includes("toner") ||
    lower.includes("gloss")
  ) {
    return 6;
  }

  // Extensions maintenance
  if (
    lower.includes("extension") ||
    lower.includes("move-up") ||
    lower.includes("move up") ||
    lower.includes("maintenance")
  ) {
    return 6;
  }

  // Default
  return 6;
}

export type RebookingInfo = {
  lastCompletedAt: Date | null;
  lastServiceName: string | null;
  recommendedDate: Date | null;
  overdue: boolean;
};

/**
 * Given a client's appointments and the service lookup, returns rebooking info
 * based **only** on the most recent completed appointment.
 */
export function computeRebookingInfo(options: {
  appointments: { start_at: string; status: string; service_id: string | null }[];
  serviceById: Map<string, { name: string | null }>;
  today?: Date;
}): RebookingInfo {
  const { appointments, serviceById, today = new Date() } = options;

  const completed = appointments
    .filter((a) => a.status === "completed" && a.start_at)
    .sort((a, b) => (a.start_at < b.start_at ? 1 : -1)); // newest first

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

  const weeks = getRecommendedWeeksForServiceName(lastServiceName);
  if (weeks <= 0) {
    return {
      lastCompletedAt: lastDate,
      lastServiceName,
      recommendedDate: null,
      overdue: false,
    };
  }

  const recommendedDate = addWeeks(lastDate, weeks);
  const overdue = recommendedDate < startOfDay(today);

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

