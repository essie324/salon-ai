"use client";

import Link from "next/link";
import {
  TimeColumn,
  CALENDAR_ROW_HEIGHT,
  CALENDAR_ROW_COUNT,
  CALENDAR_DAY_START,
  CALENDAR_SLOT_MINUTES,
} from "./TimeColumn";
import { AppointmentBlock } from "./AppointmentBlock";
import { useState, useCallback, useEffect, useRef } from "react";

const ROW_HEIGHT = CALENDAR_ROW_HEIGHT;

function formatTimeRange(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  const startTime = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!endIso) return startTime;
  const end = new Date(endIso);
  const endTime = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${startTime} – ${endTime}`;
}

function getRowFromStart(startIso: string): number {
  const d = new Date(startIso);
  const hour = d.getHours();
  const minute = d.getMinutes();
  const row = (hour - CALENDAR_DAY_START) * (60 / CALENDAR_SLOT_MINUTES) + Math.floor(minute / CALENDAR_SLOT_MINUTES);
  return Math.max(0, Math.min(CALENDAR_ROW_COUNT - 1, row));
}

function getSpanFromDuration(startIso: string, endIso: string | null, fallbackMinutes: number): number {
  if (endIso) {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const durationMinutes = (end - start) / (60 * 1000);
    return Math.max(1, Math.ceil(durationMinutes / CALENDAR_SLOT_MINUTES));
  }
  return Math.max(1, Math.ceil(fallbackMinutes / CALENDAR_SLOT_MINUTES));
}

function timeForRow(rowIndex: number): string {
  const totalMinutes = CALENDAR_DAY_START * 60 + rowIndex * CALENDAR_SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getLocalTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type StylistForScheduler = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export type AppointmentForScheduler = {
  id: string;
  start_at: string;
  end_at: string | null;
  status: string;
  stylist_id: string | null;
  clientName: string;
  serviceName: string;
  durationMinutes?: number;
  appointment_date?: string;
  clientNoShowCount?: number;
};

type DaySchedulerProps = {
  date: string;
  stylists: StylistForScheduler[];
  appointments: AppointmentForScheduler[];
};

type DraggedAppointment = {
  id: string;
  durationMinutes: number;
  fromStylistId: string | null;
};

export function DayScheduler({ date, stylists, appointments }: DaySchedulerProps) {
  const [dragged, setDragged] = useState<DraggedAppointment | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{
    stylistId: string;
    row: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isToday = getLocalTodayISO() === date;

  const handleDropOnSlot = useCallback(
    async (stylistId: string, rowIndex: number) => {
      if (!dragged || isUpdating) return;
      const time = timeForRow(rowIndex); // HH:mm
      const durationMinutes = dragged.durationMinutes || 60;

      try {
        setIsUpdating(true);
        setError(null);
        const res = await fetch("/api/appointments/reschedule", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: dragged.id,
            stylistId,
            date,
            time,
            durationMinutes,
          }),
        });

        if (!res.ok) {
          setError("This time slot is not available.");
          return;
        }

        const data = await res.json();
        if (!data.ok) {
          setError("This time slot is not available.");
          return;
        }

        // Reload to reflect updated schedule
        window.location.reload();
      } catch {
        setError("This time slot is not available.");
      } finally {
        setIsUpdating(false);
        setDragged(null);
      }
    },
    [dragged, date, isUpdating]
  );

  // Keep "now" roughly in sync for the current-time indicator.
  useEffect(() => {
    if (!isToday) return;
    setNow(new Date());
    const id = setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  // Auto-scroll the page so the relevant time is near the viewport.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Only run on mount / date change
    const rect = root.getBoundingClientRect();
    const pageTop = window.scrollY + rect.top;

    let targetMinutesFromStart: number;
    if (isToday) {
      const current = new Date();
      const minutes =
        current.getHours() * 60 + current.getMinutes() - CALENDAR_DAY_START * 60;
      targetMinutesFromStart = Math.max(
        0,
        Math.min(
          CALENDAR_ROW_COUNT * CALENDAR_SLOT_MINUTES,
          minutes,
        ),
      );
    } else {
      // Default to around 9:00 for non-today days (or start of grid if earlier).
      const nineAM = 9 * 60 - CALENDAR_DAY_START * 60;
      targetMinutesFromStart = Math.max(0, nineAM);
    }

    const rowFloat = targetMinutesFromStart / CALENDAR_SLOT_MINUTES;
    const offsetWithinGrid = rowFloat * (ROW_HEIGHT - 1);
    const headerOffset = ROW_HEIGHT;
    const targetPageY = pageTop + headerOffset + offsetWithinGrid - 200;

    window.scrollTo({
      top: Math.max(0, targetPageY),
      behavior: "smooth",
    });
  }, [date, isToday]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  // Current-time indicator line position (within this component).
  let currentTimeTop: number | null = null;
  if (isToday && now) {
    const minutesFromStart =
      now.getHours() * 60 + now.getMinutes() - CALENDAR_DAY_START * 60;
    if (
      minutesFromStart >= 0 &&
      minutesFromStart <= CALENDAR_ROW_COUNT * CALENDAR_SLOT_MINUTES
    ) {
      const rowFloat = minutesFromStart / CALENDAR_SLOT_MINUTES;
      const offsetWithinGrid = rowFloat * (ROW_HEIGHT - 1);
      const headerOffset = ROW_HEIGHT;
      currentTimeTop = headerOffset + offsetWithinGrid;
    }
  }

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        display: "flex",
        gap: 0,
        overflowX: "auto",
        background: "#fff",
        border: "1px solid #e5e5e5",
        borderRadius: 16,
        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
        minHeight: CALENDAR_ROW_COUNT * ROW_HEIGHT + ROW_HEIGHT,
      }}
    >
      <TimeColumn />

      <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
        {stylists.map((stylist) => {
          const stylistAppointments = appointments.filter((a) => a.stylist_id === stylist.id);
          const stylistName = `${stylist.first_name ?? ""} ${stylist.last_name ?? ""}`.trim() || "Unnamed";

          return (
            <div
              key={stylist.id}
              style={{
                flex: 1,
                minWidth: 120,
                display: "flex",
                flexDirection: "column",
                borderLeft: "1px solid #eee",
              }}
            >
              <div
                style={{
                  height: ROW_HEIGHT,
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#111",
                  padding: "0 8px",
                  textAlign: "center",
                }}
              >
                {stylistName}
              </div>
              <div
                style={{
                  position: "relative",
                  flex: 1,
                  display: "grid",
                  gridTemplateRows: `repeat(${CALENDAR_ROW_COUNT}, ${
                    ROW_HEIGHT - 1
                  }px)`,
                  gap: "1px 0",
                }}
              >
                {Array.from({ length: CALENDAR_ROW_COUNT }, (_, rowIndex) => (
                  <div
                    key={rowIndex}
                    onDragOver={(e) => {
                      if (!dragged) return;
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      if (!dragged) return;
                      e.preventDefault();
                      void handleDropOnSlot(stylist.id, rowIndex);
                    }}
                    onMouseEnter={() =>
                      setHoveredSlot({ stylistId: stylist.id, row: rowIndex })
                    }
                    onMouseLeave={() => {
                      setHoveredSlot((prev) =>
                        prev &&
                        prev.stylistId === stylist.id &&
                        prev.row === rowIndex
                          ? null
                          : prev
                      );
                    }}
                    style={{ minHeight: ROW_HEIGHT - 2 }}
                  >
                    {hoveredSlot &&
                      hoveredSlot.stylistId === stylist.id &&
                      hoveredSlot.row === rowIndex && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                            background:
                              "linear-gradient(to right, rgba(59,130,246,0.03), transparent)",
                          }}
                        />
                      )}
                    <Link
                      href={`/dashboard/appointments/new?stylistId=${stylist.id}&date=${date}&time=${timeForRow(rowIndex)}`}
                      style={{
                        display: "block",
                        minHeight: ROW_HEIGHT - 2,
                        borderBottom: "1px solid #f0f0f0",
                        background: "transparent",
                        transition: "background 0.15s",
                        position: "relative",
                      }}
                      className="scheduler-slot-hover"
                      title="+ New appointment"
                    >
                      {hoveredSlot &&
                        hoveredSlot.stylistId === stylist.id &&
                        hoveredSlot.row === rowIndex && (
                          <span
                            style={{
                              position: "absolute",
                              left: 8,
                              top: 6,
                              fontSize: 11,
                              color: "#6b7280",
                            }}
                          >
                            + New appointment
                          </span>
                        )}
                    </Link>
                  </div>
                ))}
                {stylistAppointments.map((appt) => {
                  const rowStart = getRowFromStart(appt.start_at);
                  const span = getSpanFromDuration(
                    appt.start_at,
                    appt.end_at,
                    appt.durationMinutes ?? 60
                  );
                  return (
                    <div
                      key={appt.id}
                      style={{
                        position: "absolute",
                        left: 4,
                        right: 4,
                        top: rowStart * (ROW_HEIGHT - 1) + 2,
                        height: span * (ROW_HEIGHT - 1) - 4,
                        zIndex: 1,
                      }}
                    >
                      <AppointmentBlock
                        id={appt.id}
                        clientName={appt.clientName}
                        serviceName={appt.serviceName}
                        timeRange={formatTimeRange(appt.start_at, appt.end_at)}
                        status={appt.status}
                        durationMinutes={appt.durationMinutes}
                        onDragStart={() =>
                          setDragged({
                            id: appt.id,
                            durationMinutes: appt.durationMinutes ?? 60,
                            fromStylistId: appt.stylist_id ?? null,
                          })
                        }
                        onDragEnd={() => {
                          // If drag ends without dropping on a slot, clear state.
                          setDragged(null);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {currentTimeTop != null && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: currentTimeTop,
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          <div
            style={{
              marginLeft: 52,
              borderTop: "1px solid rgba(239,68,68,0.8)",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: -44,
                top: -9,
                fontSize: 10,
                color: "#ef4444",
                background: "#fff",
                padding: "0 4px",
                borderRadius: 999,
                boxShadow: "0 0 0 1px rgba(239,68,68,0.15)",
              }}
            >
              Now
            </span>
          </div>
        </div>
      )}
      {error && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: 24,
            maxWidth: 320,
            background: "#111",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 12,
            fontSize: 13,
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            zIndex: 40,
          }}
        >
          This time slot is not available.
        </div>
      )}
    </div>
  );
}
