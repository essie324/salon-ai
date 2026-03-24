/**
 * Rule-based intake → booking guidance (no external AI).
 * Extend with richer synonyms / ML later; keep outputs stable for UI.
 */

export type RecommendedNextStep = "book_now" | "consultation_required" | "manual_review";

export type ConfidenceLevel = "high" | "medium" | "low";

export type IntakeDecisionInput = {
  requested_service?: string | null;
  requested_stylist?: string | null;
  timing_preference?: string | null;
  budget_notes?: string | null;
  concern_notes?: string | null;
  ai_summary?: string | null;
};

export type ServiceCandidate = { id: string; name: string | null };

export type StylistCandidate = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export type IntakeRecommendation = {
  recommended_service_name: string | null;
  recommended_service_id: string | null;
  recommended_stylist_id: string | null;
  recommended_next_step: RecommendedNextStep;
  confidence_level: ConfidenceLevel;
  reasoning_summary: string;
};

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "with",
  "my",
  "i",
  "want",
  "need",
  "get",
  "some",
]);

/** Combined free text for keyword passes. */
export function combineIntakeText(input: IntakeDecisionInput): string {
  const parts = [
    input.requested_service,
    input.requested_stylist,
    input.timing_preference,
    input.budget_notes,
    input.concern_notes,
    input.ai_summary,
  ];
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .join("\n")
    .toLowerCase();
}

/** Strong signals that a consultation should be booked first. */
export function detectConsultationSignals(text: string): { hit: boolean; reason: string | null } {
  const t = text.toLowerCase();

  const patterns: [RegExp, string][] = [
    [/\bconsultation\b|\bconsult\b|\bcome in to discuss\b|\bneed to discuss\b/, "Consult / discuss language"],
    [/\bcolor correction\b|\bcorrective color\b|\bcorrective\b/, "Color correction / corrective work"],
    [/\bfix\b.*\b(hair|color|bleach|damage)/, "Repair / fix language"],
    [/\btransformation\b|\bcomplete change\b|\bmajor change\b|\bdrastic\b/, "Major transformation language"],
    [/\bnot sure\b|\bdon't know\b|\bdont know\b|\bunsure\b|\bidk\b|\bhelp me (pick|choose|decide)\b/, "Guest uncertainty"],
    [/\bevaluate\b|\bassessment\b|\bwhat would work\b/, "Assessment / evaluation"],
    [/\b(box )?dye\b.*\b(at home|myself)\b|\bleftover\b.*\b(color|dye)\b/, "At-home color / complex correction risk"],
    [/\brepair\b.*\b(damage|bleach|breakage)/, "Damage repair"],
    [/\b(vague|unsure).*\bwhat\b|\bjust something different\b/, "Vague transformation ask"],
  ];

  for (const [re, label] of patterns) {
    if (re.test(t)) return { hit: true, reason: label };
  }

  // Very short primary ask → likely needs consult (only if that's most of the content)
  const primary = (text.split("\n")[0] ?? "").trim();
  if (primary.length > 0 && primary.length < 12 && !/\b(cut|trim|blow)\b/i.test(primary)) {
    return { hit: true, reason: "Very short request — clarify in person" };
  }

  return { hit: false, reason: null };
}

export type ServiceScore = { id: string; name: string; score: number };

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Synonym groups: any token in text that overlaps with service name tokens gets a boost. */
const SERVICE_SYNONYMS: Record<string, string[]> = {
  highlight: ["highlight", "highlights", "foil", "babylight", "balayage", "ombre", "sombre"],
  haircut: ["haircut", "hair cut", "trim", "bangs", "fringe", "layers", "cut"],
  color: ["color", "colour", "dye", "tint", "root", "roots", "retouch", "touch up", "touchup", "gray", "grey", "coverage"],
  blowout: ["blowout", "blow dry", "blowdry", "style"],
  extension: ["extension", "extensions", "weft", "tape-in", "keratin bond"],
  treatment: ["treatment", "keratin", "deep condition", "olaplex", "gloss", "toner"],
  perm: ["perm", "wave", "curl"],
  facial: ["facial", "wax", "brow"],
};

function synonymBoost(text: string, serviceNameLower: string): number {
  let bonus = 0;
  for (const [, variants] of Object.entries(SERVICE_SYNONYMS)) {
    const serviceHas = variants.some((v) => serviceNameLower.includes(v.replace(/\s+/g, "")) || serviceNameLower.includes(v));
    const textHas = variants.some((v) => text.includes(v.replace(/\s+/g, "")) || text.includes(v));
    if (serviceHas && textHas) bonus += 12;
  }
  return bonus;
}

/**
 * Score catalog services against combined intake text; return sorted by score desc.
 */
export function scoreServicesAgainstIntake(
  combinedText: string,
  services: ServiceCandidate[],
): ServiceScore[] {
  const text = combinedText.toLowerCase();
  const scores: ServiceScore[] = [];

  for (const s of services) {
    const name = (s.name ?? "").trim();
    if (!name) continue;
    const nl = name.toLowerCase();
    let score = synonymBoost(text, nl);

    if (text.includes(nl) || nl.includes(text.slice(0, Math.min(text.length, nl.length)))) {
      score += 45;
    }

    const nameTokens = tokenize(nl);
    const textTokens = new Set(tokenize(text));
    for (const tok of nameTokens) {
      if (textTokens.has(tok) || text.includes(tok)) score += 8;
    }

    if (score > 0) {
      scores.push({ id: s.id, name, score });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  return scores;
}

export function findBestStylistMatch(
  requestedStylist: string | null | undefined,
  stylists: StylistCandidate[],
): { id: string; score: number } | null {
  const raw = (requestedStylist ?? "").trim().toLowerCase();
  if (!raw) return null;

  let best: { id: string; score: number } | null = null;

  for (const st of stylists) {
    const full = `${st.first_name ?? ""} ${st.last_name ?? ""}`.trim().toLowerCase();
    if (!full) continue;

    let score = 0;
    if (raw === full) score = 100;
    else if (full.includes(raw) || raw.includes(full)) score = 70;
    else {
      const parts = full.split(/\s+/).filter((p) => p.length > 1);
      const hits = parts.filter((p) => raw.includes(p)).length;
      if (hits === parts.length && parts.length > 0) score = 60;
      else if (hits > 0) score = 20 * hits;
    }

    if (!best || score > best.score) best = { id: st.id, score };
  }

  return best && best.score >= 25 ? best : null;
}

function confidenceFromServiceScore(score: number, secondBest: number): ConfidenceLevel {
  if (score >= 45 && score - secondBest >= 15) return "high";
  if (score >= 28) return "medium";
  return "low";
}

function decideStep(args: {
  consultationHit: boolean;
  combinedText: string;
  bestService: ServiceScore | null;
  secondService: ServiceScore | null;
}): { step: RecommendedNextStep; confidence: ConfidenceLevel; reasoning: string } {
  const { consultationHit, combinedText, bestService, secondService } = args;

  if (consultationHit) {
    return {
      step: "consultation_required",
      confidence: "high",
      reasoning:
        "The request sounds like it needs an in-person consult (correction, major change, uncertainty, or similar) before booking a full service.",
    };
  }

  const top = bestService?.score ?? 0;
  const second = secondService?.score ?? 0;
  const conf = bestService ? confidenceFromServiceScore(top, second) : "low";

  if (!bestService || top < 22) {
    return {
      step: "manual_review",
      confidence: "low",
      reasoning:
        "We couldn’t confidently match this request to a single catalog service. Have front desk or a stylist confirm the right booking.",
    };
  }

  if (top < 35 || conf === "low") {
    return {
      step: "manual_review",
      confidence: conf === "low" ? "low" : "medium",
      reasoning: `A possible match is “${bestService.name}”, but confidence is limited. Verify with the guest before confirming.`,
    };
  }

  if (conf === "medium") {
    return {
      step: "book_now",
      confidence: "medium",
      reasoning: `Best catalog match: “${bestService.name}”. Review details with the guest, then book if it fits.`,
    };
  }

  return {
    step: "book_now",
    confidence: "high",
    reasoning: `Strong match to “${bestService.name}” based on keywords in the intake (${combinedText.length} chars analyzed).`,
  };
}

/**
 * Main entry: produce structured recommendation from intake + live catalog.
 */
export function computeIntakeRecommendation(
  intake: IntakeDecisionInput,
  services: ServiceCandidate[],
  stylists: StylistCandidate[],
): IntakeRecommendation {
  const combinedText = combineIntakeText(intake);
  const { hit: consultationHit } = detectConsultationSignals(combinedText);

  const ranked = scoreServicesAgainstIntake(combinedText, services);
  const bestService = ranked[0] ?? null;
  const secondService = ranked[1] ?? null;

  const { step, confidence, reasoning } = decideStep({
    consultationHit,
    combinedText,
    bestService,
    secondService,
  });

  const stylistMatch = findBestStylistMatch(intake.requested_stylist, stylists);

  let recommended_service_id: string | null = null;
  let recommended_service_name: string | null = null;

  if (step === "consultation_required") {
    recommended_service_name = bestService?.name ?? null;
    recommended_service_id = null;
  } else if (step === "book_now" && bestService) {
    recommended_service_name = bestService.name;
    if (confidence === "high" && bestService.score >= 40) {
      recommended_service_id = bestService.id;
    } else if (confidence === "medium" && bestService.score >= 30) {
      recommended_service_id = bestService.id;
    }
  } else if (step === "manual_review" && bestService && bestService.score >= 22) {
    recommended_service_name = bestService.name;
    recommended_service_id = null;
  }

  let recommended_stylist_id: string | null = null;
  if (stylistMatch && (stylistMatch.score >= 50 || (step === "book_now" && stylistMatch.score >= 40))) {
    recommended_stylist_id = stylistMatch.id;
  }

  let reasoning_summary = reasoning;
  if (stylistMatch && recommended_stylist_id) {
    reasoning_summary += ` Matched requested stylist to an active profile.`;
  } else if ((intake.requested_stylist ?? "").trim()) {
    reasoning_summary += ` Requested stylist text didn’t match an active stylist — pick manually.`;
  }

  return {
    recommended_service_name,
    recommended_service_id,
    recommended_stylist_id,
    recommended_next_step: step,
    confidence_level:
      step === "consultation_required"
        ? "high"
        : confidence,
    reasoning_summary,
  };
}
