"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { rescheduleCalendarAppointment } from "@/app/actions/calendarReschedule";
import { BOOKING_UNAVAILABLE_MESSAGE } from "@/app/lib/booking/conflicts";
import {
  canDragAppointmentOnCalendar,
  parseCalendarDragPayload,
  type CalendarDragPayload,
} from "@/app/lib/calendar/dragSupport";
import {
  TimeColumn,
  CALENDAR_ROW_HEIGHT,
  CALENDAR_ROW_COUNT,
  CALENDAR_DAY_START,
  CALENDAR_SLOT_MINUTES,
} from "./TimeColumn";
import { AppointmentBlock } from "./AppointmentBlock";
import { formatSchedulerTimeRange } from "@/app/lib/calendar/schedulerData";

const ROW_HEIGHT = CALENDAR_ROW_HEIGHT;

function getRowFromStart(startIso: string): number {
  const d = new Date(startIso);
  const hour = d.getHours();
  const minute = d.getMinutes();
  const row =
    (hour - CALENDAR_DAY_START) * (60 / CALENDAR_SLOT_MINUTES) +
    Math.floor(minute / CALENDAR_SLOT_MINUTES);
  return Math.max(0, Math.min(CALENDAR_ROW_COUNT - 1, row));
}

function getSpanFromDuration(
  startIso: string,
  endIso: string | null,
  fallbackMinutes: number,
): number {
  if (endIso) {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const durationMinutes = (end - start) / (60 * 1000);
    return Math.max(1, Math.ceil(durationMinutes / CALENDAR_SLOT_MINUTES));
  }
  return Math.max(1, Math.ceil(fallbackMinutes / CALENDAR_SLOT_MINUTES));
}

function timeForRow(rowIndex: number): string {
  const totalMinutes =
    CALENDAR_DAY_START * 60 + rowIndex * CALENDAR_SLOT_MINUTES;
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
  /** Resolved hex accent for column header + blocks */
  calendarColor: string;
};

export type AppointmentForScheduler = {
  id: string;
  start_at: string;
  end_at: string | null;
  status: string;
  stylist_id: string | null;
  service_id: string | null;
  clientName: string;
  serviceName: string;
  durationMinutes?: number;
  appointment_date?: string;
  clientNoShowCount?: number;
  stylistCalendarColor?: string;
};

type DaySchedulerProps = {
  date: string;
  stylists: StylistForScheduler[];
  appointments: AppointmentForScheduler[];
};

function slotKey(stylistId: string, row: number) {
  return `${stylistId}:${row}`;
}

export function DayScheduler({ date, stylists, appointments }: DaySchedulerProps) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{
    stylistId: string;
    row: number;
  } | null>(null);
  const [activeDrag, setActiveDrag] = useState(false);
  /** While dragging, other appointment shells get pointer-events:none so drops hit the grid — never the source id. */
  const [draggingAppointmentId, setDraggingAppointmentId] = useState<string | null>(null);
  const [dropHoverKey, setDropHoverKey] = useState<string | null>(null);
  const [dropValid, setDropValid] = useState<boolean | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Payload for the in-flight drag; required because dataTransfer.getData is empty during dragover/dragenter. */
  const dragPayloadRef = useRef<CalendarDragPayload | null>(null);
  /** Dedupes validate-slot calls when dragging across the same slot repeatedly. */
  const lastHoverSlotKeyRef = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isToday = getLocalTodayISO() === date;

  const clearPreviewTimer = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }, []);

  const schedulePreview = useCallback(
    (stylistId: string, row: number, payload: CalendarDragPayload) => {
      clearPreviewTimer();
      const time = timeForRow(row);
      previewTimerRef.current = setTimeout(async () => {
        const q = new URLSearchParams({
          stylistId,
          serviceId: payload.serviceId,
          date,
          time,
          excludeAppointmentId: payload.appointmentId,
        });
        try {
          const res = await fetch(`/api/booking/validate-slot?${q.toString()}`, {
            cache: "no-store",
          });
          const body = (await res.json()) as { ok?: boolean };
          setDropValid(Boolean(body.ok));
        } catch {
          setDropValid(null);
        }
      }, 100);
    },
    [clearPreviewTimer, date],
  );

  useEffect(() => {
    if (!isToday) return;
    setNow(new Date());
    const id = setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const rect = root.getBoundingClientRect();
    const pageTop = window.scrollY + rect.top;

    let targetMinutesFromStart: number;
    if (isToday) {
      const current = new Date();
      const minutes =
        current.getHours() * 60 + current.getMinutes() - CALENDAR_DAY_START * 60;
      targetMinutesFromStart = Math.max(
        0,
        Math.min(CALENDAR_ROW_COUNT * CALENDAR_SLOT_MINUTES, minutes),
      );
    } else {
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

  useEffect(() => () => clearPreviewTimer(), [clearPreviewTimer]);

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

  const endDrag = useCallback(() => {
    dragPayloadRef.current = null;
    lastHoverSlotKeyRef.current = null;
    setActiveDrag(false);
    setDraggingAppointmentId(null);
    setDropHoverKey(null);
    setDropValid(null);
    clearPreviewTimer();
  }, [clearPreviewTimer]);

  const onDragStartAppt = useCallback((appointmentId: string, payload: CalendarDragPayload) => {
    dragPayloadRef.current = payload;
    lastHoverSlotKeyRef.current = null;
    setDraggingAppointmentId(appointmentId);
    setActiveDrag(true);
    setDropHoverKey(null);
    setDropValid(null);
  }, []);

  const handleDragLeaveCell = useCallback((stylistId: string, row: number, e: React.DragEvent) => {
    const key = slotKey(stylistId, row);
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    if (lastHoverSlotKeyRef.current !== key) return;
    lastHoverSlotKeyRef.current = null;
    setDropHoverKey(null);
    setDropValid(null);
    clearPreviewTimer();
  }, [clearPreviewTimer]);

  const handleDragOverCell = useCallback(
    (stylistId: string, row: number, e: React.DragEvent) => {
      const payload = dragPayloadRef.current;
      if (!payload) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = dropValid === false ? "none" : "move";
      const key = slotKey(stylistId, row);
      if (lastHoverSlotKeyRef.current === key) return;
      lastHoverSlotKeyRef.current = key;
      setDropHoverKey(key);
      setDropValid(null);
      schedulePreview(stylistId, row, payload);
    },
    [dropValid, schedulePreview],
  );

  const handleDropCell = useCallback(
    async (stylistId: string, row: number, e: React.DragEvent) => {
      e.preventDefault();
      const payload =
        parseCalendarDragPayload(e.dataTransfer) ?? dragPayloadRef.current;
      if (!payload) {
        endDrag();
        return;
      }
      const time = timeForRow(row);
      setSaving(true);
      setBanner(null);
      const result = await rescheduleCalendarAppointment({
        appointmentId: payload.appointmentId,
        targetDate: date,
        targetTime: time,
        targetStylistId: stylistId,
      });
      setSaving(false);
      endDrag();
      if (!result.ok) {
        setBanner(result.message || BOOKING_UNAVAILABLE_MESSAGE);
        return;
      }
      router.refresh();
    },
    [date, endDrag, router],
  );

  if (stylists.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          background: "#fff",
          border: "1px solid #e5e5e5",
          borderRadius: 16,
          color: "#64748b",
          fontSize: 14,
        }}
      >
        No active stylists to display in columns. Add stylists or adjust filters.
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {banner ? (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: "12px 14px",
            borderRadius: 12,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {banner}
        </div>
      ) : null}
      {saving ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,0.5)",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            color: "#334155",
            borderRadius: 16,
            pointerEvents: "none",
          }}
        >
          Saving…
        </div>
      ) : null}
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
            const stylistAppointments = appointments.filter(
              (a) => a.stylist_id === stylist.id,
            );
            const stylistName =
              `${stylist.first_name ?? ""} ${stylist.last_name ?? ""}`.trim() ||
              "Unnamed";

            return (
              <div
                key={stylist.id}
                style={{
                  flex: 1,
                  minWidth: 140,
                  display: "flex",
                  flexDirection: "column",
                  borderLeft: "1px solid #eee",
                }}
              >
                <div
                  style={{
                    height: ROW_HEIGHT,
                    borderBottom: `3px solid ${stylist.calendarColor}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#111",
                    padding: "0 8px",
                    textAlign: "center",
                    background: "#fafafa",
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
                  {Array.from({ length: CALENDAR_ROW_COUNT }, (_, rowIndex) => {
                    const key = slotKey(stylist.id, rowIndex);
                    const isDropHover = dropHoverKey === key;
                    let slotBg = "transparent";
                    if (!activeDrag && hoveredSlot?.stylistId === stylist.id && hoveredSlot.row === rowIndex) {
                      slotBg = "rgba(59,130,246,0.06)";
                    } else if (activeDrag && isDropHover) {
                      if (dropValid === true) slotBg = "rgba(34,197,94,0.28)";
                      else if (dropValid === false) slotBg = "rgba(239,68,68,0.18)";
                      else slotBg = "rgba(148,163,184,0.14)";
                    }

                    return (
                      <div
                        key={rowIndex}
                        onMouseEnter={() =>
                          setHoveredSlot({ stylistId: stylist.id, row: rowIndex })
                        }
                        onMouseLeave={() => {
                          setHoveredSlot((prev) =>
                            prev &&
                            prev.stylistId === stylist.id &&
                            prev.row === rowIndex
                              ? null
                              : prev,
                          );
                        }}
                        onDragLeave={(e) => handleDragLeaveCell(stylist.id, rowIndex, e)}
                        onDragOver={(e) => handleDragOverCell(stylist.id, rowIndex, e)}
                        onDrop={(e) => handleDropCell(stylist.id, rowIndex, e)}
                        style={{ minHeight: ROW_HEIGHT - 2, position: "relative" }}
                      >
                        <Link
                          href={`/dashboard/appointments/new?stylistId=${encodeURIComponent(stylist.id)}&date=${encodeURIComponent(date)}&time=${encodeURIComponent(timeForRow(rowIndex))}`}
                          style={{
                            display: "block",
                            minHeight: ROW_HEIGHT - 2,
                            borderBottom: "1px solid #f0f0f0",
                            background: slotBg,
                            transition: "background 0.15s",
                            position: "relative",
                            pointerEvents: activeDrag ? "none" : "auto",
                          }}
                          title="New appointment"
                        >
                          {!activeDrag &&
                            hoveredSlot &&
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
                                + Book
                              </span>
                            )}
                          {activeDrag && isDropHover && dropValid === false ? (
                            <span
                              style={{
                                position: "absolute",
                                left: 6,
                                top: 4,
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#b91c1c",
                              }}
                            >
                              Unavailable
                            </span>
                          ) : null}
                          {activeDrag && isDropHover && dropValid === true ? (
                            <span
                              style={{
                                position: "absolute",
                                left: 6,
                                top: 4,
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#166534",
                              }}
                            >
                              Drop here
                            </span>
                          ) : null}
                        </Link>
                      </div>
                    );
                  })}
                  {stylistAppointments.map((appt) => {
                    const rowStart = getRowFromStart(appt.start_at);
                    const span = getSpanFromDuration(
                      appt.start_at,
                      appt.end_at,
                      appt.durationMinutes ?? 60,
                    );
                    const dragPayload: CalendarDragPayload | null =
                      appt.service_id &&
                      appt.stylist_id &&
                      canDragAppointmentOnCalendar(appt.status)
                        ? {
                            appointmentId: appt.id,
                            serviceId: appt.service_id,
                            durationMinutes: appt.durationMinutes ?? 60,
                            stylistId: appt.stylist_id,
                          }
                        : null;

                    const isSourceDrag =
                      activeDrag && draggingAppointmentId === appt.id;
                    const passThroughOtherAppts =
                      activeDrag && draggingAppointmentId !== null && !isSourceDrag;

                    return (
                      <div
                        key={appt.id}
                        style={{
                          position: "absolute",
                          left: 4,
                          right: 4,
                          top: rowStart * (ROW_HEIGHT - 1) + 2,
                          height: span * (ROW_HEIGHT - 1) - 4,
                          zIndex: isSourceDrag ? 15 : 1,
                          pointerEvents: passThroughOtherAppts ? "none" : "auto",
                        }}
                      >
                        <AppointmentBlock
                          id={appt.id}
                          clientName={appt.clientName}
                          serviceName={appt.serviceName}
                          timeRange={formatSchedulerTimeRange(
                            appt.start_at,
                            appt.end_at,
                          )}
                          status={appt.status}
                          stylistCalendarColor={
                            appt.stylistCalendarColor ?? stylist.calendarColor
                          }
                          clientNoShowCount={appt.clientNoShowCount}
                          calendarDrag={dragPayload}
                          onCalendarDragStart={onDragStartAppt}
                          onCalendarDragEnd={endDrag}
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
                borderTop: "1px solid rgba(239,68,68,0.85)",
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
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b" }}>
        Drag the grip on a scheduled appointment to move it. Drops respect hours, blocks, conflicts, and
        stylist eligibility. Click the card (not the grip) to open details.
      </p>
    </div>
  );
}
