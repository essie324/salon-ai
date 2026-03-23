import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { validateAppointmentRequest } from "@/app/lib/booking/bookingEngine";
import { getServiceDuration } from "@/app/lib/booking/duration";
import {
  getInboxConversationDecision,
  toAppointmentDraftFromSlot,
} from "@/app/lib/chat/engine";

async function bookAppointmentFromInbox(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();

  const intakeSessionId = String(formData.get("intake_session_id") || "");
  const serviceId = String(formData.get("service_id") || "");
  const stylistId = String(formData.get("stylist_id") || "");
  const slotDate = String(formData.get("slot_date") || "");
  const slotTime = String(formData.get("slot_time") || "");
  const slotEndTime = String(formData.get("slot_end_time") || "");

  if (!intakeSessionId || !serviceId || !stylistId || !slotDate || !slotTime) {
    redirect(`/dashboard/inbox?error=invalid_request`);
  }

  const { data: intakeSession, error: intakeError } = await supabase
    .from("intake_sessions")
    .select(
      "id, client_id, requested_service, requested_stylist, timing_preference, budget_notes, concern_notes, appointment_id",
    )
    .eq("id", intakeSessionId)
    .maybeSingle();

  if (intakeError || !intakeSession) {
    redirect(`/dashboard/inbox?error=intake_not_found`);
  }

  if (intakeSession.appointment_id) {
    redirect(`/dashboard/appointments/${intakeSession.appointment_id}`);
  }

  const clientId = intakeSession.client_id;
  if (!clientId) {
    redirect(`/dashboard/inbox?error=missing_client&message=${encodeURIComponent("Client missing for this conversation.")}`);
  }

  const slotDraft = toAppointmentDraftFromSlot({
    slot: {
      date: slotDate,
      time: slotTime,
      end_time: slotEndTime || undefined,
    },
  });

  // If we don't have an end_time (HH:MM), compute it from service duration.
  let end_at = slotDraft.end_at;
  if (!end_at) {
    const { data: serviceRow } = await supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("id", serviceId)
      .maybeSingle();

    const durationMinutes = getServiceDuration(serviceRow as any);
    const startAtLocal = new Date(slotDraft.start_at);
    end_at = new Date(startAtLocal.getTime() + durationMinutes * 60 * 1000).toISOString();
  }

  const concernNotesText = (intakeSession.concern_notes ?? "").trim();
  const budgetNotesText = (intakeSession.budget_notes ?? "").trim();
  // Match the receptionist engine formatting: concern + newline + budget (then trimmed).
  const intakeNotes = `${concernNotesText}\n${budgetNotesText}`.trim();

  const serviceGoal = intakeSession.requested_service ?? null;

  const validation = await validateAppointmentRequest({
    supabase,
    clientId,
    stylistId,
    serviceId,
    startAt: slotDraft.start_at,
    endAt: end_at,
    serviceGoal: serviceGoal ?? undefined,
    intakeNotes: intakeNotes || undefined,
  });

  if (!validation.valid) {
    const message =
      validation.message ??
      validation.reason ??
      "Unable to book this appointment. Please adjust service/stylist/time and try again.";

    redirect(
      `/dashboard/inbox?error=booking_failed&message=${encodeURIComponent(message)}&intake=${encodeURIComponent(intakeSessionId)}`,
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("appointments")
    .insert({
      client_id: clientId,
      service_id: serviceId,
      stylist_id: stylistId,
      start_at: slotDraft.start_at,
      end_at,
      appointment_date: slotDraft.appointment_date,
      appointment_time: slotDraft.appointment_time,
      notes: null,
      service_goal: serviceGoal,
      consultation_required: false,
      intake_notes: intakeNotes || null,
      status: "scheduled",
      deposit_required: !!validation.depositRequired,
      deposit_amount_cents: validation.depositRequired
        ? (validation.depositAmountCents ?? null)
        : null,
      deposit_status: validation.depositRequired
        ? (validation.depositStatus ?? "required")
        : "not_required",
    })
    .select("id")
    .maybeSingle();

  if (insertError || !inserted?.id) {
    redirect(
      `/dashboard/inbox?error=insert_failed&message=${encodeURIComponent(insertError?.message ?? "Failed to create appointment.")}`,
    );
  }

  const appointmentId = inserted.id as string;

  const { error: updateError } = await supabase
    .from("intake_sessions")
    .update({ appointment_id: appointmentId })
    .eq("id", intakeSessionId);
  if (updateError) {
    // Appointment is created, but intake linkage failed; still redirect.
  }

  redirect(`/dashboard/appointments/${appointmentId}`);
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; message?: string; intake?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const resolved = await searchParams;

  const { data: intakeSessions } = await supabase
    .from("intake_sessions")
    .select(
      "id, client_id, requested_service, requested_stylist, timing_preference, budget_notes, concern_notes, ai_summary, appointment_id, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(8);

  const intakeList = (intakeSessions ?? []) as {
    id: string;
    client_id: string | null;
    requested_service: string | null;
    requested_stylist: string | null;
    timing_preference: string | null;
    budget_notes: string | null;
    concern_notes: string | null;
    ai_summary: string | null;
    appointment_id: string | null;
    created_at: string;
  }[];

  const clientIds = intakeList
    .map((r) => r.client_id)
    .filter((v): v is string => !!v);

  const clientListResult =
    clientIds.length > 0
      ? await supabase
          .from("clients")
          .select("id, first_name, last_name")
          .in("id", clientIds)
      : { data: [] as any[] };

  const clientList = (clientListResult?.data ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
  }[];

  const clientsById = new Map(clientList.map((c) => [c.id, c]));

  const error = resolved?.error;
  const message = resolved?.message;

  // Only compute decisions for items that are not booked yet.
  const bundles = await Promise.all(
    intakeList.map(async (s) => {
      if (s.appointment_id) return { intakeSession: s, bundle: null as any };
      const bundle = await getInboxConversationDecision({
        supabase,
        intakeSession: s,
        maxSlots: 3,
      });
      return { intakeSession: s, bundle };
    }),
  );

  return (
    <main style={pageStyle}>
      <div style={{ marginBottom: 18 }}>
        <Link href="/dashboard" style={backLinkStyle}>
          ← Back to Dashboard
        </Link>
        <h1 style={titleStyle}>Inbox</h1>
        <p style={subtitleStyle}>
          Convert AI conversations into scheduled appointments.
        </p>
      </div>

      {error ? (
        <div style={errorBoxStyle}>
          <strong style={{ fontWeight: 800 }}>Inbox:</strong>{" "}
          {message ?? error}
        </div>
      ) : null}

      {bundles.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ margin: 0, color: "#666" }}>No inbox items yet.</p>
        </div>
      ) : null}

      {bundles.map(({ intakeSession: s, bundle }) => {
        const client = s.client_id ? clientsById.get(s.client_id) : undefined;
        const clientName =
          client && `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim().length > 0
            ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
            : s.client_id
              ? "Client"
              : "Unassigned client";

        const createdLabel = s.created_at
          ? new Date(s.created_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : "";

        const apptId = s.appointment_id;

        const topSlot = bundle?.topSlot ?? null;

        return (
          <section key={s.id} style={cardStyle}>
            <div style={stepperRowStyle}>
              <div style={stepperActiveStyle}>1. Conversation</div>
              <div style={stepperStyle}>2. Decision</div>
              <div style={stepperStyle}>3. Booking</div>
            </div>

            <div style={cardHeaderStyle}>
              <div>
                <div style={clientNameStyle}>{clientName}</div>
                <div style={metaStyle}>{createdLabel || "Conversation"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                {apptId ? (
                  <Link href={`/dashboard/appointments/${apptId}`} style={secondaryButtonStyle}>
                    View Appointment
                  </Link>
                ) : (
                  <div style={{ color: "#666", fontSize: 12, fontWeight: 700 }}>Needs booking</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={sectionTitleStyle}>Conversation</div>
              <div style={bodyStyle}>
                {s.requested_service ? (
                  <div>
                    <strong>Service:</strong> {s.requested_service}
                  </div>
                ) : null}
                {s.requested_stylist ? (
                  <div>
                    <strong>Stylist:</strong> {s.requested_stylist}
                  </div>
                ) : null}
                {s.timing_preference ? (
                  <div>
                    <strong>Timing:</strong> {s.timing_preference}
                  </div>
                ) : null}
                {s.ai_summary ? (
                  <div style={{ marginTop: 6 }}>
                    <strong>Summary:</strong> {s.ai_summary}
                  </div>
                ) : null}
                {!s.ai_summary && (s.concern_notes || s.budget_notes) ? (
                  <div style={{ marginTop: 6 }}>
                    <strong>Notes:</strong>{" "}
                    {(s.concern_notes ?? s.budget_notes ?? "").slice(0, 220)}
                    {(String(s.concern_notes ?? s.budget_notes ?? "").length > 220) ? "..." : ""}
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={sectionTitleStyle}>Decision</div>
              {!bundle ? (
                <div style={{ ...bodyStyle, color: "#666" }}>
                  Appointment already created.
                </div>
              ) : (
                <div style={bodyStyle}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <strong>Service:</strong> {bundle.resolved.recommendedServiceName ?? "—"}
                    </div>
                    <div>
                      <strong>Stylist:</strong> {bundle.resolved.recommendedStylistName ?? "—"}
                    </div>
                    <div>
                      <strong>Top slot:</strong>{" "}
                      {topSlot ? `${topSlot.date} ${topSlot.time}` : "—"}
                    </div>
                  </div>

                  {bundle.decision.confidence_score != null ? (
                    <div style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
                      Confidence: {Math.round(bundle.decision.confidence_score * 100)}%
                    </div>
                  ) : null}

                  {bundle.decision.reasoning ? (
                    <div style={{ marginTop: 8, color: "#333", fontSize: 12, fontWeight: 700 }}>
                      Why:{" "}
                      <span style={{ fontWeight: 800 }}>{bundle.decision.reasoning}</span>
                    </div>
                  ) : null}

                  {bundle.decision.flags.needs_consultation ? (
                    <div style={flagWarnStyle}>Consultation required before booking.</div>
                  ) : null}
                  {bundle.decision.flags.requires_manual_review ? (
                    <div style={flagWarnStyle}>Manual review required.</div>
                  ) : null}
                  {bundle.decision.flags.pricing_uncertain ? (
                    <div style={flagInfoStyle}>Pricing may be uncertain.</div>
                  ) : null}
                </div>
              )}
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={sectionTitleStyle}>Booking</div>
              {!bundle ? (
                <div style={{ ...bodyStyle, color: "#666" }}>
                  Booked already.
                </div>
              ) : bundle.canBook ? (
                <form action={bookAppointmentFromInbox}>
                  <div style={{ marginBottom: 8, color: "#333", fontSize: 13, fontWeight: 800 }}>
                    Booking for {bundle.resolved.recommendedServiceName ?? "—"} with{" "}
                    {bundle.resolved.recommendedStylistName ?? "—"} at{" "}
                    {topSlot ? `${topSlot.date} ${topSlot.time}` : "—"}
                  </div>
                  <input type="hidden" name="intake_session_id" value={s.id} />
                  <input
                    type="hidden"
                    name="service_id"
                    value={bundle.decision.recommended_service_id ?? ""}
                  />
                  <input
                    type="hidden"
                    name="stylist_id"
                    value={bundle.decision.recommended_stylist_id ?? bundle.topSlot?.stylist_id ?? ""}
                  />
                  <input
                    type="hidden"
                    name="slot_date"
                    value={bundle.topSlot?.date ?? ""}
                  />
                  <input
                    type="hidden"
                    name="slot_time"
                    value={bundle.topSlot?.time ?? ""}
                  />
                  <input
                    type="hidden"
                    name="slot_end_time"
                    value={bundle.topSlot?.end_time ?? ""}
                  />

                  <button type="submit" style={primaryButtonStyle}>
                    Book This Appointment
                  </button>
                </form>
              ) : (
                <div style={{ ...bodyStyle, color: "#666" }}>
                  {bundle.cannotBookReason ?? "Unable to book from this conversation yet."}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}

const pageStyle: CSSProperties = {
  padding: 4,
};

const backLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "#111",
  fontWeight: 700,
  fontSize: 14,
};

const titleStyle: CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 900,
  margin: "8px 0 4px 0",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: "#666",
  fontSize: 14,
};

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 18,
  padding: 18,
  marginBottom: 14,
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const stepperRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 10,
};

const stepperStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "#f2f2f2",
  border: "1px solid #e5e5e5",
  color: "#666",
  fontWeight: 800,
  fontSize: 12,
};

const stepperActiveStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "#fff",
  border: "1px solid #0b57d0",
  color: "#0b57d0",
  fontWeight: 900,
  fontSize: 12,
};

const clientNameStyle: CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#111",
};

const metaStyle: CSSProperties = {
  color: "#666",
  fontSize: 12,
  fontWeight: 700,
  marginTop: 4,
};

const sectionTitleStyle: CSSProperties = {
  fontWeight: 900,
  fontSize: 12,
  color: "#333",
  marginBottom: 6,
};

const bodyStyle: CSSProperties = {
  background: "#f8f8f8",
  border: "1px solid #e5e5e5",
  borderRadius: 12,
  padding: 12,
  whiteSpace: "pre-wrap",
  fontSize: 13,
  color: "#222",
  lineHeight: 1.45,
};

const flagWarnStyle: CSSProperties = {
  marginTop: 10,
  padding: "8px 10px",
  borderRadius: 10,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  fontSize: 12,
  fontWeight: 800,
};

const flagInfoStyle: CSSProperties = {
  marginTop: 10,
  padding: "8px 10px",
  borderRadius: 10,
  background: "#eef6ff",
  border: "1px solid #dbeafe",
  color: "#0b57d0",
  fontSize: 12,
  fontWeight: 800,
};

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  marginTop: 8,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #0b57d0",
  background: "#0b57d0",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e5e5",
  background: "#fff",
  color: "#111",
  fontWeight: 900,
  textDecoration: "none",
  fontSize: 13,
};

const errorBoxStyle: CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  padding: 12,
  borderRadius: 14,
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 14,
};

