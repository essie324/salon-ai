import { localDateISO } from "@/app/lib/dashboard/dateRanges";
import { appointmentReminderTemplate } from "@/app/lib/outreach/templates";
import type { OutreachQueueBuckets } from "@/app/lib/outreach/followUp";
import type { OutreachQueueItem } from "@/app/lib/outreach/queue";
import type { GapFillSuggestion } from "@/app/lib/scheduling/optimizer";

export type ActionCenterReminderRow = {
  id: string;
  client_id: string | null;
  stylist_id: string | null;
  service_id: string | null;
  appointment_date: string;
  start_at: string;
  status: string;
};

export type ActionCenterItemType = "gap" | "outreach" | "reminder";

export type ActionCenterCta =
  | { kind: "book"; href: string; label: string }
  | { kind: "view_client"; href: string }
  | { kind: "view_appointment"; href: string }
  | { kind: "copy_message"; message: string };

export type ActionCenterItem = {
  id: string;
  category: "revenue" | "outreach" | "reminder";
  type: ActionCenterItemType;
  priorityRank: number;
  sortKey: string;
  clientName: string | null;
  stylistName: string | null;
  timeContext: string;
  description: string;
  ctas: ActionCenterCta[];
};

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

function scheduledForIsOnLocalDay(scheduledFor: string | null | undefined, dayISO: string): boolean {
  if (!scheduledFor) return false;
  return localDateISO(new Date(scheduledFor)) === dayISO;
}

function flattenQueueItems(buckets: OutreachQueueBuckets, which: "needs" | "scheduled"): OutreachQueueItem[] {
  const q = which === "needs" ? buckets.needsAction : buckets.scheduledFollowUp;
  return q.groups.flatMap((g) => g.items);
}

function outreachCtas(item: OutreachQueueItem): ActionCenterCta[] {
  const out: ActionCenterCta[] = [{ kind: "view_client", href: item.viewClientHref }];
  const dup =
    item.primaryActionHref === item.viewClientHref && item.primaryActionLabel === "View Client";
  if (!dup) {
    if (item.type === "appointment_reminder") {
      out.push({ kind: "view_appointment", href: item.primaryActionHref });
    } else {
      out.push({ kind: "book", href: item.primaryActionHref, label: item.primaryActionLabel });
    }
  }
  out.push({ kind: "copy_message", message: item.template.previewText });
  return out;
}

export type BuildTodaysActionCenterInput = {
  todayISO: string;
  tomorrowISO: string;
  gapFillToday: GapFillSuggestion[];
  gapFillTomorrow: GapFillSuggestion[];
  outreachQueue: OutreachQueueBuckets;
  reminderAppointments: ActionCenterReminderRow[];
  clientNameById: Map<string, string>;
  stylistNameById: Map<string, string>;
  serviceNameById: Map<string, string>;
};

const MAX_ITEMS = 28;

/**
 * Builds a single prioritized list for the Action Center. Reuses outreach queue + gap fill outputs;
 * reminder rows are supplied for today + tomorrow (scheduled/confirmed) so “immediate reminders”
 * align with calendar days without re-deriving outreach queue internals.
 *
 * Priority (lower `priorityRank` first):
 * 1. Today’s gap-fill slots (revenue)
 * 2. Tomorrow’s gap-fill slots
 * 3. Overdue retention outreach (from merged queue needs-action bucket)
 * 4. Scheduled follow-ups due today (snoozed to today’s date)
 * 5. Appointment reminders today / next 24h window (today + tomorrow rows)
 * 6. Due-soon retention outreach
 */
export function buildTodaysActionCenter(input: BuildTodaysActionCenterInput): { items: ActionCenterItem[] } {
  const {
    todayISO,
    tomorrowISO,
    gapFillToday,
    gapFillTomorrow,
    outreachQueue,
    reminderAppointments,
    clientNameById,
    stylistNameById,
    serviceNameById,
  } = input;

  const items: ActionCenterItem[] = [];

  for (const g of gapFillToday) {
    const clientName = g.suggestedClient?.name ?? null;
    const stylistName = g.stylist.name;
    const ctas: ActionCenterCta[] = [{ kind: "book", href: g.bookingUrl, label: "Book" }];
    if (g.suggestedClient) {
      ctas.push({ kind: "view_client", href: `/dashboard/clients/${g.suggestedClient.id}` });
    }
    items.push({
      id: `gap-${g.dateISO}-${g.stylist.id}-${g.startTime}-${g.endTime}`,
      category: "revenue",
      type: "gap",
      priorityRank: 1,
      sortKey: `${g.dateISO}T${g.startTime}`,
      clientName,
      stylistName,
      timeContext: `${g.startTime}–${g.endTime} · ${g.durationMinutes}m open`,
      description: g.suggestedService
        ? `Open slot — ${g.suggestedService.name} fits · fill last-minute revenue`
        : "Open slot on the books — book a fill-in",
      ctas,
    });
  }

  for (const g of gapFillTomorrow) {
    const clientName = g.suggestedClient?.name ?? null;
    const stylistName = g.stylist.name;
    const ctas: ActionCenterCta[] = [{ kind: "book", href: g.bookingUrl, label: "Book" }];
    if (g.suggestedClient) {
      ctas.push({ kind: "view_client", href: `/dashboard/clients/${g.suggestedClient.id}` });
    }
    items.push({
      id: `gap-${g.dateISO}-${g.stylist.id}-${g.startTime}-${g.endTime}`,
      category: "revenue",
      type: "gap",
      priorityRank: 2,
      sortKey: `${g.dateISO}T${g.startTime}`,
      clientName,
      stylistName,
      timeContext: `Tomorrow ${g.startTime}–${g.endTime} · ${g.durationMinutes}m open`,
      description: g.suggestedService
        ? `Tomorrow · open slot — ${g.suggestedService.name} suggested`
        : "Tomorrow · open slot — book ahead",
      ctas,
    });
  }

  const needsItems = flattenQueueItems(outreachQueue, "needs");
  for (const item of needsItems) {
    if (item.type === "overdue_outreach") {
      items.push({
        id: `outreach-${item.key}`,
        category: "outreach",
        type: "outreach",
        priorityRank: 3,
        sortKey: `o-${item.clientName}-${item.key}`,
        clientName: item.clientName,
        stylistName: item.stylistName,
        timeContext: item.dateContext,
        description: item.recommendedAction,
        ctas: outreachCtas(item),
      });
    }
  }

  const scheduledItems = flattenQueueItems(outreachQueue, "scheduled");
  for (const item of scheduledItems) {
    const sf = item.followUp?.scheduledFor;
    if (!scheduledForIsOnLocalDay(sf, todayISO)) continue;
    items.push({
      id: `sched-${item.key}`,
      category: "outreach",
      type: "outreach",
      priorityRank: 4,
      sortKey: `s-${item.key}`,
      clientName: item.clientName,
      stylistName: item.stylistName,
      timeContext: item.dateContext,
      description: `Scheduled follow-up due today — ${item.recommendedAction}`,
      ctas: outreachCtas(item),
    });
  }

  const sortedReminders = [...reminderAppointments]
    .filter((r) => Boolean(r.client_id?.trim()))
    .sort((a, b) => {
      const da = a.appointment_date.localeCompare(b.appointment_date);
      if (da !== 0) return da;
      return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
    });

  for (const row of sortedReminders) {
    const clientId = row.client_id ?? "";
    const clientName = clientId ? clientNameById.get(clientId) ?? "Unknown client" : "Unknown client";
    const stylistName = row.stylist_id ? stylistNameById.get(row.stylist_id) ?? null : null;
    const serviceName = row.service_id ? serviceNameById.get(row.service_id) ?? null : null;
    const ctx = formatApptDateTime(row.appointment_date, row.start_at);
    const dayLabel = row.appointment_date === todayISO ? "Today" : "Tomorrow";
    const template = appointmentReminderTemplate({
      clientName,
      serviceName,
      appointmentDateTimeLabel: ctx,
      stylistName,
    });
    const ctas: ActionCenterCta[] = [
      { kind: "view_appointment", href: `/dashboard/appointments/${row.id}` },
      { kind: "view_client", href: `/dashboard/clients/${clientId}` },
      { kind: "copy_message", message: template.previewText },
    ];
    items.push({
      id: `rem-${row.id}`,
      category: "reminder",
      type: "reminder",
      priorityRank: 5,
      sortKey: row.start_at,
      clientName,
      stylistName,
      timeContext: `${dayLabel} · ${ctx}`,
      description: `Confirm or remind — ${row.status === "scheduled" ? "scheduled" : "confirmed"} visit`,
      ctas,
    });
  }

  for (const item of needsItems) {
    if (item.type !== "due_soon_rebooking") continue;
    items.push({
      id: `outreach-${item.key}`,
      category: "outreach",
      type: "outreach",
      priorityRank: 6,
      sortKey: `d-${item.clientName}-${item.key}`,
      clientName: item.clientName,
      stylistName: item.stylistName,
      timeContext: item.dateContext,
      description: item.recommendedAction,
      ctas: outreachCtas(item),
    });
  }

  items.sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
    return a.sortKey.localeCompare(b.sortKey);
  });

  return { items: items.slice(0, MAX_ITEMS) };
}
