/** Appointment statuses that can be drag-rescheduled on the calendar. */
export function canDragAppointmentOnCalendar(status: string | null | undefined): boolean {
  const s = (status || "").trim().toLowerCase();
  return s === "scheduled" || s === "confirmed" || s === "checked_in";
}

export type CalendarDragPayload = {
  appointmentId: string;
  serviceId: string;
  durationMinutes: number;
  /** Current stylist (week view keeps this on drop; day view uses column as target). */
  stylistId: string;
};

export const CALENDAR_DRAG_MIME = "application/x-salon-calendar-appointment";

export function parseCalendarDragPayload(dataTransfer: DataTransfer | null): CalendarDragPayload | null {
  if (!dataTransfer) return null;
  try {
    // On `drop`, custom MIME and/or text/plain may be present. During `dragover`,
    // getData is typically empty — callers must use a ref set at dragstart.
    const raw =
      dataTransfer.getData(CALENDAR_DRAG_MIME) || dataTransfer.getData("text/plain");
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<CalendarDragPayload>;
    if (
      !o.appointmentId ||
      !o.serviceId ||
      typeof o.durationMinutes !== "number" ||
      !o.stylistId
    ) {
      return null;
    }
    return {
      appointmentId: o.appointmentId,
      serviceId: o.serviceId,
      durationMinutes: o.durationMinutes,
      stylistId: o.stylistId,
    };
  } catch {
    return null;
  }
}

export function setCalendarDragPayload(dataTransfer: DataTransfer, payload: CalendarDragPayload): void {
  const json = JSON.stringify(payload);
  dataTransfer.setData(CALENDAR_DRAG_MIME, json);
  dataTransfer.setData("text/plain", json);
  dataTransfer.effectAllowed = "move";
}
