/**
 * Stable query params for /dashboard/appointments/new when arriving from intake guidance.
 * Rule-based only — callers pass the computed IntakeRecommendation.
 */
import type { IntakeRecommendation } from "@/app/lib/ai/decisionEngine";

/** Always included when linking from an intake session. */
export const INTAKE_QUERY_KEYS = {
  intakeSessionId: "intakeSessionId",
  clientId: "clientId",
  intakeDecision: "intakeDecision",
  consultationHint: "consultationHint",
  serviceId: "serviceId",
  stylistId: "stylistId",
} as const;

export type IntakeSessionSummaryFields = {
  requested_service?: string | null;
  timing_preference?: string | null;
  budget_notes?: string | null;
  concern_notes?: string | null;
  ai_summary?: string | null;
};

/** Short plain-text summary for panels / notes (no HTML). */
export function formatIntakeSessionSummary(row: IntakeSessionSummaryFields): string {
  const lines: string[] = [];
  if (row.requested_service?.trim()) {
    lines.push(`Goal: ${row.requested_service.trim()}`);
  }
  if (row.timing_preference?.trim()) {
    lines.push(`Last visit: ${row.timing_preference.trim()}`);
  }
  if (row.budget_notes?.trim()) {
    lines.push(`Budget: ${row.budget_notes.trim()}`);
  }
  if (row.concern_notes?.trim()) {
    lines.push(`Notes: ${row.concern_notes.trim()}`);
  }
  if (lines.length === 0 && row.ai_summary?.trim()) {
    return row.ai_summary.trim();
  }
  return lines.join("\n");
}

/**
 * Prefill service/stylist in the URL only when book_now + high confidence (stable, predictable).
 * Consultation and manual_review pass session + decision (+ consultation hint) only.
 */
export function buildIntakeBookingSearchParams(args: {
  sessionId: string;
  clientId?: string | null;
  rec: IntakeRecommendation;
}): URLSearchParams {
  const q = new URLSearchParams();
  q.set(INTAKE_QUERY_KEYS.intakeSessionId, args.sessionId);
  if (args.clientId) q.set(INTAKE_QUERY_KEYS.clientId, args.clientId);
  q.set(INTAKE_QUERY_KEYS.intakeDecision, args.rec.recommended_next_step);

  const step = args.rec.recommended_next_step;

  if (step === "manual_review") {
    return q;
  }

  if (step === "consultation_required") {
    q.set(INTAKE_QUERY_KEYS.consultationHint, "1");
    return q;
  }

  // book_now — only high confidence gets catalog IDs in the URL
  if (
    args.rec.confidence_level === "high" &&
    args.rec.recommended_service_id
  ) {
    q.set(INTAKE_QUERY_KEYS.serviceId, args.rec.recommended_service_id);
  }
  if (
    args.rec.confidence_level === "high" &&
    args.rec.recommended_stylist_id
  ) {
    q.set(INTAKE_QUERY_KEYS.stylistId, args.rec.recommended_stylist_id);
  }

  return q;
}

export function buildIntakeBookingHref(args: {
  sessionId: string;
  clientId?: string | null;
  rec: IntakeRecommendation;
}): string {
  return `/dashboard/appointments/new?${buildIntakeBookingSearchParams(args).toString()}`;
}

/**
 * Whether the new-appointment form should prefill service/stylist from guidance (not from stale URLs).
 */
export function shouldPrefillCatalogFromGuidance(rec: IntakeRecommendation | null): boolean {
  if (!rec) return false;
  return (
    rec.recommended_next_step === "book_now" &&
    rec.confidence_level === "high" &&
    Boolean(rec.recommended_service_id)
  );
}
