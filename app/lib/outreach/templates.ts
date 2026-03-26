/**
 * Outreach message templates — copy previews only. No SMS/email sending.
 * Shared by the dashboard queue and client profile so logic stays in one place.
 */

export type OutreachTemplatePreview = {
  internalLabel: string;
  previewText: string;
  shortActionLabel: string;
};

function formatIsoDate(iso: string): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function firstName(clientName: string): string {
  const t = clientName.trim();
  if (!t) return "there";
  return t.split(/\s+/)[0] ?? t;
}

export function appointmentReminderTemplate(input: {
  clientName: string;
  serviceName: string | null;
  appointmentDateTimeLabel: string;
  stylistName: string | null;
}): OutreachTemplatePreview {
  const fn = firstName(input.clientName);
  const service = input.serviceName?.trim() || "your appointment";
  const stylist = input.stylistName?.trim()
    ? ` with ${input.stylistName.trim()}`
    : "";
  return {
    internalLabel: "Appointment reminder",
    previewText: `Hi ${fn}, quick reminder — you have ${service} on ${input.appointmentDateTimeLabel}${stylist}. Reply to confirm or call us if you need to reschedule. Thanks!`,
    shortActionLabel: "Send reminder",
  };
}

export type RebookingTemplateInput = {
  clientName: string;
  serviceName: string | null;
  recommendedNextVisitISO: string;
  lastCompletedISO: string;
  stylistName: string | null;
  daysUntilOrOverdue: number;
  bookingRestricted: boolean;
};

export function dueSoonRebookingTemplate(input: RebookingTemplateInput): OutreachTemplatePreview {
  const fn = firstName(input.clientName);
  const service = input.serviceName?.trim() || "your next visit";
  const by = formatIsoDate(input.recommendedNextVisitISO);
  const stylistLine = input.stylistName?.trim()
    ? ` ${input.stylistName.trim()} would love to see you again.`
    : " We'd love to get you back on the calendar.";
  const restrict = input.bookingRestricted
    ? " Please call the salon to schedule — booking needs staff approval."
    : "";
  return {
    internalLabel: "Due soon — rebook",
    previewText: `Hi ${fn}, it's a good time to book ${service} — we recommend visiting by ${by}.${stylistLine}${restrict}`,
    shortActionLabel: "Reach out to book",
  };
}

export function overdueOutreachTemplate(input: RebookingTemplateInput): OutreachTemplatePreview {
  const fn = firstName(input.clientName);
  const service = input.serviceName?.trim() || "your care";
  const lastVisit = formatIsoDate(input.lastCompletedISO);
  const by = formatIsoDate(input.recommendedNextVisitISO);
  const restrict = input.bookingRestricted
    ? " Please call the salon to book — we'll help you."
    : "";
  return {
    internalLabel: "Overdue — win-back",
    previewText: `Hi ${fn}, we miss you! Your last visit was ${lastVisit}. Let's get you back on the books — we suggest ${service} by ${by}.${restrict}`,
    shortActionLabel: "Priority follow-up",
  };
}

export function rebookingOutreachTemplateForStatus(
  status: "due_soon" | "overdue",
  input: RebookingTemplateInput,
): OutreachTemplatePreview {
  if (status === "overdue") return overdueOutreachTemplate(input);
  return dueSoonRebookingTemplate(input);
}
