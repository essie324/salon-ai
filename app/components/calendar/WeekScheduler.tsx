"use client";

import Link from "next/link";
import {
  CALENDAR_ROW_HEIGHT,
  CALENDAR_ROW_COUNT,
  CALENDAR_DAY_START,
  CALENDAR_SLOT_MINUTES,
} from "./TimeColumn";
import { AppointmentBlock } from "./AppointmentBlock";

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
  clientName: string;
  serviceName: string;
  durationMinutes?: number;
  appointment_date?: string;
};

type WeekSchedulerProps = {
  weekDates: string[];
  appointments: WeekSchedulerAppointment[];
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

export function WeekScheduler({ weekDates, appointments }: WeekSchedulerProps) {
  return (
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
      {/* Simple time gutter for readability */}
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
                {Array.from(
                  { length: CALENDAR_ROW_COUNT },
                  (_, rowIndex) => (
                    <Link
                      key={rowIndex}
                      href={`/dashboard/appointments/new?date=${iso}&time=${timeForRow(
                        rowIndex,
                      )}`}
                      style={{
                        display: "block",
                        minHeight: ROW_HEIGHT - 2,
                        borderBottom: "1px solid #f5f5f5",
                        background: "transparent",
                      }}
                    />
                  ),
                )}
                {dayAppointments.map((appt) => {
                  const rowStart = getRowFromStart(appt.start_at);
                  const span = getSpanFromDuration(
                    appt.start_at,
                    appt.end_at,
                    appt.durationMinutes ?? 60,
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
                        timeRange={new Date(appt.start_at).toLocaleTimeString(
                          "en-US",
                          {
                            hour: "numeric",
                            minute: "2-digit",
                          },
                        )}
                        status={appt.status}
                        durationMinutes={appt.durationMinutes}
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
  );
}

