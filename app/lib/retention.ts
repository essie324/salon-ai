import { localDateISO } from "@/app/lib/dashboard/dateRanges";

export type RebookingStatus = "not_due" | "due_soon" | "overdue";

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Rebooking status for a recommended date.
 * - overdue: recommended date is before today (local)
 * - due_soon: recommended date is today .. today+dueSoonDays (inclusive)
 * - not_due: recommended date is after due_soon window OR missing
 */
export function getRebookingStatus(options: {
  recommendedDate: Date | null;
  today?: Date;
  dueSoonDays?: number;
}): RebookingStatus {
  const today = startOfLocalDay(options.today ?? new Date());
  const dueSoonDays = options.dueSoonDays ?? 14;
  const rec = options.recommendedDate;
  if (!rec) return "not_due";

  const recDay = startOfLocalDay(rec);
  if (recDay.getTime() < today.getTime()) return "overdue";

  const end = startOfLocalDay(addDays(today, dueSoonDays));
  if (recDay.getTime() <= end.getTime()) return "due_soon";

  return "not_due";
}

export function formatLocalISO(d: Date | null | undefined): string | null {
  if (!d) return null;
  return localDateISO(d);
}

