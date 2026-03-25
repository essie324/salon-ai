import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import {
  validateBookingSlot,
  BOOKING_UNAVAILABLE_MESSAGE,
} from "@/app/lib/booking/conflicts";
import {
  getSuggestedTimeSlots,
  getAlternateStylistSuggestions,
  formatSuggestionsTry,
  formatAlternateStylists,
} from "@/app/lib/stylistAvailability";
import { isStylistEligibleForService } from "@/app/lib/stylistServiceEligibility";
import { determineConsultationRouting } from "@/app/lib/booking/consultationRouting";
import { computeDepositPolicy } from "@/app/lib/booking/depositRules";
import { parsePhotoUrlsInput, photoUrlsToTextareaValue } from "@/app/lib/visitMemory";
import { BookingSlotValidationClient } from "../../../../components/booking/BookingSlotValidationClient";

async function updateAppointment(id: string, formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const client_id = String(formData.get("client_id") || "").trim();
  const service_id = String(formData.get("service_id") || "").trim();
  const stylist_id = String(formData.get("stylist_id") || "").trim();
  const appointment_date = String(formData.get("appointment_date") || "").trim();
  const appointment_time = String(formData.get("appointment_time") || "").trim();
  const status = String(formData.get("status") || "scheduled").trim();
  const notes = String(formData.get("notes") || "").trim();
  const cancellation_note =
    status === "cancelled"
      ? String(formData.get("cancellation_note") || "").trim() || null
      : null;

  const rawPrice = String(formData.get("appointment_price") || "").trim();
  const rawTip = String(formData.get("tip_amount") || "").trim();
  const payment_status = String(formData.get("payment_status") || "").trim() || "unpaid";

  const formula_notes = String(formData.get("formula_notes") || "").trim() || null;
  const developer_notes = String(formData.get("developer_notes") || "").trim() || null;
  const technique_notes = String(formData.get("technique_notes") || "").trim() || null;
  const processing_notes = String(formData.get("processing_notes") || "").trim() || null;
  const aftercare_notes = String(formData.get("aftercare_notes") || "").trim() || null;
  const photo_urls = parsePhotoUrlsInput(String(formData.get("photo_urls") || ""));

  const appointment_price_cents =
    rawPrice && !Number.isNaN(Number(rawPrice))
      ? Math.round(parseFloat(rawPrice) * 100)
      : null;
  const tip_cents =
    rawTip && !Number.isNaN(Number(rawTip))
      ? Math.round(parseFloat(rawTip) * 100)
      : 0;

  if (!client_id || !service_id || !stylist_id || !appointment_date || !appointment_time) {
    return;
  }

  const { data: clientRow } = await supabase
    .from("clients")
    .select("no_show_count, deposit_required, booking_restricted, restriction_note")
    .eq("id", client_id)
    .maybeSingle();
  const policy = computeDepositPolicy(clientRow as any);
  if (policy.bookingRestricted) {
    redirect(
      `/dashboard/appointments/${id}/edit?error=restricted&message=${encodeURIComponent(
        policy.restrictionMessage ??
          "This client is currently restricted from booking due to repeated no-shows."
      )}`,
    );
  }

  const { data: serviceRow } = await supabase
    .from("services")
    .select("name, duration_minutes")
    .eq("id", service_id)
    .maybeSingle();

  const routing = determineConsultationRouting({
    serviceName: (serviceRow as { name?: string } | null)?.name ?? null,
    intakeNotes: notes,
  });

  if (routing.requiresConsultation) {
    redirect(
      `/dashboard/appointments/${id}/edit?error=consultation&message=${encodeURIComponent(
        routing.message ??
          "This request looks like it should begin with a consultation before booking the full service."
      )}`,
    );
  }

  const eligible = await isStylistEligibleForService(supabase, stylist_id, service_id);
  if (!eligible) {
    redirect(
      `/dashboard/appointments/${id}/edit?error=eligibility&message=${encodeURIComponent(
        "The selected stylist is not assigned to perform this service. Please choose a different stylist or service, or update the stylist's services in Stylists."
      )}`
    );
  }

  const durationMinutes =
    serviceRow != null && (serviceRow as { duration_minutes?: number }).duration_minutes != null
      ? Number((serviceRow as { duration_minutes: number }).duration_minutes)
      : 60;

  const startAtLocal = new Date(`${appointment_date}T${appointment_time}`);
  const start_at = startAtLocal.toISOString();
  const end_at = new Date(
    startAtLocal.getTime() + durationMinutes * 60 * 1000
  ).toISOString();

  const slotCheck = await validateBookingSlot(supabase, {
    stylistId: stylist_id,
    startAt: start_at,
    endAt: end_at,
    excludeAppointmentId: id,
    serviceId: service_id,
  });

  if (!slotCheck.ok) {
    const [suggestions, { alternates }] = await Promise.all([
      getSuggestedTimeSlots(supabase, {
        stylist_id,
        appointment_date,
        durationMinutes,
        excludeAppointmentId: id,
      }),
      getAlternateStylistSuggestions(supabase, {
        appointment_date,
        appointment_time,
        durationMinutes,
        selectedStylistId: stylist_id,
        service_id,
        excludeAppointmentId: id,
      }),
    ]);
    let message =
      BOOKING_UNAVAILABLE_MESSAGE +
      (suggestions.length > 0 ? " " + formatSuggestionsTry(suggestions) : "");
    if (alternates.length > 0) {
      message += " Available alternatives: " + formatAlternateStylists(alternates) + ".";
    }
    redirect(
      `/dashboard/appointments/${id}/edit?error=slot&message=${encodeURIComponent(message)}`
    );
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      client_id,
      service_id,
      stylist_id,
      start_at,
      end_at,
      appointment_date,
      appointment_time,
      status,
      notes: notes || null,
      cancellation_note,
      appointment_price_cents,
      tip_cents,
      payment_status,
      deposit_required: policy.depositRequired,
      deposit_amount_cents: policy.depositRequired ? policy.depositAmountCents : null,
      deposit_status: policy.depositRequired ? policy.depositStatus : "not_required",
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  // Visit memory (upsert one row per appointment)
  const memoryHasAny =
    (formula_notes ?? "").trim().length > 0 ||
    (developer_notes ?? "").trim().length > 0 ||
    (technique_notes ?? "").trim().length > 0 ||
    (processing_notes ?? "").trim().length > 0 ||
    (aftercare_notes ?? "").trim().length > 0 ||
    (photo_urls ?? []).length > 0;

  if (memoryHasAny) {
    const { error: memoryError } = await supabase
      .from("appointment_memories")
      .upsert(
        {
          appointment_id: id,
          formula_notes,
          developer_notes,
          technique_notes,
          processing_notes,
          aftercare_notes,
          photo_urls,
        },
        { onConflict: "appointment_id" },
      );
    if (memoryError) throw new Error(memoryError.message);
  } else {
    await supabase.from("appointment_memories").delete().eq("appointment_id", id);
  }

  redirect(`/dashboard/appointments/${id}`);
}

type Appointment = {
  id: string;
  start_at: string;
  end_at: string | null;
  status: string;
  notes: string | null;
  cancellation_note: string | null;
  client_id: string | null;
  service_id: string | null;
  stylist_id: string | null;
  appointment_price_cents?: number | null;
  tip_cents?: number | null;
  payment_status?: string | null;
};

function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

function toTimeInputValue(iso: string): string {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 5);
}

export default async function DashboardAppointmentEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; message?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { id } = await params;
  const resolvedSearch = await searchParams;
  const showConflictError = resolvedSearch?.error === "conflict";
  const showAvailabilityError = resolvedSearch?.error === "availability";
  const showSlotError = resolvedSearch?.error === "slot";
  const showEligibilityError = resolvedSearch?.error === "eligibility";
  const showConsultationError = resolvedSearch?.error === "consultation";
  const showRestrictedError = resolvedSearch?.error === "restricted";
  const conflictMessage =
    resolvedSearch?.error === "conflict" && resolvedSearch?.message
      ? resolvedSearch.message
      : BOOKING_UNAVAILABLE_MESSAGE;
  const availabilityMessage =
    resolvedSearch?.error === "availability" && resolvedSearch?.message
      ? resolvedSearch.message
      : BOOKING_UNAVAILABLE_MESSAGE;
  const slotMessage =
    resolvedSearch?.error === "slot" && resolvedSearch?.message
      ? resolvedSearch.message
      : BOOKING_UNAVAILABLE_MESSAGE;
  const eligibilityMessage =
    resolvedSearch?.error === "eligibility" && resolvedSearch?.message
      ? resolvedSearch.message
      : "The selected stylist is not assigned to perform this service.";
  const consultationMessage =
    resolvedSearch?.error === "consultation" && resolvedSearch?.message
      ? resolvedSearch.message
      : "This request looks like it should begin with a consultation before booking the full service.";
  const restrictedMessage =
    resolvedSearch?.error === "restricted" && resolvedSearch?.message
      ? resolvedSearch.message
      : "This client is currently restricted from booking due to repeated no-shows.";

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, start_at, end_at, status, notes, cancellation_note, client_id, service_id, stylist_id, appointment_price_cents, tip_cents, payment_status")
    .eq("id", id)
    .maybeSingle();

  if (appointmentError) {
    return (
      <div style={mainStyle}>
        <Link href="/dashboard/appointments" style={backLinkStyle}>
          ← Back to Appointments
        </Link>
        <div style={errorBoxStyle}>
          Error loading appointment: {appointmentError.message}
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div style={mainStyle}>
        <Link href="/dashboard/appointments" style={backLinkStyle}>
          ← Back to Appointments
        </Link>
        <div style={cardStyle}>
          <h1 style={{ marginTop: 0 }}>Appointment not found</h1>
          <p>This appointment does not exist or may have been removed.</p>
        </div>
      </div>
    );
  }

  const appt = appointment as Appointment;

  const [
    { data: clients },
    { data: services },
    { data: stylists },
    { data: memory },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, first_name, last_name")
      .order("first_name", { ascending: true }),
    supabase
      .from("services")
      .select("id, name, duration_minutes, price_cents")
      .order("name", { ascending: true }),
    supabase
      .from("stylists")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("first_name", { ascending: true }),
    supabase
      .from("appointment_memories")
      .select("formula_notes, developer_notes, technique_notes, processing_notes, aftercare_notes, photo_urls")
      .eq("appointment_id", id)
      .maybeSingle(),
  ]);

  const clientList = clients ?? [];
  const serviceList = services ?? [];
  const stylistList = stylists ?? [];

  return (
    <div style={mainStyle}>
      <div style={headerRowStyle}>
        <div>
          <Link
            href={`/dashboard/appointments/${id}`}
            style={backLinkStyle}
          >
            ← Back to Appointment
          </Link>
          <h1 style={titleStyle}>Edit Appointment</h1>
          <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
            Reschedule or update booking details.
          </p>
        </div>
      </div>

      {showConflictError ? (
        <div
          style={{
            marginBottom: 18,
            padding: "14px 18px",
            borderRadius: 12,
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {conflictMessage}
        </div>
      ) : null}

      {showAvailabilityError ? (
        <div
          style={{
            marginBottom: 18,
            padding: "14px 18px",
            borderRadius: 12,
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {availabilityMessage}
        </div>
      ) : null}

      {showSlotError ? (
        <div
          style={{
            marginBottom: 18,
            padding: "14px 18px",
            borderRadius: 12,
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {slotMessage}
        </div>
      ) : null}

      {showConsultationError ? (
        <div
          style={{
            marginBottom: 18,
            padding: "14px 18px",
            borderRadius: 12,
            background: "#eff6ff",
            color: "#1d4ed8",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {consultationMessage}
        </div>
      ) : null}

      {showRestrictedError ? (
        <div
          style={{
            marginBottom: 18,
            padding: "14px 18px",
            borderRadius: 12,
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {restrictedMessage}
        </div>
      ) : null}

      {showEligibilityError ? (
        <div
          style={{
            marginBottom: 18,
            padding: "14px 18px",
            borderRadius: 12,
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {eligibilityMessage}
        </div>
      ) : null}

      <form
        id="edit-appointment-form"
        action={updateAppointment.bind(null, id)}
        style={{
          ...cardStyle,
          display: "grid",
          gap: 18,
          maxWidth: 560,
        }}
      >
        <div>
          <label htmlFor="client_id" style={labelStyle}>
            Client
          </label>
          <select
            id="client_id"
            name="client_id"
            required
            style={inputStyle}
            defaultValue={appt.client_id ?? ""}
          >
            <option value="" disabled>
              Select a client
            </option>
            {clientList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name ?? ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="service_id" style={labelStyle}>
            Service
          </label>
          <select
            id="service_id"
            name="service_id"
            required
            style={inputStyle}
            defaultValue={appt.service_id ?? ""}
          >
            <option value="" disabled>
              Select a service
            </option>
            {serviceList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.duration_minutes ?? "—"} min —{" "}
                {s.price_cents != null
                  ? `$${(s.price_cents / 100).toFixed(2)}`
                  : "—"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="stylist_id" style={labelStyle}>
            Stylist
          </label>
          <select
            id="stylist_id"
            name="stylist_id"
            required
            style={inputStyle}
            defaultValue={appt.stylist_id ?? ""}
          >
            <option value="" disabled>
              Select a stylist
            </option>
            {stylistList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name ?? ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label htmlFor="appointment_date" style={labelStyle}>
              Date
            </label>
            <input
              id="appointment_date"
              name="appointment_date"
              type="date"
              required
              style={inputStyle}
              defaultValue={toDateInputValue(appt.start_at)}
            />
          </div>
          <div>
            <label htmlFor="appointment_time" style={labelStyle}>
              Time
            </label>
            <input
              id="appointment_time"
              name="appointment_time"
              type="time"
              required
              style={inputStyle}
              defaultValue={toTimeInputValue(appt.start_at)}
            />
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#666" }}>
              Availability is checked against service duration, stylist hours, blocked time, and existing bookings.
            </p>
          </div>
        </div>

        <Suspense fallback={null}>
          <BookingSlotValidationClient formId="edit-appointment-form" excludeAppointmentId={id} />
        </Suspense>

        <div>
          <label htmlFor="status" style={labelStyle}>
            Status
          </label>
          <select
            id="status"
            name="status"
            style={inputStyle}
            defaultValue={appt.status}
          >
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </select>
        </div>

        <div>
          <label htmlFor="cancellation_note" style={labelStyle}>
            Cancellation reason (optional, when status is Cancelled)
          </label>
          <textarea
            id="cancellation_note"
            name="cancellation_note"
            rows={2}
            placeholder="e.g. Client requested to reschedule"
            style={{ ...inputStyle, resize: "vertical", minHeight: 56 }}
            defaultValue={appt.cancellation_note ?? ""}
          />
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0", fontSize: 14 }}>Payment</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label htmlFor="appointment_price" style={labelStyle}>
                Service Price
              </label>
              <input
                id="appointment_price"
                name="appointment_price"
                type="number"
                min="0"
                step="0.01"
                style={inputStyle}
                defaultValue={
                  appt.appointment_price_cents != null
                    ? (appt.appointment_price_cents / 100).toFixed(2)
                    : ""
                }
                placeholder="e.g. 150.00"
              />
            </div>
            <div>
              <label htmlFor="tip_amount" style={labelStyle}>
                Tip (optional)
              </label>
              <input
                id="tip_amount"
                name="tip_amount"
                type="number"
                min="0"
                step="0.01"
                style={inputStyle}
                defaultValue={
                  appt.tip_cents != null ? (appt.tip_cents / 100).toFixed(2) : ""
                }
                placeholder="e.g. 30.00"
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label htmlFor="payment_status" style={labelStyle}>
              Payment Status
            </label>
            <select
              id="payment_status"
              name="payment_status"
              style={inputStyle}
              defaultValue={appt.payment_status ?? "unpaid"}
            >
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
              <option value="comped">Comped</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="notes" style={labelStyle}>
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
            defaultValue={appt.notes ?? ""}
          />
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid #e5e5e5",
            background: "#fafafa",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
            Visit Memory
          </div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>
            Formula + technique notes for future reference. Photos are URL-based for now (Storage-ready).
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label htmlFor="formula_notes" style={labelStyle}>
                Formula notes
              </label>
              <textarea
                id="formula_notes"
                name="formula_notes"
                rows={4}
                style={{ ...inputStyle, resize: "vertical", minHeight: 110 }}
                defaultValue={(memory as any)?.formula_notes ?? ""}
                placeholder="Example: Root: 6N + 6.1 (1:1) · Ends: 8V + clear gloss (1:2) · 20 min"
              />
            </div>

            <div>
              <label htmlFor="developer_notes" style={labelStyle}>
                Developer notes
              </label>
              <textarea
                id="developer_notes"
                name="developer_notes"
                rows={3}
                style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
                defaultValue={(memory as any)?.developer_notes ?? ""}
                placeholder="Example: 20 vol on mids only · 10 vol toner"
              />
            </div>

            <div>
              <label htmlFor="technique_notes" style={labelStyle}>
                Technique notes
              </label>
              <textarea
                id="technique_notes"
                name="technique_notes"
                rows={3}
                style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
                defaultValue={(memory as any)?.technique_notes ?? ""}
                placeholder="Example: Babylights + face frame · Teasy-lights · Shadow root"
              />
            </div>

            <div>
              <label htmlFor="processing_notes" style={labelStyle}>
                Processing notes
              </label>
              <textarea
                id="processing_notes"
                name="processing_notes"
                rows={3}
                style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
                defaultValue={(memory as any)?.processing_notes ?? ""}
                placeholder="Example: Lifted to pale yellow in 35 min · Check every 10 min"
              />
            </div>

            <div>
              <label htmlFor="aftercare_notes" style={labelStyle}>
                Aftercare notes
              </label>
              <textarea
                id="aftercare_notes"
                name="aftercare_notes"
                rows={3}
                style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
                defaultValue={(memory as any)?.aftercare_notes ?? ""}
                placeholder="Example: Purple shampoo 1×/week · Heat protectant · Next visit in 8 weeks"
              />
            </div>

            <div>
              <label htmlFor="photo_urls" style={labelStyle}>
                Photo URLs (one per line)
              </label>
              <textarea
                id="photo_urls"
                name="photo_urls"
                rows={3}
                style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
                defaultValue={photoUrlsToTextareaValue((memory as any)?.photo_urls ?? null)}
                placeholder="https://... (paste one per line)"
              />
              <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                Later upgrade: replace this field with Supabase Storage uploads.
              </div>
            </div>
          </div>
        </div>

        <button type="submit" style={submitButtonStyle}>
          Save Changes
        </button>
      </form>
    </div>
  );
}

const mainStyle: React.CSSProperties = {
  maxWidth: 720,
};

const headerRowStyle: React.CSSProperties = {
  marginBottom: 24,
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.75rem",
  margin: "8px 0 4px 0",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 18,
  padding: 24,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
};

const backLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "#111",
  fontWeight: 700,
  fontSize: 14,
};

const errorBoxStyle: React.CSSProperties = {
  background: "#ffe5e5",
  color: "#900",
  padding: 16,
  borderRadius: 12,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontWeight: 700,
  fontSize: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #d8d8d8",
  fontSize: 14,
  background: "#fff",
  color: "#111",
  boxSizing: "border-box",
};

const submitButtonStyle: React.CSSProperties = {
  padding: "14px 18px",
  borderRadius: 12,
  border: "none",
  background: "#111",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
};
