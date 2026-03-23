import type { CSSProperties } from "react";

/**
 * Supported appointment statuses and their display/behavior.
 */

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    scheduled: "Scheduled",
    confirmed: "Confirmed",
    checked_in: "Checked-in",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No-show",
  };
  return labels[status] ?? status;
}

/**
 * Returns badge styles for the given status (polished, receptionist-friendly).
 */
export function statusBadgeStyle(status: string): CSSProperties {
  let bg = "#f5f5f5";
  let color = "#444";
  switch (status) {
    case "scheduled":
      bg = "#eef6ff";      // blue
      color = "#0b57d0";
      break;
    case "confirmed":
      bg = "#f3e8ff";      // purple
      color = "#7c3aed";
      break;
    case "checked_in":
      bg = "#fff7ed";      // orange
      color = "#ea580c";
      break;
    case "completed":
      bg = "#e8f5e9";      // green
      color = "#16a34a";
      break;
    case "cancelled":
      bg = "#f3f4f6";      // gray
      color = "#4b5563";
      break;
    case "no_show":
      bg = "#fee2e2";      // red
      color = "#b42318";
      break;
    default:
      break;
  }
  return {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    fontWeight: 700,
    textTransform: "capitalize",
    background: bg,
    color,
    fontSize: 12,
  };
}

/** Larger badge for detail page. */
export function statusBadgeStyleDetail(status: string): CSSProperties {
  const base = statusBadgeStyle(status);
  return { ...base, padding: "8px 14px", fontSize: 14 };
}

export type StatusAction = "confirm" | "check_in" | "complete" | "cancel" | "no_show";

/**
 * Returns which actions are valid for the current status.
 * Used to show/hide or enable/disable action buttons.
 */
export function allowedStatusActions(status: string): StatusAction[] {
  switch (status) {
    case "scheduled":
      return ["confirm", "check_in", "complete", "cancel", "no_show"];
    case "confirmed":
      return ["check_in", "complete", "cancel", "no_show"];
    case "checked_in":
      return ["complete", "cancel", "no_show"];
    case "completed":
    case "cancelled":
    case "no_show":
      return [];
    default:
      return ["confirm", "complete", "cancel", "no_show"];
  }
}

export function canConfirm(status: string): boolean {
  return allowedStatusActions(status).includes("confirm");
}
export function canCheckIn(status: string): boolean {
  return allowedStatusActions(status).includes("check_in");
}
export function canComplete(status: string): boolean {
  return allowedStatusActions(status).includes("complete");
}
export function canCancel(status: string): boolean {
  return allowedStatusActions(status).includes("cancel");
}
export function canMarkNoShow(status: string): boolean {
  return allowedStatusActions(status).includes("no_show");
}

/**
 * Whether the appointment is in a terminal/inactive state (no further actions).
 */
export function isTerminalStatus(status: string): boolean {
  return status === "completed" || status === "cancelled" || status === "no_show";
}
