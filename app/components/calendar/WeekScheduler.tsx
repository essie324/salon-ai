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
  CALENDAR_ROW_HEIGHT,
  CALENDAR_ROW_COUNT,
  CALENDAR_DAY_START,
  CALENDAR_SLOT_MINUTES,
} from "./TimeColumn";
import { AppointmentBlock } from "./AppointmentBlock";
import { formatSchedulerTimeRange } from "@/app/lib/calendar/schedulerData";
import { UNASSIGNED_APPOINTMENT_BLOCK_COLOR } from "@/app/lib/calendar/stylistColors";

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

type WeekSchedulerAppointment = {
  id: string;
  start_at: string;
  end_at: string | null;
  status: string;
  stylist_id: string | null;
  service_id: string | null;
  clientName: string;
  serviceName: string;
  appointment_date?: string;
  durationMinutes?: number;
  stylistCalendarColor?: string;
};

type WeekSchedulerProps = {
  weekDates: string[];
  appointments: WeekSchedulerAppointment[];
  /** When set (e.g. dashboard filter), empty-slot links prefill stylist on new appointment. */
  prefillStylistId?: string;
};

function formatDayLabel(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const TODAY_ISO = (() => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
})();

function weekSlotKey(dayIso: string, row: number) {
  return `${dayIso}:${row}`;
}

export function WeekScheduler({
  weekDates,
  appointments,
  prefillStylistId,
}: WeekSchedulerProps) {
  const router = useRouter();
  const [activeDrag, setActiveDrag] = useState(false);
  const [draggingAppointmentId, setDraggingAppointmentId] = useState<string | null>(null);
  const [dropHoverKey, setDropHoverKey] = useState<string | null>(null);
  const [dropValid, setDropValid] = useState<boolean | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragPayloadRef = useRef<CalendarDragPayload | null>(null);
  const lastHoverSlotKeyRef = useRef<string | null>(null);

  const clearPreviewTimer = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearPreviewTimer(), [clearPreviewTimer]);

  const schedulePreview = useCallback(
    (dayIso: string, row: number, payload: CalendarDragPayload) => {
      clearPreviewTimer();
      const time = timeForRow(row);
      previewTimerRef.current = setTimeout(async () => {
        const q = new URLSearchParams({
          stylistId: payload.stylistId,
          serviceId: payload.serviceId,
          date: dayIso,
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
    [clearPreviewTimer],
  );

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

  const handleDragLeaveCell = useCallback(
    (dayIso: string, row: number, e: React.DragEvent) => {
      const key = weekSlotKey(dayIso, row);
      const next = e.relatedTarget as Node | null;
      if (next && e.currentTarget.contains(next)) return;
      if (lastHoverSlotKeyRef.current !== key) return;
      lastHoverSlotKeyRef.current = null;
      setDropHoverKey(null);
      setDropValid(null);
      clearPreviewTimer();
    },
    [clearPreviewTimer],
  );

  const handleDragOverCell = useCallback(
    (dayIso: string, row: number, e: React.DragEvent) => {
      const payload = dragPayloadRef.current;
      if (!payload) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = dropValid === false ? "none" : "move";
      const key = weekSlotKey(dayIso, row);
      if (lastHoverSlotKeyRef.current === key) return;
      lastHoverSlotKeyRef.current = key;
      setDropHoverKey(key);
      setDropValid(null);
      schedulePreview(dayIso, row, payload);
    },
    [dropValid, schedulePreview],
  );

  const handleDropCell = useCallback(
    async (dayIso: string, row: number, e: React.DragEvent) => {
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
        targetDate: dayIso,
        targetTime: time,
        targetStylistId: payload.stylistId,
      });
      setSaving(false);
      endDrag();
      if (!result.ok) {
        setBanner(result.message || BOOKING_UNAVAILABLE_MESSAGE);
        return;
      }
      router.refresh();
    },
    [endDrag, router],
  );

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
        style={{
          display: "flex",
          gap: 0,
          overflowX: "auto",
          background: "#fff",
          border: "1px solid #e5e5e5",
          borderRadius: 16,
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 56,
            flexShrink: 0,
            borderRight: "1px solid #eee",
          }}
        >
          <div
            style={{
              height: ROW_HEIGHT,
              borderBottom: "1px solid #eee",
              display: "flex",
              alignItems: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#888",
              paddingRight: 8,
              justifyContent: "flex-end",
            }}
          >
            Time
          </div>
          {Array.from({ length: CALENDAR_ROW_COUNT }, (_, rowIndex) => (
            <div
              key={rowIndex}
              style={{
                height: ROW_HEIGHT - 1,
                borderBottom: "1px solid #f3f3f3",
                display: "flex",
                alignItems: "center",
                fontSize: 11,
                color: "#888",
                paddingRight: 8,
                justifyContent: "flex-end",
              }}
            >
              {rowIndex % 2 === 0 ? timeForRow(rowIndex) : ""}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
          {weekDates.map((iso) => {
            const dayAppointments = appointments.filter(
              (a) => a.appointment_date === iso,
            );
            const isToday = iso === TODAY_ISO;

            return (
              <div
                key={iso}
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
                    borderBottom: "1px solid #eee",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: isToday ? "#0b57d0" : "#111",
                    padding: "0 6px",
                    textAlign: "center",
                    background: isToday ? "#eef6ff" : "#fafafa",
                  }}
                >
                  {formatDayLabel(iso)}
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
                    const key = weekSlotKey(iso, rowIndex);
                    const isDropHover = dropHoverKey === key;
                    let slotBg = "transparent";
                    if (activeDrag && isDropHover) {
                      if (dropValid === true) slotBg = "rgba(34,197,94,0.28)";
                      else if (dropValid === false) slotBg = "rgba(239,68,68,0.18)";
                      else slotBg = "rgba(148,163,184,0.14)";
                    }

                    return (
                      <div
                        key={rowIndex}
                        onDragLeave={(e) => handleDragLeaveCell(iso, rowIndex, e)}
                        onDragOver={(e) => handleDragOverCell(iso, rowIndex, e)}
                        onDrop={(e) => handleDropCell(iso, rowIndex, e)}
                        style={{ minHeight: ROW_HEIGHT - 2, position: "relative" }}
                      >
                        <Link
                          href={`/dashboard/appointments/new?date=${encodeURIComponent(iso)}&time=${encodeURIComponent(timeForRow(rowIndex))}${prefillStylistId ? `&stylistId=${encodeURIComponent(prefillStylistId)}` : ""}`}
                          style={{
                            display: "block",
                            minHeight: ROW_HEIGHT - 2,
                            borderBottom: "1px solid #f5f5f5",
                            background: slotBg,
                            transition: "background 0.15s",
                            position: "relative",
                            pointerEvents: activeDrag ? "none" : "auto",
                          }}
                        />
                        {activeDrag && isDropHover && dropValid === false ? (
                          <span
                            style={{
                              position: "absolute",
                              left: 4,
                              top: 2,
                              fontSize: 9,
                              fontWeight: 700,
                              color: "#b91c1c",
                              pointerEvents: "none",
                            }}
                          >
                            No
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  {dayAppointments.map((appt) => {
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
                            appt.stylistCalendarColor ?? UNASSIGNED_APPOINTMENT_BLOCK_COLOR
                          }
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
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b" }}>
        Week view: drag the grip to move to another day or time (same stylist). Validation matches day view.
      </p>
    </div>
  );
}
