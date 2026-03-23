export type DateRange = { startISO: string; endISO: string };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Local YYYY-MM-DD (not UTC) */
export function localDateISO(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Week boundary: Monday → Sunday (local calendar).
 * Returns inclusive YYYY-MM-DD start/end.
 */
export function getCurrentWeekRangeISO(today: Date = new Date()): DateRange {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = d.getDay(); // 0=Sun
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  const start = new Date(d.getTime());
  const end = new Date(d.getTime());
  end.setDate(end.getDate() + 6);
  return { startISO: localDateISO(start), endISO: localDateISO(end) };
}

/** Calendar month range (local). Returns inclusive start/end ISO. */
export function getCurrentMonthRangeISO(today: Date = new Date()): DateRange {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { startISO: localDateISO(start), endISO: localDateISO(end) };
}

