"use client";

import Link from "next/link";
import { useState } from "react";

/** Calendar block colors by status (dashboard-consistent). */
const STATUS_COLORS: Record<string, { bg: string; border: string }> = {
  // Match dashboard palette / spec:
  scheduled: { bg: "#eef6ff", border: "#0b57d0" },      // blue
  confirmed: { bg: "#f3e8ff", border: "#7c3aed" },      // purple
  checked_in: { bg: "#fff7ed", border: "#ea580c" },     // orange
  completed: { bg: "#e8f5e9", border: "#16a34a" },      // green
  cancelled: { bg: "#f3f4f6", border: "#9ca3af" },      // gray
  no_show: { bg: "#fee2e2", border: "#b42318" },        // red
};

type AppointmentBlockProps = {
  id: string;
  clientName: string;
  serviceName: string;
  timeRange: string;
  status: string;
  durationMinutes?: number;
  clientNoShowCount?: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
};

export function AppointmentBlock({
  id,
  clientName,
  serviceName,
  timeRange,
  status,
  clientNoShowCount,
  onDragStart,
  onDragEnd,
}: AppointmentBlockProps) {
  const style = STATUS_COLORS[status] ?? STATUS_COLORS.scheduled;
  const [isDragging, setIsDragging] = useState(false);

  return (
    <Link
      href={`/dashboard/appointments/${id}`}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        height: "100%",
        boxSizing: "border-box",
      }}
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        // Use a simple drag image so the block feels responsive
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
        }
        onDragStart?.();
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd?.();
      }}
    >
      <div
        style={{
          height: "100%",
          padding: "6px 8px",
          borderRadius: 8,
          background: style.bg,
          borderLeft: `4px solid ${style.border}`,
          overflow: "hidden",
          transition: "opacity 0.15s, box-shadow 0.15s",
          opacity: isDragging ? 0.6 : 1,
          boxShadow: isDragging ? "0 0 0 2px rgba(17, 17, 17, 0.15)" : "none",
        }}
        className="appointment-block-hover"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#111",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: 1,
            }}
          >
            {clientName}
          </div>
          {clientNoShowCount != null && clientNoShowCount > 0 && (
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 999,
                background: "#fef3c7",
                color: "#92400e",
                fontSize: 9,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {clientNoShowCount}× no-show
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#555",
            marginBottom: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {serviceName}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "#666",
          }}
        >
          {timeRange}
        </div>
      </div>
    </Link>
  );
}
