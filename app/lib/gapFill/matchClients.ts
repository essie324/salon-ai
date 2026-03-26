/**
 * Best-fit client for an open gap using retention + stylist preference + service fit.
 * Keeps ranking explicit and lightweight — no ML.
 */

export type GapFillRetentionClient = {
  id: string;
  name: string;
  lastServiceName: string | null;
  lastServiceId: string | null;
  preferredStylistId: string | null;
  status: "due_soon" | "overdue";
  /** Tie-breaker: recent visit memory on file */
  hasVisitMemory: boolean;
};

type ServiceRow = {
  id: string;
  name: string | null;
  duration_minutes: number | null;
};

export type GapMatchPick = {
  client: GapFillRetentionClient;
  service: { id: string; name: string; durationMinutes: number };
  reasonLabel: string;
};

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase();
}

function serviceFitsGap(service: ServiceRow, gapMinutes: number): boolean {
  const dur = service.duration_minutes ?? 60;
  return dur > 0 && dur <= gapMinutes;
}

/** Longest service that still fits the gap (same strategy as scheduling optimizer). */
export function pickLongestServiceForGap(services: ServiceRow[], gapMinutes: number): ServiceRow | null {
  const candidates = services.filter((s) => serviceFitsGap(s, gapMinutes));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.duration_minutes ?? 60) - (a.duration_minutes ?? 60));
  return candidates[0];
}

export function clientMatchesLastServiceName(client: GapFillRetentionClient, service: ServiceRow | null): boolean {
  if (!service) return false;
  const a = normalize(client.lastServiceName);
  const b = normalize(service.name);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function preferredStylistMatches(client: GapFillRetentionClient, gapStylistId: string): boolean {
  return Boolean(client.preferredStylistId && client.preferredStylistId === gapStylistId);
}

/**
 * Human-readable reason for the chosen row (stable labels for dashboard copy).
 */
export function buildGapMatchReasonLabel(
  client: GapFillRetentionClient,
  gapStylistId: string,
  service: ServiceRow,
  nameMatch: boolean,
): string {
  const pref = preferredStylistMatches(client, gapStylistId);

  if (client.status === "overdue") {
    if (pref && nameMatch) return "Overdue with preferred stylist";
    if (pref) return "Overdue with preferred stylist";
    if (nameMatch) return "Overdue — service fits this slot";
    return "Overdue — good match for this slot";
  }

  if (pref && nameMatch) return "Due soon with preferred stylist";
  if (pref) return "Due soon with preferred stylist";
  if (nameMatch) return "Due soon and fits this slot";
  return "Soonest good match";
}

type Scored = {
  client: GapFillRetentionClient;
  statusRank: number;
  stylistRank: number;
  serviceMatchRank: number;
  memoryRank: number;
};

/**
 * Ranking order (lower = better):
 * 1. Overdue before due-soon
 * 2. Preferred stylist matches gap stylist
 * 3. Last service name aligns with chosen service (duration already fits)
 * 4. Visit memory on file
 * 5. Name (stable tie-break)
 */
export function pickBestClientForGap(options: {
  gapMinutes: number;
  stylistId: string;
  services: ServiceRow[];
  candidates: GapFillRetentionClient[];
}): GapMatchPick | null {
  const { gapMinutes, stylistId, services, candidates } = options;
  if (candidates.length === 0) return null;

  const service = pickLongestServiceForGap(services, gapMinutes);
  if (!service) return null;

  const scored: Scored[] = candidates.map((client) => {
    const nameMatch = clientMatchesLastServiceName(client, service);
    return {
      client,
      statusRank: client.status === "overdue" ? 0 : 1,
      stylistRank: preferredStylistMatches(client, stylistId) ? 0 : 1,
      serviceMatchRank: nameMatch ? 0 : 1,
      memoryRank: client.hasVisitMemory ? 0 : 1,
    };
  });

  scored.sort((a, b) => {
    if (a.statusRank !== b.statusRank) return a.statusRank - b.statusRank;
    if (a.stylistRank !== b.stylistRank) return a.stylistRank - b.stylistRank;
    if (a.serviceMatchRank !== b.serviceMatchRank) return a.serviceMatchRank - b.serviceMatchRank;
    if (a.memoryRank !== b.memoryRank) return a.memoryRank - b.memoryRank;
    return a.client.name.localeCompare(b.client.name);
  });

  const best = scored[0];
  const nameMatch = clientMatchesLastServiceName(best.client, service);
  const reasonLabel = buildGapMatchReasonLabel(best.client, stylistId, service, nameMatch);

  return {
    client: best.client,
    service: {
      id: service.id,
      name: service.name ?? "Service",
      durationMinutes: service.duration_minutes ?? 60,
    },
    reasonLabel,
  };
}
