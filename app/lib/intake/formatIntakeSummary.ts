/**
 * Plain-text summary for appointment / profile display (no AI).
 */
export type IntakeSessionRow = {
  source?: string | null;
  requested_service?: string | null;
  requested_stylist?: string | null;
  timing_preference?: string | null;
  budget_notes?: string | null;
  concern_notes?: string | null;
  ai_summary?: string | null;
};

export function formatIntakeSummaryLines(row: IntakeSessionRow): string[] {
  if (row.ai_summary?.trim()) {
    return [row.ai_summary.trim()];
  }
  const lines: string[] = [];
  if (row.requested_service?.trim()) {
    lines.push(`Looking for: ${row.requested_service.trim()}`);
  }
  if (row.timing_preference?.trim()) {
    lines.push(`Last appointment / timing: ${row.timing_preference.trim()}`);
  }
  if (row.requested_stylist?.trim()) {
    lines.push(`Stylist preference: ${row.requested_stylist.trim()}`);
  }
  if (row.budget_notes?.trim()) {
    lines.push(`Budget: ${row.budget_notes.trim()}`);
  }
  if (row.concern_notes?.trim()) {
    lines.push(`Notes: ${row.concern_notes.trim()}`);
  }
  return lines;
}
