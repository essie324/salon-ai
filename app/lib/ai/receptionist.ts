import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeIntake, type RawIntakeInput } from "@/app/lib/intake/normalizeIntake";
import { determineConsultationRouting } from "@/app/lib/booking/consultationRouting";
import { getServiceDuration } from "@/app/lib/booking/duration";
import { getAvailableSlots } from "@/app/lib/booking/suggestions";
import { isStylistEligibleForService } from "@/app/lib/stylistServiceEligibility";

export type ReceptionistDecisionInput = RawIntakeInput & {
  client_id?: string | null;
  /**
   * Optional hint for how many slots to return.
   * Default: 5
   */
  maxSlots?: number;
};

export type ReceptionistDecision = {
  recommended_service_id: string | null;
  recommended_stylist_id: string | null;
  recommended_time_slots: {
    date: string; // YYYY-MM-DD (local)
    time: string; // HH:MM (local)
    end_time?: string; // HH:MM (local)
    stylist_id?: string;
    reason?: string;
  }[];
  flags: {
    needs_consultation: boolean;
    pricing_uncertain: boolean;
    requires_manual_review: boolean;
  };
  confidence_score: number; // 0..1
  reasoning: string;
  debug?: {
    matchedService?: string | null;
    matchedStylist?: string | null;
    detectedKeywords?: string[];
  };
};

type ServiceRow = { id: string; name: string | null; duration_minutes?: number | null; price_cents?: number | null };
type StylistRow = { id: string; first_name: string | null; last_name: string | null; is_active?: boolean | null };

function isVagueRequest(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  const vaguePhrases = [
    "not sure",
    "whatever",
    "something",
    "help me",
    "recommend",
    "i don't know",
    "idk",
    "fix my hair",
    "make it look better",
    "new look",
  ];
  return vaguePhrases.some((p) => t.includes(p)) || t.length < 8;
}

function hasBudgetConstraint(text: string): boolean {
  const t = text.toLowerCase();
  // Very simple: any $ amount or "budget" language
  return /\$\s*\d+/.test(t) || t.includes("budget") || t.includes("under ") || t.includes("max ");
}

function fullStylistName(s: StylistRow): string {
  return `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function scoreServiceMatch(serviceName: string, intakeText: string): { score: number; keywords: string[] } {
  const s = serviceName.toLowerCase();
  const t = intakeText.toLowerCase();
  const keywords: string[] = [];
  let score = 0;

  // Direct contains
  if (t.includes(s)) {
    score += 10;
    keywords.push(serviceName);
  }

  // Token overlap
  const serviceTokens = new Set(tokenize(s));
  const intakeTokens = new Set(tokenize(t));
  let overlap = 0;
  for (const tok of serviceTokens) {
    if (tok.length <= 2) continue;
    if (intakeTokens.has(tok)) overlap += 1;
  }
  score += overlap * 2;
  if (overlap > 0) keywords.push(...Array.from(serviceTokens).filter((k) => intakeTokens.has(k)));

  // Keyword boosts (common salon terms)
  const boosts: Array<[string, string[]]> = [
    ["blond", ["blonde", "blonding", "highlight", "highlights", "balayage", "foil"]],
    ["color", ["color", "toner", "gloss", "root", "touchup", "touch-up", "grey", "gray", "retouch"]],
    ["cut", ["cut", "haircut", "trim", "bang", "fringe"]],
    ["extension", ["extension", "extensions"]],
    ["consult", ["consult", "consultation"]],
  ];
  for (const [tag, words] of boosts) {
    if (s.includes(tag) && words.some((w) => t.includes(w))) score += 3;
  }

  return { score, keywords: Array.from(new Set(keywords)).slice(0, 8) };
}

function findBestService(services: ServiceRow[], intakeText: string): { id: string; name: string | null; keywords: string[] } | null {
  let best: { row: ServiceRow; score: number; keywords: string[] } | null = null;
  for (const svc of services) {
    const name = (svc.name ?? "").trim();
    if (!name) continue;
    const { score, keywords } = scoreServiceMatch(name, intakeText);
    if (!best || score > best.score) best = { row: svc, score, keywords };
  }
  if (!best || best.score < 3) return null;
  return { id: best.row.id, name: best.row.name ?? null, keywords: best.keywords };
}

function findRequestedStylist(stylists: StylistRow[], requested: string): { id: string; name: string } | null {
  const r = requested.trim().toLowerCase();
  if (!r) return null;
  // Exact/contains match on name parts
  for (const s of stylists) {
    const name = fullStylistName(s);
    const n = name.toLowerCase();
    if (!name) continue;
    if (n === r || n.includes(r) || r.includes(n)) return { id: s.id, name };
  }
  // Token match (first or last name)
  const tokens = tokenize(r);
  for (const s of stylists) {
    const n = fullStylistName(s).toLowerCase();
    if (!n) continue;
    if (tokens.some((tok) => tok.length > 2 && n.includes(tok))) return { id: s.id, name: fullStylistName(s) };
  }
  return null;
}

function defaultTimeSlots(max: number): { date: string; time: string; reason?: string }[] {
  // Minimal placeholder: next few business-ish slots, local date/time strings.
  // This is intentionally simple; later we can swap to real availability + slot search.
  const now = new Date();
  const slots: { date: string; time: string; reason?: string }[] = [];
  const candidateTimes = ["09:00", "11:00", "13:00", "15:00", "17:00"];
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  while (slots.length < max) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day === 0) continue; // skip Sunday
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    for (const time of candidateTimes) {
      slots.push({ date, time, reason: "default_window" });
      if (slots.length >= max) break;
    }
  }
  return slots.slice(0, max);
}

function localDateISOFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localTimeHHMMFromISO(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildTimingPreference(options: { timingPreferenceText: string }): {
  preferredStartHHMM?: string;
  preferredEndHHMM?: string;
  dateStartOffsetDays: number;
  dateEndOffsetDays: number;
} {
  const t = options.timingPreferenceText.toLowerCase();

  const out = {
    dateStartOffsetDays: 0,
    dateEndOffsetDays: 7,
    preferredStartHHMM: undefined as string | undefined,
    preferredEndHHMM: undefined as string | undefined,
  };

  if (t.includes("tomorrow")) out.dateStartOffsetDays = 1;
  if (t.includes("today")) out.dateStartOffsetDays = 0;

  const nextDaysMatch = t.match(/next\s*(\d{1,2})\s*days?/i);
  if (nextDaysMatch) {
    out.dateEndOffsetDays = Math.max(out.dateEndOffsetDays, Number(nextDaysMatch[1]));
  }

  const nextWeeksMatch = t.match(/next\s*(\d{1,2})\s*weeks?/i);
  if (nextWeeksMatch) {
    out.dateEndOffsetDays = Math.max(out.dateEndOffsetDays, Number(nextWeeksMatch[1]) * 7);
  }

  // Time windows
  if (t.includes("morning")) {
    out.preferredStartHHMM = "08:00";
    out.preferredEndHHMM = "12:00";
  } else if (t.includes("afternoon")) {
    out.preferredStartHHMM = "12:00";
    out.preferredEndHHMM = "17:00";
  } else if (t.includes("evening")) {
    out.preferredStartHHMM = "17:00";
    out.preferredEndHHMM = "20:00";
  } else {
    // before/after
    const beforeMatch = t.match(/before\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (beforeMatch) {
      const hour = Number(beforeMatch[1]);
      const minute = beforeMatch[2] ? Number(beforeMatch[2]) : 0;
      const ampm = beforeMatch[3]?.toLowerCase();
      const hh = !ampm
        ? hour
        : ampm === "pm" && hour < 12
          ? hour + 12
          : ampm === "am" && hour === 12
            ? 0
            : hour;
      out.preferredEndHHMM = `${String(hh).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
    const afterMatch = t.match(/after\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (afterMatch) {
      const hour = Number(afterMatch[1]);
      const minute = afterMatch[2] ? Number(afterMatch[2]) : 0;
      const ampm = afterMatch[3]?.toLowerCase();
      const hh = !ampm
        ? hour
        : ampm === "pm" && hour < 12
          ? hour + 12
          : ampm === "am" && hour === 12
            ? 0
            : hour;
      out.preferredStartHHMM = `${String(hh).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  return out;
}

function timeHHMMToMinutes(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function scoreTimeWindow(hhmm: string, pref?: { preferredStartHHMM?: string; preferredEndHHMM?: string }): number {
  const startMin = pref?.preferredStartHHMM ? timeHHMMToMinutes(pref.preferredStartHHMM) : null;
  const endMin = pref?.preferredEndHHMM ? timeHHMMToMinutes(pref.preferredEndHHMM) : null;
  const curMin = timeHHMMToMinutes(hhmm);
  if (curMin == null) return 0;
  if (startMin != null && curMin < startMin) return -5;
  if (endMin != null && curMin >= endMin) return -5;
  if (startMin != null || endMin != null) return 15; // inside preferred window
  return 0;
}

function makeReasoning(options: {
  serviceName: string | null;
  requestedStylistName?: string | null;
  chosenStylistName?: string | null;
  flagged: string[];
  timeWindowText: string;
}): string {
  const parts: string[] = [];
  if (options.serviceName) parts.push(`Inferred service: ${options.serviceName}`);
  if (options.requestedStylistName) parts.push(`Requested stylist: ${options.requestedStylistName}`);
  if (options.chosenStylistName) parts.push(`Chosen stylist: ${options.chosenStylistName}`);
  if (options.timeWindowText) parts.push(`Timing: ${options.timeWindowText}`);
  if (options.flagged.length > 0) parts.push(`Flags: ${options.flagged.join(", ")}`);
  const s = parts.join(" · ");
  return s.length > 180 ? s.slice(0, 177) + "..." : s;
}

export async function decideReceptionistAction(options: {
  supabase: SupabaseClient;
  input: ReceptionistDecisionInput;
}): Promise<ReceptionistDecision> {
  const { supabase, input } = options;
  const normalized = normalizeIntake(input);
  const maxSlots = input.maxSlots ?? 5;

  const [{ data: services }, { data: stylists }] = await Promise.all([
    supabase.from("services").select("id, name, duration_minutes, price_cents").order("name", { ascending: true }),
    supabase.from("stylists").select("id, first_name, last_name, is_active").eq("is_active", true).order("first_name", { ascending: true }),
  ]);

  const serviceList = (services ?? []) as ServiceRow[];
  const stylistList = (stylists ?? []) as StylistRow[];

  // Build ranked candidate services so we can fall back when no slots are found.
  const intakeText = normalized.combinedText;
  const serviceRanked = serviceList
    .map((svc) => {
      const name = (svc.name ?? "").trim();
      if (!name) return { svc, score: -1, keywords: [] as string[] };
      const { score, keywords } = scoreServiceMatch(name, intakeText);
      return { svc, score, keywords };
    })
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score);

  const bestService = serviceRanked[0]?.svc ? { id: serviceRanked[0].svc.id, name: serviceRanked[0].svc.name ?? null, keywords: serviceRanked[0].keywords } : null;
  const requestedStylist = findRequestedStylist(stylistList, normalized.requestedStylistText);

  // Optional: client history signals (if caller provides client_id)
  let clientPreferredStylistId: string | null = null;
  let clientLastCompletedServiceName: string | null = null;
  if (input.client_id) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("preferred_stylist_id")
      .eq("id", input.client_id)
      .maybeSingle();

    clientPreferredStylistId = (clientRow as any)?.preferred_stylist_id ?? null;

    const { data: lastCompleted } = await supabase
      .from("appointments")
      .select("service_id, start_at")
      .eq("client_id", input.client_id)
      .eq("status", "completed")
      .is("deleted_at", null)
      .order("start_at", { ascending: false })
      .limit(1);

    const last = (lastCompleted ?? [])[0] as { service_id: string; start_at: string } | undefined;
    if (last?.service_id) {
      const { data: lastService } = await supabase
        .from("services")
        .select("name")
        .eq("id", last.service_id)
        .maybeSingle();
      clientLastCompletedServiceName = (lastService as any)?.name ?? null;
    }
  }

  const vague = isVagueRequest(normalized.requestedServiceText) && isVagueRequest(normalized.concernNotesText);
  const consultRouting = determineConsultationRouting({
    serviceName: bestService?.name ?? null,
    serviceGoal: normalized.requestedServiceText,
    intakeNotes: `${normalized.concernNotesText}\n${normalized.budgetNotesText}`,
  });

  const needsConsultation = vague || consultRouting.requiresConsultation;
  const pricingUncertain = hasBudgetConstraint(`${normalized.budgetNotesText} ${normalized.requestedServiceText}`);

  const requiresManualReview =
    needsConsultation ||
    bestService == null ||
    (normalized.requestedStylistText.trim().length > 0 && requestedStylist == null);

  // Slot search window based on timing preference.
  const timingPref = buildTimingPreference({ timingPreferenceText: normalized.timingPreferenceText });
  const now = new Date();
  const dates: string[] = [];
  for (let offset = timingPref.dateStartOffsetDays; offset <= timingPref.dateEndOffsetDays; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() + offset);
    dates.push(localDateISOFromDate(d));
  }

  const requestedStylistId = requestedStylist?.id ?? null;
  const chosenFlags: string[] = [];
  if (needsConsultation) chosenFlags.push("consultation");
  if (pricingUncertain) chosenFlags.push("pricing_uncertain");

  // Search slots across best candidate services (fallback chain).
  type ScoredSlot = {
    stylistId: string;
    stylistName: string;
    startAt: string;
    endAt: string | null;
    score: number;
    reason: string;
    dateISO: string;
    timeHHMM: string;
    endTimeHHMM: string;
  };

  const allScored: ScoredSlot[] = [];
  const candidateServices = serviceRanked.slice(0, 3).map((x) => x.svc);
  let selectedServiceId: string | null = bestService?.id ?? null;
  let selectedServiceName: string | null = bestService?.name ?? null;

  for (const candidateService of candidateServices) {
    const svcId = candidateService.id;
    if (!svcId) continue;

    // If we have a requested stylist, we can quickly skip a candidate service that the stylist can't do.
    if (requestedStylistId) {
      const eligible = await isStylistEligibleForService(supabase, requestedStylistId, svcId);
      if (!eligible) {
        // don't attempt slots where we know requested stylist won't be eligible
      }
    }

    const startCount = allScored.length;

    for (const dateISO of dates) {
      const slots = await getAvailableSlots(supabase, svcId, dateISO);
      if (!slots.length) continue;

      for (const slot of slots) {
        const timeHHMM = localTimeHHMMFromISO(slot.startAt);
        const endTimeHHMM = localTimeHHMMFromISO(slot.endAt);
        const dateLocalISO = dateISO;

        // Score: time preference + requested/preferred stylist preference + earlier starts
        let score = 0;
        const stylistBoostRequested = requestedStylistId && slot.stylistId === requestedStylistId ? 30 : 0;
        const stylistBoostPreferred = clientPreferredStylistId && slot.stylistId === clientPreferredStylistId ? 20 : 0;
        score += stylistBoostRequested + stylistBoostPreferred;
        score += scoreTimeWindow(timeHHMM, timingPref);

        // Prefer earlier in the day slightly
        const mins = timeHHMMToMinutes(timeHHMM) ?? 0;
        score += Math.max(0, 240 - mins) / 10; // earlier => higher

        // Prefer closer dates
        const dayIndex = dates.indexOf(dateISO);
        if (dayIndex >= 0) score += Math.max(0, 10 - dayIndex);

        // Client history alignment can slightly increase confidence and score
        if (clientLastCompletedServiceName && candidateService.name) {
          const clientText = clientLastCompletedServiceName.toLowerCase();
          const candidateText = candidateService.name.toLowerCase();
          if (clientText && candidateText && (clientText.includes("color") ? candidateText.includes("color") : true)) {
            score += 6;
          }
        }

        const reasonParts: string[] = [];
        if (stylistBoostRequested) reasonParts.push("requested stylist available");
        else if (stylistBoostPreferred) reasonParts.push("preferred stylist available");
        if (timingPref.preferredStartHHMM || timingPref.preferredEndHHMM) reasonParts.push("matches timing preference");
        if (reasonParts.length === 0) reasonParts.push("eligible opening");

        allScored.push({
          stylistId: slot.stylistId,
          stylistName: slot.stylistName,
          startAt: slot.startAt,
          endAt: slot.endAt,
          score,
          reason: reasonParts.join(", "),
          dateISO: dateLocalISO,
          timeHHMM,
          endTimeHHMM,
        });
      }
    }

    // If this candidate service produced any slots, it's our selected service.
    if (allScored.length > startCount) {
      selectedServiceId = candidateService.id;
      selectedServiceName = candidateService.name ?? null;
      break;
    }
  }

  allScored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.startAt < b.startAt ? -1 : 1;
  });

  const top = allScored.slice(0, maxSlots);

  const recommended_time_slots = top.map((t) => ({
    date: t.dateISO,
    time: t.timeHHMM,
    end_time: t.endTimeHHMM,
    stylist_id: t.stylistId,
    reason: t.reason,
  }));

  const recommended_stylist_id = top[0]?.stylistId ?? requestedStylistId ?? clientPreferredStylistId;

  const noSlotsFound = recommended_time_slots.length === 0;
  if (noSlotsFound) chosenFlags.push("no_available_slots");

  // confidence: interpret evidence strength
  let confidence = 0.2;
  if (selectedServiceId) confidence += 0.35;
  if (top.length > 0) confidence += 0.35;
  if (requestedStylistId && top.some((s) => s.stylistId === requestedStylistId)) confidence += 0.1;
  if (
    clientPreferredStylistId &&
    top.some((s) => s.stylistId === clientPreferredStylistId)
  )
    confidence += 0.1;
  if (needsConsultation) confidence -= 0.25;
  if (pricingUncertain) confidence -= 0.05;
  if (requiresManualReview) confidence -= 0.2;
  if (noSlotsFound) confidence -= 0.25;
  confidence = Math.max(0, Math.min(1, confidence));

  const reasoning = makeReasoning({
    serviceName: selectedServiceName,
    requestedStylistName: requestedStylist?.name ?? null,
    chosenStylistName: top[0]?.stylistName ?? null,
    flagged: chosenFlags,
    timeWindowText: normalized.timingPreferenceText || "next available",
  });

  return {
    recommended_service_id: selectedServiceId ?? null,
    recommended_stylist_id: recommended_stylist_id ?? null,
    recommended_time_slots,
    flags: {
      needs_consultation: needsConsultation,
      pricing_uncertain: pricingUncertain,
      requires_manual_review: requiresManualReview || noSlotsFound,
    },
    confidence_score: confidence,
    reasoning,
    debug: {
      matchedService: selectedServiceName,
      matchedStylist: requestedStylist?.name ?? null,
      detectedKeywords:
        selectedServiceId != null
          ? serviceRanked.find((x) => x.svc.id === selectedServiceId)?.keywords ?? []
          : bestService?.keywords ?? [],
    },
  };
}

