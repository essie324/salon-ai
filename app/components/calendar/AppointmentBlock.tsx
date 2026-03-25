"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { appointmentBlockChrome } from "@/app/lib/calendar/stylistColors";
import { setCalendarDragPayload, type CalendarDragPayload } from "@/app/lib/calendar/dragSupport";

type AppointmentBlockProps = {
  id: string;
  clientName: string;
  serviceName: string;
  timeRange: string;
  status: string;
  /** Resolved hex from stylist (or neutral when unassigned). */
  stylistCalendarColor: string;
  clientNoShowCount?: number;
  /** When set, shows a drag handle for calendar reschedule (detail still opens from main area). */
  calendarDrag?: CalendarDragPayload | null;
  /** Fired at drag start with the same payload written to dataTransfer (needed because getData is empty during dragover). */
  onCalendarDragStart?: (appointmentId: string, payload: CalendarDragPayload) => void;
  onCalendarDragEnd?: () => void;
};

const handleStyle: CSSProperties = {
  flexShrink: 0,
  width: 14,
  minHeight: 24,
  marginRight: 2,
  borderRadius: 4,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
  cursor: "grab",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  alignSelf: "stretch",
  userSelect: "none",
  touchAction: "none",
  WebkitUserSelect: "none",
};

export function AppointmentBlock({
  id,
  clientName,
  serviceName,
  timeRange,
  status,
  stylistCalendarColor,
  clientNoShowCount,
  calendarDrag,
  onCalendarDragStart,
  onCalendarDragEnd,
}: AppointmentBlockProps) {
  const chrome = appointmentBlockChrome(stylistCalendarColor, status);

  const body = (
    <div
      style={{
        height: "100%",
        padding: "6px 8px",
        borderRadius: 8,
        background: chrome.background,
        borderLeft: chrome.borderLeft,
        borderTop: chrome.borderTop,
        opacity: chrome.opacity,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        flex: 1,
        minWidth: 0,
        boxSizing: "border-box",
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
  );

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: 0,
        alignItems: "stretch",
      }}
    >
      {calendarDrag ? (
        // Use a div, not <button>: native <button draggable> is unreliable in some browsers.
        // Must stay pointer-events: auto during drag (parent must not disable the source).
        <div
          role="button"
          tabIndex={0}
          draggable
          aria-label="Drag to reschedule"
          title="Drag to reschedule"
          onDragStart={(e) => {
            setCalendarDragPayload(e.dataTransfer, calendarDrag);
            onCalendarDragStart?.(id, calendarDrag);
          }}
          onDragEnd={() => {
            onCalendarDragEnd?.();
          }}
          onMouseDown={(ev) => ev.stopPropagation()}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
            }
          }}
          style={handleStyle}
        >
          <span
            style={{
              display: "grid",
              gap: 2,
              pointerEvents: "none",
            }}
            aria-hidden
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 5,
                  height: 1,
                  background: "#64748b",
                  borderRadius: 1,
                }}
              />
            ))}
          </span>
        </div>
      ) : null}
      <Link
        href={`/dashboard/appointments/${id}`}
        style={{
          display: "block",
          textDecoration: "none",
          color: "inherit",
          flex: 1,
          minWidth: 0,
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        {body}
      </Link>
    </div>
  );
}
