/**
 * Maps a structured intake row + live salon catalog → booking guidance.
 * Re-exported thin layer over `decisionEngine` for clarity and future swapping (e.g. LLM).
 */
import type {
  IntakeDecisionInput,
  IntakeRecommendation,
  ServiceCandidate,
  StylistCandidate,
} from "@/app/lib/ai/decisionEngine";
import { computeIntakeRecommendation } from "@/app/lib/ai/decisionEngine";

export type { IntakeDecisionInput, IntakeRecommendation, ServiceCandidate, StylistCandidate };

/** Build input from a row returned by `intake_sessions` select. */
export function intakeRowToDecisionInput(row: {
  requested_service?: string | null;
  requested_stylist?: string | null;
  timing_preference?: string | null;
  budget_notes?: string | null;
  concern_notes?: string | null;
  ai_summary?: string | null;
}): IntakeDecisionInput {
  return {
    requested_service: row.requested_service,
    requested_stylist: row.requested_stylist,
    timing_preference: row.timing_preference,
    budget_notes: row.budget_notes,
    concern_notes: row.concern_notes,
    ai_summary: row.ai_summary,
  };
}

export function mapIntakeToRecommendation(
  intake: IntakeDecisionInput,
  services: ServiceCandidate[],
  stylists: StylistCandidate[],
): IntakeRecommendation {
  return computeIntakeRecommendation(intake, services, stylists);
}
