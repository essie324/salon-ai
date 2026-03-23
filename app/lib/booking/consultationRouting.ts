export type ConsultationRoutingInput = {
  serviceName?: string | null;
  serviceGoal?: string | null;
  intakeNotes?: string | null;
};

export type ConsultationRoutingResult = {
  requiresConsultation: boolean;
  reason?: string;
  message?: string;
};

/**
 * First-pass rules for when a request should be treated as a consultation
 * instead of a full service appointment.
 *
 * This is intentionally simple and text-based so we can reuse it for
 * AI/chat, SMS, and web intake later.
 */
export function determineConsultationRouting(
  input: ConsultationRoutingInput,
): ConsultationRoutingResult {
  const serviceName = (input.serviceName ?? "").toLowerCase();
  const goal = (input.serviceGoal ?? "").toLowerCase();
  const notes = (input.intakeNotes ?? "").toLowerCase();
  const text = `${serviceName} ${goal} ${notes}`;

  const reasons: string[] = [];

  // Color correction / major color change
  if (
    text.includes("color correction") ||
    text.includes("correct previous color") ||
    text.includes("fix my color") ||
    text.includes("botched") ||
    text.includes("color disaster") ||
    text.includes("over processed")
  ) {
    reasons.push("color_correction");
  }

  // Major blonde transformations
  if (
    text.includes("major blonde") ||
    text.includes("go blonde") ||
    text.includes("platinum") ||
    (text.includes("dark") && text.includes("to blonde"))
  ) {
    reasons.push("major_blonde_transformation");
  }

  // Big color changes
  if (
    text.includes("big color change") ||
    text.includes("major color change") ||
    (text.includes("change") && text.includes("color")) ||
    (text.includes("from blonde") && text.includes("to dark")) ||
    (text.includes("from dark") && text.includes("to light"))
  ) {
    reasons.push("big_color_change");
  }

  // Extensions install / significant changes
  if (
    serviceName.includes("extension") ||
    text.includes("install extensions") ||
    text.includes("new extensions")
  ) {
    reasons.push("extensions_consult");
  }

  const requiresConsultation = reasons.length > 0;
  if (!requiresConsultation) {
    return { requiresConsultation: false };
  }

  const reason = reasons[0];
  const message =
    "This request looks like it should begin with a consultation before booking the full service.";

  return {
    requiresConsultation: true,
    reason,
    message,
  };
}

