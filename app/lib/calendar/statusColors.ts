/**
 * Status styling aligned with `app/dashboard/appointments/page.tsx` list view.
 * Used by calendar blocks for consistent reception desk cues.
 */
export const SCHEDULER_STATUS_STYLES: Record<
  string,
  { bg: string; border: string; label: string }
> = {
  scheduled: { bg: "#f8fafc", border: "#64748b", label: "Scheduled" },
  confirmed: { bg: "#eff6ff", border: "#2563eb", label: "Confirmed" },
  checked_in: { bg: "#fff7ed", border: "#ea580c", label: "Checked in" },
  completed: { bg: "#ecfdf5", border: "#16a34a", label: "Completed" },
  cancelled: { bg: "#f3f4f6", border: "#6b7280", label: "Cancelled" },
  no_show: { bg: "#fef2f2", border: "#dc2626", label: "No-show" },
};

export function schedulerStatusStyle(status: string | null | undefined) {
  const key = (status ?? "scheduled").toLowerCase();
  return SCHEDULER_STATUS_STYLES[key] ?? SCHEDULER_STATUS_STYLES.scheduled;
}
