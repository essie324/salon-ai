export type IntakeSessionInsert = {
  client_id?: string | null;
  appointment_id?: string | null;
  source?: string | null;
  requested_service?: string | null;
  requested_stylist?: string | null;
  timing_preference?: string | null;
  budget_notes?: string | null;
  concern_notes?: string | null;
  ai_summary?: string | null;
};

export function buildIntakeSessionFromForm(options: {
  clientId: string | null;
  appointmentId: string | null;
  source: string;
  requested_service: string;
  requested_stylist: string;
  timing_preference: string;
  budget_notes: string;
  concern_notes: string;
}): IntakeSessionInsert | null {
  const requested_service = options.requested_service.trim();
  const requested_stylist = options.requested_stylist.trim();
  const timing_preference = options.timing_preference.trim();
  const budget_notes = options.budget_notes.trim();
  const concern_notes = options.concern_notes.trim();

  const hasAny =
    requested_service ||
    requested_stylist ||
    timing_preference ||
    budget_notes ||
    concern_notes;

  if (!hasAny) return null;

  return {
    client_id: options.clientId,
    appointment_id: options.appointmentId,
    source: options.source,
    requested_service: requested_service || null,
    requested_stylist: requested_stylist || null,
    timing_preference: timing_preference || null,
    budget_notes: budget_notes || null,
    concern_notes: concern_notes || null,
    ai_summary: null,
  };
}

