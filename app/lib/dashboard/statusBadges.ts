import type { CSSProperties } from "react";

/** Rebooking / retention row status — visual only. */
export function rebookingStatusBadgeStyle(
  status: "due_soon" | "overdue",
): CSSProperties {
  if (status === "overdue") {
    return { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" };
  }
  return { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" };
}

export function riskChipStyle(kind: "notice" | "neutral"): CSSProperties {
  if (kind === "notice") {
    return { background: "#f8fafc", color: "#334155", border: "1px solid #e2e8f0" };
  }
  return { background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" };
}
