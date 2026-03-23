export type RawIntakeInput = {
  requested_service?: string | null;
  requested_stylist?: string | null;
  timing_preference?: string | null;
  budget_notes?: string | null;
  concern_notes?: string | null;
};

export type NormalizedIntake = {
  requestedServiceText: string;
  requestedStylistText: string;
  timingPreferenceText: string;
  budgetNotesText: string;
  concernNotesText: string;
  combinedText: string;
};

function norm(v: string | null | undefined): string {
  return (v ?? "").trim();
}

export function normalizeIntake(input: RawIntakeInput): NormalizedIntake {
  const requestedServiceText = norm(input.requested_service);
  const requestedStylistText = norm(input.requested_stylist);
  const timingPreferenceText = norm(input.timing_preference);
  const budgetNotesText = norm(input.budget_notes);
  const concernNotesText = norm(input.concern_notes);

  const combinedText = [
    requestedServiceText,
    requestedStylistText,
    timingPreferenceText,
    budgetNotesText,
    concernNotesText,
  ]
    .filter(Boolean)
    .join(" · ")
    .toLowerCase();

  return {
    requestedServiceText,
    requestedStylistText,
    timingPreferenceText,
    budgetNotesText,
    concernNotesText,
    combinedText,
  };
}

