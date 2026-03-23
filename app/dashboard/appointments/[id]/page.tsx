import Link from "next/link";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { statusBadgeStyleDetail, statusLabel } from "@/app/lib/appointmentStatus";
import { StatusActions } from "@/app/dashboard/appointments/_components/StatusActions";
import { hasAnyVisitMemory } from "@/app/lib/visitMemory";
import { FEATURE_INBOX_AND_INTAKE_DB } from "@/app/lib/featureFlags";
import { formatIntakeSummaryLines } from "@/app/lib/intake/formatIntakeSummary";

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
  service_goal?: string | null;
  consultation_required?: boolean | null;
  intake_notes?: string | null;
  intake_session_id?: string | null;
  deleted_at?: string | null;
  appointment_price_cents?: number | null;
  tip_cents?: number | null;
  payment_status?: string | null;
};

type Client = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  no_show_count?: number | null;
  last_no_show_at?: string | null;
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
};

type AppointmentMemory = {
  id: string;
  appointment_id: string;
  formula_notes: string | null;
  developer_notes: string | null;
  technique_notes: string | null;
  processing_notes: string | null;
  aftercare_notes: string | null;
  photo_urls: string[] | null;
  created_at: string;
};

function formatDate(startIso: string) {
  const d = new Date(startIso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeRange(startIso: string, endIso: string | null) {
  const start = new Date(startIso);
  const startTime = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!endIso) return startTime;
  const end = new Date(endIso);
  const endTime = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${startTime} – ${endTime}`;
}

export default async function DashboardAppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { id } = await params;

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select(
      "id, start_at, end_at, status, notes, cancellation_note, client_id, service_id, stylist_id, service_goal, consultation_required, intake_notes, intake_session_id, deleted_at, appointment_price_cents, tip_cents, payment_status",
    )
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

  const intakeSessionQuery =
    FEATURE_INBOX_AND_INTAKE_DB && appt.intake_session_id
      ? supabase
          .from("intake_sessions")
          .select(
            "id, source, requested_service, requested_stylist, timing_preference, budget_notes, concern_notes, ai_summary, created_at",
          )
          .eq("id", appt.intake_session_id)
          .maybeSingle()
      : Promise.resolve({ data: null });

  const [clientRes, serviceRes, stylistRes, memoryRes, intakeRes] = await Promise.all([
    appt.client_id
      ? supabase
          .from("clients")
          .select("id, first_name, last_name, no_show_count, last_no_show_at")
          .eq("id", appt.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    appt.service_id
      ? supabase
          .from("services")
          .select("id, name, duration_minutes, price_cents")
          .eq("id", appt.service_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    appt.stylist_id
      ? supabase
          .from("stylists")
          .select("id, first_name, last_name")
          .eq("id", appt.stylist_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("appointment_memories")
      .select(
        "id, appointment_id, formula_notes, developer_notes, technique_notes, processing_notes, aftercare_notes, photo_urls, created_at",
      )
      .eq("appointment_id", id)
      .maybeSingle(),
    intakeSessionQuery,
  ]);

  const intakeSession = intakeRes.data as {
    id: string;
    source: string | null;
    requested_service: string | null;
    requested_stylist: string | null;
    timing_preference: string | null;
    budget_notes: string | null;
    concern_notes: string | null;
    ai_summary: string | null;
    created_at: string;
  } | null;

  const client = clientRes.data as Client | null;
  const service = serviceRes.data as Service | null;
  const stylist = stylistRes.data as Stylist | null;
  const memory = memoryRes.data as AppointmentMemory | null;

  const clientName =
    client &&
    `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
  const stylistName =
    stylist &&
    `${stylist.first_name ?? ""} ${stylist.last_name ?? ""}`.trim();

  const servicePriceCents =
    appt.appointment_price_cents != null
      ? appt.appointment_price_cents
      : service?.price_cents ?? null;
  const tipCents = appt.tip_cents ?? 0;
  const totalCents =
    servicePriceCents != null ? servicePriceCents + tipCents : null;
  const paymentStatus = (appt.payment_status ?? "unpaid").toString();

  const showVisitMemory = hasAnyVisitMemory(memory);

  const intakeSummaryLines = intakeSession ? formatIntakeSummaryLines(intakeSession) : [];

  return (
    <div style={mainStyle}>
      <div style={headerRowStyle}>
        <div>
          <Link href="/dashboard/appointments" style={backLinkStyle}>
            ← Back to Appointments
          </Link>
          <h1 style={titleStyle}>Appointment</h1>
          <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
            {formatDate(appt.start_at)} ·{" "}
            {formatTimeRange(appt.start_at, appt.end_at)}
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <StatusActions
            id={id}
            status={appt.status}
            isArchived={!!appt.deleted_at}
            primaryButtonStyle={primaryButtonStyle}
            actionButtonBase={actionButtonBase}
            actionButtonStyleConfirm={actionButtonStyleConfirm}
            actionButtonStyleCheckIn={actionButtonStyleConfirm}
            actionButtonStyleComplete={actionButtonStyleComplete}
            actionButtonStyleCancel={actionButtonStyleCancel}
            actionButtonStyleNoShow={actionButtonStyleNoShow}
            cancelNoteInputStyle={cancelNoteInputStyle}
          />
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ marginBottom: 20, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={statusBadgeStyleDetail(appt.status)}>
            {statusLabel(appt.status)}
          </span>
          {appt.deleted_at && (
            <span
              style={{
                display: "inline-block",
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                background: "#f3f4f6",
                color: "#4b5563",
              }}
            >
              Archived
            </span>
          )}
        </div>

        <div style={gridStyle}>
          <div>
            <p style={labelStyle}>Client</p>
            <p style={valueStyle}>
              {clientName || "—"}
              {client && (
                <Link
                  href={`/dashboard/clients/${client.id}`}
                  style={{
                    marginLeft: 8,
                    fontSize: 13,
                    color: "#0b57d0",
                    textDecoration: "none",
                  }}
                >
                  View profile →
                </Link>
              )}
            </p>
            {client && (client.no_show_count ?? 0) > 0 && (
              <div
                style={{
                  marginTop: 6,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#fff7ed",
                  color: "#92400e",
                  fontSize: 11,
                  fontWeight: 600,
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "999px",
                    background: "#ea580c",
                  }}
                />
                <span>
                  {client.no_show_count} prior no-show
                  {client.no_show_count === 1 ? "" : "s"}
                </span>
                {client.last_no_show_at && (
                  <span style={{ fontWeight: 400 }}>
                    · Last{" "}
                    {new Date(client.last_no_show_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <p style={labelStyle}>Service</p>
            <p style={valueStyle}>{service?.name ?? "—"}</p>
          </div>

          <div>
            <p style={labelStyle}>Stylist</p>
            <p style={valueStyle}>{stylistName ?? "—"}</p>
          </div>

          <div>
            <p style={labelStyle}>Date</p>
            <p style={valueStyle}>{formatDate(appt.start_at)}</p>
          </div>

          <div>
            <p style={labelStyle}>Time</p>
            <p style={valueStyle}>
              {formatTimeRange(appt.start_at, appt.end_at)}
            </p>
          </div>

          <div>
            <p style={labelStyle}>Duration</p>
            <p style={valueStyle}>
              {service?.duration_minutes != null
                ? `${service.duration_minutes} min`
                : "—"}
            </p>
          </div>

          <div>
            <p style={labelStyle}>Billing</p>
            <p style={valueStyle}>
              {servicePriceCents != null
                ? `Service: $${(servicePriceCents / 100).toFixed(2)}`
                : "Service: —"}
              {totalCents != null && (
                <>
                  {" · "}
                  {`Tip: $${(tipCents / 100).toFixed(2)} · Total: $${(
                    totalCents / 100
                  ).toFixed(2)}`}
                </>
              )}
              {" · "}
              Status:{" "}
              {paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
            </p>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <p style={labelStyle}>Notes</p>
          <div style={notesBoxStyle}>
            {appt.notes || "No notes."}
          </div>
        </div>

        {(appt.service_goal || appt.intake_notes || appt.consultation_required) && (
          <div style={{ marginTop: 20 }}>
            <p style={labelStyle}>Consultation & Intake</p>
            <div style={{ ...notesBoxStyle, minHeight: 0 }}>
              <div style={{ marginBottom: 8 }}>
                <strong>Service Goal:</strong>{" "}
                {appt.service_goal && appt.service_goal.trim()
                  ? appt.service_goal
                  : "—"}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Consultation Required:</strong>{" "}
                {appt.consultation_required ? "Yes" : "No"}
              </div>
              <div>
                <strong>Intake Notes:</strong>{" "}
                {appt.intake_notes && appt.intake_notes.trim()
                  ? appt.intake_notes
                  : "—"}
              </div>
            </div>
          </div>
        )}

        {FEATURE_INBOX_AND_INTAKE_DB && intakeSession && (
          <div style={{ marginTop: 20 }}>
            <p style={labelStyle}>Guest intake session</p>
            <div style={{ ...notesBoxStyle, minHeight: 0 }}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                Saved{" "}
                {new Date(intakeSession.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {intakeSession.source ? ` · ${intakeSession.source}` : ""}
              </div>
              {intakeSummaryLines.length === 0 ? (
                <p style={{ margin: 0, color: "#555", fontSize: 14 }}>Linked intake record (no summary text stored).</p>
              ) : (
                intakeSummaryLines.map((line, i) => (
                  <div key={i} style={{ marginBottom: 8, whiteSpace: "pre-wrap", fontSize: 14 }}>
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {appt.status === "cancelled" && appt.cancellation_note && (
          <div style={{ marginTop: 20 }}>
            <p style={labelStyle}>Cancellation reason</p>
            <div style={notesBoxStyle}>
              {appt.cancellation_note}
            </div>
          </div>
        )}

        <div style={{ marginTop: 22 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <p style={labelStyle}>Visit Memory</p>
            <Link
              href={`/dashboard/appointments/${id}/edit`}
              style={{ fontSize: 13, color: "#0b57d0", textDecoration: "none", fontWeight: 700 }}
            >
              Edit visit memory →
            </Link>
          </div>

          {!showVisitMemory ? (
            <div style={{ ...notesBoxStyle, minHeight: 0, color: "#555" }}>
              No formula or photo memory saved for this visit yet.
            </div>
          ) : (
            <div style={{ ...notesBoxStyle, minHeight: 0 }}>
              {memory?.formula_notes?.trim() ? (
                <div style={{ marginBottom: 10 }}>
                  <strong>Formula:</strong>
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{memory.formula_notes}</div>
                </div>
              ) : null}
              {memory?.developer_notes?.trim() ? (
                <div style={{ marginBottom: 10 }}>
                  <strong>Developer:</strong>
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{memory.developer_notes}</div>
                </div>
              ) : null}
              {memory?.technique_notes?.trim() ? (
                <div style={{ marginBottom: 10 }}>
                  <strong>Technique:</strong>
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{memory.technique_notes}</div>
                </div>
              ) : null}
              {memory?.processing_notes?.trim() ? (
                <div style={{ marginBottom: 10 }}>
                  <strong>Processing:</strong>
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{memory.processing_notes}</div>
                </div>
              ) : null}
              {memory?.aftercare_notes?.trim() ? (
                <div style={{ marginBottom: 10 }}>
                  <strong>Aftercare:</strong>
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{memory.aftercare_notes}</div>
                </div>
              ) : null}

              {(memory?.photo_urls ?? []).length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <strong>Photos:</strong>
                  <div
                    style={{
                      marginTop: 10,
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {(memory?.photo_urls ?? []).filter(Boolean).map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "block", textDecoration: "none" }}
                      >
                        <img
                          src={url}
                          alt="Visit photo"
                          style={{
                            width: "100%",
                            height: 120,
                            objectFit: "cover",
                            borderRadius: 12,
                            border: "1px solid #e5e5e5",
                            background: "#fff",
                          }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const mainStyle: React.CSSProperties = {
  maxWidth: 720,
};

const headerRowStyle: React.CSSProperties = {
  marginBottom: 24,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 16,
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

const primaryButtonStyle: React.CSSProperties = {
  textDecoration: "none",
  padding: "10px 16px",
  borderRadius: 12,
  background: "#111",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
};

const actionButtonBase: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #d8d8d8",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  background: "#fff",
};
const actionButtonStyleConfirm: React.CSSProperties = {
  ...actionButtonBase,
  background: "#e8f5e9",
  color: "#2e7d32",
  borderColor: "#a5d6a7",
};
const actionButtonStyleComplete: React.CSSProperties = {
  ...actionButtonBase,
  background: "#e8f5e9",
  color: "#137333",
  borderColor: "#81c784",
};
const actionButtonStyleCancel: React.CSSProperties = {
  ...actionButtonBase,
  background: "#fff1f1",
  color: "#b42318",
  borderColor: "#f5c6cb",
};
const actionButtonStyleNoShow: React.CSSProperties = {
  ...actionButtonBase,
  background: "#f5f5f5",
  color: "#6b7280",
  borderColor: "#d1d5db",
};
const cancelNoteInputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #d8d8d8",
  fontSize: 13,
  marginRight: 8,
  width: 180,
  verticalAlign: "middle",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 16,
};

const labelStyle: React.CSSProperties = {
  margin: "0 0 4px 0",
  fontSize: 12,
  fontWeight: 700,
  color: "#666",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const valueStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
};

const notesBoxStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 14,
  borderRadius: 12,
  background: "#f8f8f8",
  minHeight: 60,
  fontSize: 14,
};

const errorBoxStyle: React.CSSProperties = {
  background: "#ffe5e5",
  color: "#900",
  padding: 16,
  borderRadius: 12,
};
