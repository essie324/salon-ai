"use client";

import Link from "next/link";
import { schedulerStatusStyle } from "@/app/lib/calendar/statusColors";

type AppointmentBlockProps = {
  id: string;
  clientName: string;
  serviceName: string;
  timeRange: string;
  status: string;
  clientNoShowCount?: number;
};

export function AppointmentBlock({
  id,
  clientName,
  serviceName,
  timeRange,
  status,
  clientNoShowCount,
}: AppointmentBlockProps) {
  const style = schedulerStatusStyle(status);

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
    >
      <div
        style={{
          height: "100%",
          padding: "6px 8px",
          borderRadius: 8,
          background: style.bg,
          borderLeft: `4px solid ${style.border}`,
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        }}
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
