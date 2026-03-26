import { newAppointmentHrefFromRebookingContext } from "@/app/lib/rebooking/bookingQuery";

export type OutreachQueueItemType =
  | "appointment_reminder"
  | "due_soon_rebooking"
  | "overdue_outreach";

export type OutreachQueueItem = {
  type: OutreachQueueItemType;
  /** Stable key for React lists */
  key: string;
  clientId: string;
  clientName: string;
  stylistId: string | null;
  stylistName: string | null;
  serviceName: string | null;
  /** Human-readable when / what */
  dateContext: string;
  /** Short staff-facing instruction (decision / support layer — no automations) */
  recommendedAction: string;
  /** True when client is flagged booking-restricted (staff-led booking only) */
  bookingRestricted?: boolean;
  viewClientHref: string;
  /** Book (rebooking) or view existing appointment */
  primaryActionHref: string;
  primaryActionLabel: string;
};

export type OutreachQueueGroup = {
  groupId: "appointment_reminders" | "due_soon_rebooking" | "overdue_outreach";
  title: string;
  /** Optional explainer under the group heading (e.g. date window) */
  subtitle?: string | null;
  items: OutreachQueueItem[];
};

export type OutreachQueueResult = {
  groups: OutreachQueueGroup[];
  /** True if every group is empty */
  isEmpty: boolean;
};

export type ReminderAppointmentRow = {
  id: string;
  client_id: string | null;
  stylist_id: string | null;
  service_id: string | null;
  appointment_date: string;
  start_at: string;
  status: string;
};

export type RebookingQueueClient = {
  id: string;
  name: string;
  lastServiceName: string | null;
  lastServiceId: string | null;
  preferredStylistId: string | null;
  lastCompletedISO: string;
  recommendedNextISO: string;
  daysUntilOrOverdue: number;
  hasVisitMemory: boolean;
  /** From clients.booking_restricted — affects CTA copy only */
  bookingRestricted?: boolean;
};

export type BuildOutreachQueueInput = {
  now: Date;
  reminderAppointments: ReminderAppointmentRow[];
  dueSoon: RebookingQueueClient[];
  overdue: RebookingQueueClient[];
  clientNameById: Map<string, string>;
  stylistNameById: Map<string, string>;
  serviceNameById: Map<string, string>;
};

function rebookingPrimaryCta(
  c: RebookingQueueClient,
  now: Date,
): {
  primaryActionHref: string;
  primaryActionLabel: string;
} {
  if (c.bookingRestricted) {
    return {
      primaryActionHref: `/dashboard/clients/${c.id}`,
      primaryActionLabel: "View client",
    };
  }
  const bookHref = newAppointmentHrefFromRebookingContext({
    clientId: c.id,
    recommendedNextVisitISO: c.recommendedNextISO,
    lastServiceId: c.lastServiceId,
    preferredStylistId: c.preferredStylistId,
    today: now,
  });
  return {
    primaryActionHref: bookHref,
    primaryActionLabel: "Book appointment",
  };
}

function formatApptDateTime(appointmentDate: string, startAt: string): string {
  const day = new Date(appointmentDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const t = new Date(startAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${t}`;
}

/**
 * Builds grouped outreach items for the dashboard. No side effects; no messaging APIs.
 *
 * - **appointment_reminder**: scheduled/confirmed visits on the next two calendar days (tomorrow + day after).
 * - **due_soon_rebooking** / **overdue_outreach**: from rebooking engine status (`computeClientRebookingDecision` pipeline in dashboard summary).
 */
export function buildOutreachQueue(input: BuildOutreachQueueInput): OutreachQueueResult {
  const {
    now,
    reminderAppointments,
    dueSoon,
    overdue,
    clientNameById,
    stylistNameById,
    serviceNameById,
  } = input;

  const reminderItems: OutreachQueueItem[] = [...reminderAppointments]
    .filter((row) => Boolean(row.client_id?.trim()))
    .sort((a, b) => {
      const d = a.appointment_date.localeCompare(b.appointment_date);
      if (d !== 0) return d;
      return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
    })
    .map((row) => {
      const clientId = row.client_id ?? "";
      const clientName = clientId ? clientNameById.get(clientId) ?? "Unknown client" : "Unknown client";
      const stylistName = row.stylist_id ? stylistNameById.get(row.stylist_id) ?? null : null;
      const serviceName = row.service_id ? serviceNameById.get(row.service_id) ?? null : null;
      const ctx = formatApptDateTime(row.appointment_date, row.start_at);
      const stylistBit = stylistName ? ` with ${stylistName}` : "";
      const serviceBit = serviceName ? ` · ${serviceName}` : "";

      return {
        type: "appointment_reminder" as const,
        key: `ar-${row.id}`,
        clientId: clientId || "unknown",
        clientName,
        stylistId: row.stylist_id,
        stylistName,
        serviceName,
        dateContext: ctx,
        recommendedAction: `Confirm or remind${stylistBit}${serviceBit}`,
        viewClientHref: clientId ? `/dashboard/clients/${clientId}` : "/dashboard/clients",
        primaryActionHref: `/dashboard/appointments/${row.id}`,
        primaryActionLabel: "View appointment",
      };
    });

  const dueSoonItems: OutreachQueueItem[] = dueSoon.map((c) => {
    const stylistName = c.preferredStylistId
      ? stylistNameById.get(c.preferredStylistId) ?? null
      : null;
    const cta = rebookingPrimaryCta(c, now);
    const mem = c.hasVisitMemory ? " · visit memory on file" : "";
    const restrict =
      c.bookingRestricted
        ? " · Booking restricted — use staff approval workflow before booking."
        : "";
    return {
      type: "due_soon_rebooking" as const,
      key: `ds-${c.id}`,
      clientId: c.id,
      clientName: c.name,
      stylistId: c.preferredStylistId,
      stylistName,
      serviceName: c.lastServiceName,
      dateContext: `Recommended by ${c.recommendedNextISO} · last visit ${c.lastCompletedISO}${mem}`,
      recommendedAction: `Reach out to book their maintenance / return visit${restrict}`,
      bookingRestricted: Boolean(c.bookingRestricted),
      viewClientHref: `/dashboard/clients/${c.id}`,
      primaryActionHref: cta.primaryActionHref,
      primaryActionLabel: cta.primaryActionLabel,
    };
  });

  const overdueItems: OutreachQueueItem[] = overdue.map((c) => {
    const stylistName = c.preferredStylistId
      ? stylistNameById.get(c.preferredStylistId) ?? null
      : null;
    const cta = rebookingPrimaryCta(c, now);
    const late =
      c.daysUntilOrOverdue < 0
        ? `${Math.abs(c.daysUntilOrOverdue)} day${Math.abs(c.daysUntilOrOverdue) === 1 ? "" : "s"} past recommended date`
        : "Past recommended window";
    const mem = c.hasVisitMemory ? " · visit memory on file" : "";
    const restrict =
      c.bookingRestricted
        ? " · Booking restricted — use staff approval workflow before booking."
        : "";
    return {
      type: "overdue_outreach" as const,
      key: `ov-${c.id}`,
      clientId: c.id,
      clientName: c.name,
      stylistId: c.preferredStylistId,
      stylistName,
      serviceName: c.lastServiceName,
      dateContext: `${late} · last visit ${c.lastCompletedISO}${mem}`,
      recommendedAction: `Priority outreach — win-back or reschedule${restrict}`,
      bookingRestricted: Boolean(c.bookingRestricted),
      viewClientHref: `/dashboard/clients/${c.id}`,
      primaryActionHref: cta.primaryActionHref,
      primaryActionLabel: cta.primaryActionLabel,
    };
  });

  const groups: OutreachQueueGroup[] = [
    {
      groupId: "appointment_reminders",
      title: "Reminder tomorrow",
      subtitle:
        "Scheduled or confirmed visits in the next two calendar days (tomorrow and the day after).",
      items: reminderItems,
    },
    {
      groupId: "due_soon_rebooking",
      title: "Due soon rebook",
      subtitle:
        "Clients whose recommended return date is within the due-soon window (same engine as the rebooking card).",
      items: dueSoonItems,
    },
    {
      groupId: "overdue_outreach",
      title: "Overdue outreach",
      subtitle:
        "Clients past their recommended return date from completed services.",
      items: overdueItems,
    },
  ];

  const isEmpty = groups.every((g) => g.items.length === 0);

  return { groups, isEmpty };
}
