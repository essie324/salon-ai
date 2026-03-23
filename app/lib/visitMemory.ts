export type AppointmentMemory = {
  id: string;
  appointment_id: string;
  formula_notes: string | null;
  developer_notes: string | null;
  technique_notes: string | null;
  processing_notes: string | null;
  aftercare_notes: string | null;
  photo_urls: string[] | null;
  created_at: string;
};

export function hasAnyVisitMemory(
  m: Partial<AppointmentMemory> | null | undefined,
): boolean {
  if (!m) return false;
  const textFields = [
    m.formula_notes,
    m.developer_notes,
    m.technique_notes,
    m.processing_notes,
    m.aftercare_notes,
  ];
  const hasText = textFields.some((t) => (t ?? "").trim().length > 0);
  const hasPhotos = (m.photo_urls ?? []).filter(Boolean).length > 0;
  return hasText || hasPhotos;
}

/**
 * Accepts input from a textarea:
 * - one URL per line (recommended)
 * - or comma-separated
 * Returns a cleaned array (or null when empty).
 */
export function parsePhotoUrlsInput(raw: string | null | undefined): string[] | null {
  const input = (raw ?? "").trim();
  if (!input) return null;

  const parts = input
    .split(/\n|,/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const urls = Array.from(new Set(parts));
  return urls.length > 0 ? urls : null;
}

/** For displaying back into a textarea. */
export function photoUrlsToTextareaValue(urls: string[] | null | undefined): string {
  return (urls ?? []).filter(Boolean).join("\n");
}

