import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { FEATURE_INBOX_AND_INTAKE_DB } from "@/app/lib/featureFlags";
import { linkIntakeSessionToAppointment } from "@/app/lib/intake/linkIntakeToAppointment";
import {
  intakeRowToDecisionInput,
  mapIntakeToRecommendation,
} from "@/app/lib/ai/mapIntakeToRecommendation";
import type { IntakeRecommendation } from "@/app/lib/ai/decisionEngine";

type SearchParams = {
  clientId?: string;
  stylistId?: string;
  serviceId?: string;
  date?: string;
  time?: string;
  error?: string;
  message?: string;
  /** "1" — arrived from rebooking CTA; show context panel when client matches */
  rebook?: string;
  /** Prefill optional linked intake session (from guest intake flow). */
  intakeSessionId?: string;
  /** From intake guidance: pre-check consultation when "1". */
  consultationHint?: string;
  /** book_now | consultation_required | manual_review — from intake guidance. */
  intakeDecision?: string;
};

type Client = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_stylist_id?: string | null;
};

type Service = {
  id: string;
  name: string | null;
  duration_minutes: number | null;
  price_cents: number | null;
};

type Stylist = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
};

async function createAppointment(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();

  const client_id = String(formData.get("client_id") || "").trim();
  const service_id = String(formData.get("service_id") || "").trim();
  const stylist_id = String(formData.get("stylist_id") || "").trim();
  const appointment_date = String(formData.get("appointment_date") || "").trim();
  const appointment_time = String(formData.get("appointment_time") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const service_goal = String(formData.get("service_goal") || "").trim();
  const intake_notes = String(formData.get("intake_notes") || "").trim();
  const consultation_required = formData.get("consultation_required") === "on";
  const intake_session_id_raw = String(formData.get("intake_session_id") || "").trim();

  if (!client_id || !service_id || !stylist_id || !appointment_date || !appointment_time) {
    throw new Error("Missing required appointment fields.");
  }

  let intake_session_id: string | null = null;
  if (FEATURE_INBOX_AND_INTAKE_DB && intake_session_id_raw) {
    const { data: intake, error: intakeErr } = await supabase
      .from("intake_sessions")
      .select("id, client_id, appointment_id")
      .eq("id", intake_session_id_raw)
      .maybeSingle();

    if (intakeErr) throw new Error(intakeErr.message);
    if (!intake) throw new Error("Intake session not found.");
    if (intake.appointment_id) throw new Error("That intake is already linked to an appointment.");
    if (intake.client_id && intake.client_id !== client_id) {
      throw new Error("Selected intake belongs to a different client.");
    }
    intake_session_id = intake_session_id_raw;
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, duration_minutes")
    .eq("id", service_id)
    .maybeSingle();

  if (serviceError) {
    throw new Error(serviceError.message);
  }

  const durationMinutes = service?.duration_minutes ?? 60;

  const startAtLocal = new Date(`${appointment_date}T${appointment_time}`);
  const start_at = startAtLocal.toISOString();
  const end_at = new Date(
    startAtLocal.getTime() + durationMinutes * 60 * 1000
  ).toISOString();

  const insertRow: Record<string, unknown> = {
    client_id,
    service_id,
    stylist_id,
    appointment_date,
    appointment_time,
    start_at,
    end_at,
    status: "scheduled",
    notes: notes || null,
    service_goal: service_goal || null,
    intake_notes: intake_notes || null,
    consultation_required,
  };
  if (intake_session_id) {
    insertRow.intake_session_id = intake_session_id;
  }

  const { data: created, error } = await supabase
    .from("appointments")
    .insert(insertRow)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (intake_session_id && created?.id) {
    const { error: linkErr } = await linkIntakeSessionToAppointment({
      supabase,
      appointmentId: created.id,
      intakeSessionId: intake_session_id,
      clientId: client_id,
    });
    if (linkErr) throw linkErr;
  }

  redirect(`/dashboard/appointments?date=${appointment_date}`);
}

function stylistDisplayName(s: Stylist) {
  return `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Stylist";
}

export default async function DashboardNewAppointmentPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();

  const intakeSessionsQuery = FEATURE_INBOX_AND_INTAKE_DB
    ? supabase
        .from("intake_sessions")
        .select(
          "id, client_id, requested_service, requested_stylist, timing_preference, budget_notes, concern_notes, ai_summary, created_at",
        )
        .is("appointment_id", null)
        .order("created_at", { ascending: false })
        .limit(80)
    : Promise.resolve({ data: [] as unknown[], error: null as null });

  const [
    { data: clientsData, error: clientsError },
    { data: servicesData, error: servicesError },
    { data: stylistsData, error: stylistsError },
    intakeRes,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone, preferred_stylist_id")
      .order("first_name", { ascending: true }),
    supabase
      .from("services")
      .select("id, name, duration_minutes, price_cents")
      .order("name", { ascending: true }),
    supabase
      .from("stylists")
      .select("id, first_name, last_name, is_active")
      .eq("is_active", true)
      .order("first_name", { ascending: true }),
    intakeSessionsQuery,
  ]);

  if (clientsError) throw new Error(clientsError.message);
  if (servicesError) throw new Error(servicesError.message);
  if (stylistsError) throw new Error(stylistsError.message);
  if (FEATURE_INBOX_AND_INTAKE_DB && intakeRes.error) throw new Error(intakeRes.error.message);

  const clients = (clientsData ?? []) as Client[];
  const services = (servicesData ?? []) as Service[];
  const stylists = (stylistsData ?? []) as Stylist[];

  const clientNameById = new Map(
    clients.map((c) => [
      c.id,
      `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || c.phone || "Client",
    ]),
  );

  type UnlinkedIntake = {
    id: string;
    client_id: string | null;
    requested_service: string | null;
    requested_stylist: string | null;
    timing_preference: string | null;
    budget_notes: string | null;
    concern_notes: string | null;
    ai_summary: string | null;
    created_at: string;
  };
  const unlinkedIntakes = (intakeRes.data ?? []) as UnlinkedIntake[];

  const paramIntakeId = params.intakeSessionId?.trim();
  let intakePreview: (UnlinkedIntake & { appointment_id?: string | null }) | null =
    paramIntakeId ? unlinkedIntakes.find((r) => r.id === paramIntakeId) ?? null : null;

  if (FEATURE_INBOX_AND_INTAKE_DB && paramIntakeId && !intakePreview) {
    const { data: row } = await supabase
      .from("intake_sessions")
      .select(
        "id, client_id, requested_service, requested_stylist, timing_preference, budget_notes, concern_notes, ai_summary, created_at, appointment_id",
      )
      .eq("id", paramIntakeId)
      .maybeSingle();
    intakePreview = row as typeof intakePreview;
  }

  const intakeAlreadyLinked = Boolean(
    FEATURE_INBOX_AND_INTAKE_DB &&
      intakePreview &&
      "appointment_id" in intakePreview &&
      (intakePreview as { appointment_id?: string | null }).appointment_id,
  );

  let intakeGuidance: IntakeRecommendation | null = null;
  if (
    FEATURE_INBOX_AND_INTAKE_DB &&
    intakePreview &&
    !intakeAlreadyLinked &&
    paramIntakeId
  ) {
    intakeGuidance = mapIntakeToRecommendation(
      intakeRowToDecisionInput(
        intakePreview as Parameters<typeof intakeRowToDecisionInput>[0],
      ),
      services.map((s) => ({ id: s.id, name: s.name })),
      stylists.map((s) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
      })),
    );
  }

  const selectedClient = params.clientId
    ? clients.find((c) => c.id === params.clientId) ?? null
    : null;

  const serviceIds = new Set(services.map((s) => s.id));
  const stylistIds = new Set(stylists.map((s) => s.id));

  const paramServiceId = params.serviceId?.trim();
  const effectiveServiceId =
    paramServiceId && serviceIds.has(paramServiceId) ? paramServiceId : "";

  const paramStylistId = params.stylistId?.trim();
  const effectiveStylistId =
    paramStylistId && stylistIds.has(paramStylistId) ? paramStylistId : "";

  const selectedStylist = effectiveStylistId
    ? stylists.find((s) => s.id === effectiveStylistId) ?? null
    : null;

  const selectedService = effectiveServiceId
    ? services.find((s) => s.id === effectiveServiceId) ?? null
    : null;

  const isRebookFlow = params.rebook === "1" || params.rebook === "true";
  const showRebookPanel =
    isRebookFlow && selectedClient != null && params.date?.trim();

  const recommendedDateLabel = params.date?.trim()
    ? new Date(params.date.trim() + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <main style={mainStyle}>
      <div style={headerWrapStyle}>
        <div>
          <Link href="/dashboard/appointments" style={backLinkStyle}>
            ← Back to Appointments
          </Link>

          <h1 style={titleStyle}>New Appointment</h1>

          <p style={subtitleStyle}>
            Create a booking for a client, service, and stylist.
          </p>
        </div>
      </div>

      {params.message ? <div style={infoBoxStyle}>{params.message}</div> : null}

      {params.error ? (
        <div style={errorBoxStyle}>
          {params.message || "Unable to create appointment."}
        </div>
      ) : null}

      {FEATURE_INBOX_AND_INTAKE_DB && intakeGuidance && paramIntakeId && !intakeAlreadyLinked ? (
        <section style={intakeGuidePanelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <h2 style={intakeGuideTitleStyle}>Intake guidance</h2>
            <span style={intakeGuideBadgeStyle(intakeGuidance.recommended_next_step)}>
              {intakeGuidance.recommended_next_step === "book_now"
                ? "Book now"
                : intakeGuidance.recommended_next_step === "consultation_required"
                  ? "Consultation suggested"
                  : "Manual review"}
            </span>
          </div>
          <p style={{ margin: "0 0 10px 0", fontSize: 14, color: "#334155", lineHeight: 1.55 }}>
            {intakeGuidance.reasoning_summary}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Confidence: {intakeGuidance.confidence_level}
            {intakeGuidance.recommended_service_id
              ? " · Service prefilled when matched to catalog"
              : ""}
          </p>
        </section>
      ) : null}

      {showRebookPanel ? (
        <section style={rebookPanelStyle}>
          <div style={rebookPanelHeaderRowStyle}>
            <h2 style={rebookPanelTitleStyle}>Rebooking recommendation</h2>
            <span style={rebookBadgeStyle}>Retention</span>
          </div>
          <p style={rebookLeadStyle}>
            You opened this form from a rebooking reminder. Details below are prefilled when
            possible—adjust date and time to match real availability.
          </p>
          <ul style={rebookListStyle}>
            <li>
              <strong>Client</strong>{" "}
              {`${selectedClient!.first_name ?? ""} ${selectedClient!.last_name ?? ""}`.trim() ||
                "Client"}
            </li>
            {selectedService ? (
              <li>
                <strong>Last completed service (suggested repeat)</strong> {selectedService.name ?? "Service"}
              </li>
            ) : paramServiceId && !effectiveServiceId ? (
              <li style={{ color: "#92400e" }}>
                <strong>Service</strong> Previous service is no longer in the catalog—pick a current
                service.
              </li>
            ) : null}
            {recommendedDateLabel ? (
              <li>
                <strong>Recommended next visit</strong> {recommendedDateLabel}
              </li>
            ) : null}
            {selectedStylist ? (
              <li>
                <strong>Preferred stylist</strong> {stylistDisplayName(selectedStylist)}
              </li>
            ) : !effectiveStylistId && selectedClient?.preferred_stylist_id ? (
              <li style={{ color: "#555" }}>
                <strong>Preferred stylist</strong>{" "}
                {paramStylistId && !stylistIds.has(paramStylistId)
                  ? "Saved preference is not on the active stylist list—pick a stylist."
                  : "Not set or not on the active list—choose a stylist."}
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {(selectedClient || selectedStylist) && !showRebookPanel ? (
        <div style={prefillBoxStyle}>
          {selectedClient ? (
            <p style={{ margin: "0 0 6px 0" }}>
              <strong>Booking for:</strong>{" "}
              {`${selectedClient.first_name ?? ""} ${selectedClient.last_name ?? ""}`.trim()}
            </p>
          ) : null}

          {selectedStylist ? (
            <p style={{ margin: 0 }}>
              <strong>Preferred stylist:</strong> {stylistDisplayName(selectedStylist)}
            </p>
          ) : null}
        </div>
      ) : null}

      <form action={createAppointment} style={formStyle}>
        {FEATURE_INBOX_AND_INTAKE_DB && intakePreview && intakeAlreadyLinked ? (
          <div style={intakeWarnStyle}>
            This intake session is already linked to an appointment. Clear the URL or pick another
            intake.
          </div>
        ) : null}

        {FEATURE_INBOX_AND_INTAKE_DB && intakePreview && !intakeAlreadyLinked ? (
          <div style={intakeHintBoxStyle}>
            <strong style={{ display: "block", marginBottom: 6 }}>Linked intake (optional)</strong>
            <span style={{ fontSize: 14, color: "#334155" }}>
              {intakePreview.requested_service ?? "Intake"}{" "}
              <span style={{ color: "#64748b" }}>
                ·{" "}
                {intakePreview.client_id
                  ? clientNameById.get(intakePreview.client_id) ?? "Client"
                  : "No client on file"}
                ·{" "}
                {new Date(intakePreview.created_at).toLocaleDateString()}
              </span>
            </span>
          </div>
        ) : null}

        <div>
          <label style={labelStyle}>Client *</label>
          <select
            name="client_id"
            defaultValue={params.clientId ?? ""}
            required
            style={inputStyle}
          >
            <option value="">Select client</option>
            {clients.map((client) => {
              const name =
                `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() ||
                client.email ||
                client.phone ||
                "Unnamed Client";

              return (
                <option key={client.id} value={client.id}>
                  {name}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Service *</label>
          <select
            name="service_id"
            defaultValue={effectiveServiceId}
            required
            style={inputStyle}
          >
            <option value="">Select service</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name ?? "Unnamed Service"}
                {service.duration_minutes != null ? ` • ${service.duration_minutes} min` : ""}
                {service.price_cents != null
                  ? ` • $${(service.price_cents / 100).toFixed(2)}`
                  : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Stylist *</label>
          <select
            name="stylist_id"
            defaultValue={effectiveStylistId}
            required
            style={inputStyle}
          >
            <option value="">Select stylist</option>
            {stylists.map((stylist) => {
              const name = stylistDisplayName(stylist);

              return (
                <option key={stylist.id} value={stylist.id}>
                  {name}
                </option>
              );
            })}
          </select>
        </div>

        <div style={twoColStyle}>
          <div>
            <label style={labelStyle}>Date *</label>
            <input
              type="date"
              name="appointment_date"
              defaultValue={params.date ?? ""}
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Time *</label>
            <input
              type="time"
              name="appointment_time"
              defaultValue={params.time ?? ""}
              required
              style={inputStyle}
            />
          </div>
        </div>

        <div style={helperTextStyle}>
          Availability should be checked against service duration, stylist hours,
          blocked time, and existing bookings.
        </div>

        <div>
          <label style={labelStyle}>Service Goal</label>
          <textarea
            name="service_goal"
            rows={3}
            style={textareaStyle}
            defaultValue={showRebookPanel ? "Rebooking / maintenance follow-up" : ""}
          />
        </div>

        <label style={checkboxRowStyle}>
          <input
            type="checkbox"
            name="consultation_required"
            defaultChecked={
              params.consultationHint === "1" ||
              params.intakeDecision === "consultation_required"
            }
          />
          Consultation required
        </label>

        {FEATURE_INBOX_AND_INTAKE_DB ? (
          <div>
            <label style={labelStyle}>Link intake session (optional)</label>
            <select
              name="intake_session_id"
              defaultValue={
                intakeAlreadyLinked ? "" : paramIntakeId && unlinkedIntakes.some((u) => u.id === paramIntakeId)
                  ? paramIntakeId
                  : ""
              }
              style={inputStyle}
            >
              <option value="">None</option>
              {unlinkedIntakes.map((row) => {
                const cn = row.client_id ? clientNameById.get(row.client_id) ?? "Client" : "Walk-in";
                const label = `${cn} — ${(row.requested_service ?? "Intake").slice(0, 48)}${(row.requested_service?.length ?? 0) > 48 ? "…" : ""}`;
                return (
                  <option key={row.id} value={row.id}>
                    {label}
                  </option>
                );
              })}
            </select>
            <p style={helperTextStyle}>
              Choose a saved guest intake to attach.{" "}
              <Link href="/dashboard/appointments/intake" style={{ color: "#0b57d0", fontWeight: 700 }}>
                New intake form →
              </Link>
            </p>
          </div>
        ) : null}

        <div>
          <label style={labelStyle}>Intake Notes</label>
          <textarea name="intake_notes" rows={4} style={textareaStyle} />
        </div>

        <div>
          <label style={labelStyle}>General Notes</label>
          <textarea name="notes" rows={4} style={textareaStyle} />
        </div>

        <div style={buttonRowStyle}>
          <button type="submit" style={primaryButtonStyle}>
            Create Appointment
          </button>

          <Link href="/dashboard/appointments" style={secondaryButtonStyle}>
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}

const mainStyle: CSSProperties = {
  padding: 40,
  maxWidth: 900,
  margin: "0 auto",
  fontFamily: "Arial, sans-serif",
};

const headerWrapStyle: CSSProperties = {
  marginBottom: 24,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
};

const backLinkStyle: CSSProperties = {
  textDecoration: "none",
  fontWeight: 700,
  color: "#111",
};

const titleStyle: CSSProperties = {
  fontSize: "2rem",
  marginTop: 12,
  marginBottom: 8,
};

const subtitleStyle: CSSProperties = {
  color: "#666",
  margin: 0,
};

const infoBoxStyle: CSSProperties = {
  background: "#eef6ff",
  color: "#0b57d0",
  padding: 14,
  borderRadius: 12,
  marginBottom: 20,
};

const errorBoxStyle: CSSProperties = {
  background: "#ffe5e5",
  color: "#900",
  padding: 14,
  borderRadius: 12,
  marginBottom: 20,
};

const rebookPanelStyle: CSSProperties = {
  background: "linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)",
  border: "1px solid #bae6fd",
  borderRadius: 16,
  padding: 20,
  marginBottom: 22,
  boxShadow: "0 2px 12px rgba(14, 116, 144, 0.08)",
};

const rebookPanelHeaderRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 8,
};

const rebookPanelTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.15rem",
  fontWeight: 800,
  color: "#0c4a6e",
};

const rebookBadgeStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  padding: "4px 10px",
  borderRadius: 999,
  background: "#e0f2fe",
  color: "#0369a1",
  border: "1px solid #7dd3fc",
};

const rebookLeadStyle: CSSProperties = {
  margin: "0 0 12px 0",
  fontSize: 14,
  color: "#334155",
  lineHeight: 1.5,
};

const rebookListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#1e293b",
  fontSize: 14,
  lineHeight: 1.65,
};

const prefillBoxStyle: CSSProperties = {
  background: "#f7f7f7",
  border: "1px solid #e5e5e5",
  borderRadius: 12,
  padding: 14,
  marginBottom: 20,
};

const formStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  display: "grid",
  gap: 18,
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontWeight: 700,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  boxSizing: "border-box",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  boxSizing: "border-box",
  resize: "vertical",
};

const twoColStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};

const helperTextStyle: CSSProperties = {
  fontSize: 13,
  color: "#666",
  marginTop: -6,
};

const checkboxRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontWeight: 700,
  color: "#111",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const primaryButtonStyle: CSSProperties = {
  background: "#111",
  color: "#fff",
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  display: "inline-block",
  textDecoration: "none",
  background: "#fff",
  color: "#111",
  padding: "12px 16px",
  borderRadius: 10,
  border: "1px solid #ccc",
  fontWeight: 700,
};

const intakeHintBoxStyle: CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 14,
  marginBottom: 8,
};

const intakeWarnStyle: CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  borderRadius: 12,
  padding: 12,
  marginBottom: 12,
  fontSize: 14,
};

const intakeGuidePanelStyle: CSSProperties = {
  background: "linear-gradient(180deg, #faf5ff 0%, #ffffff 100%)",
  border: "1px solid #e9d5ff",
  borderRadius: 16,
  padding: 20,
  marginBottom: 22,
  boxShadow: "0 2px 12px rgba(88, 28, 135, 0.06)",
};

const intakeGuideTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.1rem",
  fontWeight: 800,
  color: "#581c87",
};

function intakeGuideBadgeStyle(
  step: IntakeRecommendation["recommended_next_step"],
): CSSProperties {
  const base: CSSProperties = {
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    padding: "4px 10px",
    borderRadius: 999,
  };
  if (step === "book_now") {
    return { ...base, background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" };
  }
  if (step === "consultation_required") {
    return { ...base, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" };
  }
  return { ...base, background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" };
}
