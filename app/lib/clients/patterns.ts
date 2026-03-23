export type ClientAppointmentLike = {
  start_at: string;
  status: string;
  service_id: string | null;
  stylist_id: string | null;
};

export type ServiceLike = {
  id: string;
  name: string | null;
};

export type StylistLike = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export type ClientBehaviorPatterns = {
  avgVisitFrequencyWeeks: number | null;
  mostCommonServiceName: string | null;
  preferredServiceKeyword: string | null;
  preferredStylistName: string | null;
  riskLabel: "High reliability" | "Risk client";
  noShowCount: number;
  cancellationCount: number;
};

function startAtToDate(start_at: string): Date | null {
  if (!start_at) return null;
  const d = new Date(start_at);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fullName(first: string | null, last: string | null): string {
  return `${first ?? ""} ${last ?? ""}`.trim();
}

function serviceKeyword(serviceName: string | null): string | null {
  const s = (serviceName ?? "").toLowerCase().trim();
  if (!s) return null;

  if (s.includes("balayage")) return "balayage";
  if (s.includes("blond") || s.includes("highlight") || s.includes("foil")) return "highlights/blonding";
  if (s.includes("extension") || s.includes("move-up") || s.includes("move up")) return "extensions";
  if (s.includes("cut") || s.includes("haircut") || s.includes("trim")) return "haircuts";
  if (s.includes("color") || s.includes("toner") || s.includes("root") || s.includes("gloss") || s.includes("touch")) return "color";

  // Fallback: first chunk of the service name
  return s.split(/[,:]/)[0]?.trim() || serviceName;
}

/**
 * Rule-based client behavior patterns (no external AI).
 * - Frequency: average spacing between completed visits
 * - Most common service/stylist: among completed visits
 * - Risk: based on no-show/cancel counts (recent window + total tendencies)
 */
export function computeClientBehaviorPatterns(options: {
  appointments: ClientAppointmentLike[];
  serviceById: Map<string, ServiceLike | { name: string | null }>;
  stylistById: Map<string, StylistLike | { first_name?: string | null; last_name?: string | null }>;
  recentWindowCount?: number; // how many most recent appointments to consider for risk
  completedWindowMax?: number; // cap completed visits used for frequency
}): ClientBehaviorPatterns {
  const {
    appointments,
    serviceById,
    stylistById,
    recentWindowCount = 12,
    completedWindowMax = 10,
  } = options;

  const completed = appointments
    .filter((a) => a.status === "completed")
    .map((a) => ({ ...a, date: startAtToDate(a.start_at) }))
    .filter((a) => a.date != null) as (ClientAppointmentLike & { date: Date })[];

  completed.sort((a, b) => a.date!.getTime() - b.date!.getTime());
  const completedCapped = completed.slice(-completedWindowMax);

  // Avg visit frequency (weeks) from completed visit spacing
  let avgVisitFrequencyWeeks: number | null = null;
  if (completedCapped.length >= 2) {
    const deltasWeeks: number[] = [];
    for (let i = 1; i < completedCapped.length; i++) {
      const prev = completedCapped[i - 1].date!;
      const cur = completedCapped[i].date!;
      const deltaDays = (cur.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);
      if (deltaDays > 0) deltasWeeks.push(deltaDays / 7);
    }
    if (deltasWeeks.length > 0) {
      const avg = deltasWeeks.reduce((a, b) => a + b, 0) / deltasWeeks.length;
      // Present-friendly rounding
      avgVisitFrequencyWeeks = Math.round(avg * 10) / 10;
    }
  }

  // Most common service (completed only)
  const serviceCounts = new Map<string, number>();
  for (const a of completedCapped) {
    if (!a.service_id) continue;
    serviceCounts.set(a.service_id, (serviceCounts.get(a.service_id) ?? 0) + 1);
  }
  let mostCommonServiceName: string | null = null;
  let mostCommonServiceId: string | null = null;
  for (const [sid, count] of serviceCounts.entries()) {
    if (!mostCommonServiceId || count > (serviceCounts.get(mostCommonServiceId) ?? 0)) {
      mostCommonServiceId = sid;
    }
  }
  if (mostCommonServiceId) {
    const svc = serviceById.get(mostCommonServiceId) ?? null;
    mostCommonServiceName = (svc as any)?.name ?? null;
  }

  // Preferred stylist (completed only)
  const stylistCounts = new Map<string, number>();
  for (const a of completedCapped) {
    if (!a.stylist_id) continue;
    stylistCounts.set(a.stylist_id, (stylistCounts.get(a.stylist_id) ?? 0) + 1);
  }

  let preferredStylistName: string | null = null;
  if (stylistCounts.size > 0) {
    let bestStylistId: string | null = null;
    let bestCount = -1;
    for (const [stid, count] of stylistCounts.entries()) {
      if (count > bestCount) {
        bestCount = count;
        bestStylistId = stid;
      }
    }
    if (bestStylistId) {
      const st = stylistById.get(bestStylistId) ?? null;
      if (st) {
        const first = (st as any).first_name ?? null;
        const last = (st as any).last_name ?? null;
        preferredStylistName = fullName(first, last) || null;
      }
    }
  }

  // Risk label: based on no-show/cancel tendencies in a recent window
  const recent = [...appointments].sort((a, b) => (a.start_at < b.start_at ? 1 : -1)).slice(0, recentWindowCount);
  const noShowCount = recent.filter((a) => a.status === "no_show").length;
  const cancellationCount = recent.filter((a) => a.status === "cancelled").length;

  // Simple scoring: no-show is worse than cancel
  const riskScore = noShowCount * 3 + cancellationCount * 1;
  const riskLabel: "High reliability" | "Risk client" = riskScore >= 4 ? "Risk client" : "High reliability";

  return {
    avgVisitFrequencyWeeks,
    mostCommonServiceName,
    preferredServiceKeyword: serviceKeyword(mostCommonServiceName),
    preferredStylistName,
    riskLabel,
    noShowCount,
    cancellationCount,
  };
}

