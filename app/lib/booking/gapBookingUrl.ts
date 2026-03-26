import { normalizeTimeInput } from "@/app/lib/booking/smartSuggestions";

/**
 * Deep link to the new-appointment form for gap-fill / Action Center rows.
 * Does not create an appointment — user submits the form after review.
 *
 * Query params match `DashboardNewAppointmentPage` searchParams:
 * clientId, stylistId, serviceId (optional), date (YYYY-MM-DD), time (HH:MM).
 */
export function buildGapFillBookingUrl(options: {
  stylistId: string;
  dateISO: string;
  timeHHMM: string;
  clientId?: string;
  serviceId?: string;
}): string {
  const params = new URLSearchParams();
  params.set("stylistId", options.stylistId);
  params.set("date", options.dateISO);
  params.set("time", normalizeTimeInput(options.timeHHMM));
  if (options.clientId?.trim()) params.set("clientId", options.clientId.trim());
  if (options.serviceId?.trim()) params.set("serviceId", options.serviceId.trim());
  params.set("gap", "1");
  return `/dashboard/appointments/new?${params.toString()}`;
}
