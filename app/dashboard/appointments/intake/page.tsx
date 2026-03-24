import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { FEATURE_INBOX_AND_INTAKE_DB } from "@/app/lib/featureFlags";
import {
  intakeRowToDecisionInput,
  mapIntakeToRecommendation,
} from "@/app/lib/ai/mapIntakeToRecommendation";
import type { IntakeRecommendation } from "@/app/lib/ai/decisionEngine";

async function submitIntakeSession(formData: FormData) {
  "use server";

  if (!FEATURE_INBOX_AND_INTAKE_DB) {
    throw new Error("Intake is disabled.");
  }

  const supabase = await createSupabaseServerClient();

  const client_id = String(formData.get("client_id") || "").trim() || null;
  const looking_for = String(formData.get("looking_for") || "").trim();
  const last_appointment = String(formData.get("last_appointment") || "").trim();
  const hair_color = String(formData.get("hair_color") || "").trim();
  const budget = String(formData.get("budget") || "").trim();
  const other = String(formData.get("other") || "").trim();

  if (!looking_for) {
    throw new Error('Please answer "What are you looking to do?"');
  }

  const concernParts: string[] = [];
  if (hair_color) concernParts.push(`Current color / hair: ${hair_color}`);
  if (other) concernParts.push(other);
  const concern_notes = concernParts.length > 0 ? concernParts.join("\n\n") : null;

  const ai_summary = [
    looking_for && `Goal: ${looking_for}`,
    last_appointment && `Last appointment: ${last_appointment}`,
    budget && `Budget: ${budget}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const { data: inserted, error } = await supabase
    .from("intake_sessions")
    .insert({
      client_id,
      appointment_id: null,
      source: "dashboard_intake",
      requested_service: looking_for,
      requested_stylist: null,
      timing_preference: last_appointment || null,
      budget_notes: budget || null,
      concern_notes,
      ai_summary: ai_summary || null,
    })
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  const id = inserted?.id;

  if (id) {
    const q = new URLSearchParams();
    q.set("recommendation", "1");
    q.set("sessionId", id);
    if (client_id) q.set("clientId", client_id);
    redirect(`/dashboard/appointments/intake?${q.toString()}`);
  }

  redirect("/dashboard/appointments/intake");
}

function buildNewAppointmentHref(
  rec: IntakeRecommendation,
  sessionId: string,
  clientId: string | null | undefined,
): string {
  const q = new URLSearchParams();
  q.set("intakeSessionId", sessionId);
  if (clientId) q.set("clientId", clientId);
  if (
    rec.recommended_service_id &&
    rec.recommended_next_step === "book_now" &&
    (rec.confidence_level === "high" || rec.confidence_level === "medium")
  ) {
    q.set("serviceId", rec.recommended_service_id);
  }
  if (rec.recommended_stylist_id) {
    q.set("stylistId", rec.recommended_stylist_id);
  }
  if (rec.recommended_next_step === "consultation_required") {
    q.set("consultationHint", "1");
  }
  q.set("intakeDecision", rec.recommended_next_step);
  return `/dashboard/appointments/new?${q.toString()}`;
}

function stepBadgeStyle(step: IntakeRecommendation["recommended_next_step"]): CSSProperties {
  if (step === "book_now") {
    return { background: "#ecfdf5", color: "#166534", border: "1px solid #bbf7d0" };
  }
  if (step === "consultation_required") {
    return { background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" };
  }
  return { background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" };
}

function confidenceLabel(c: IntakeRecommendation["confidence_level"]): string {
  if (c === "high") return "High confidence";
  if (c === "medium") return "Medium confidence";
  return "Low confidence";
}

async function IntakeRecommendationView({
  sessionId,
  clientId: clientIdParam,
}: {
  sessionId: string;
  clientId?: string;
}) {
  const supabase = await createSupabaseServerClient();

  const [{ data: session, error: sessionErr }, { data: services }, { data: stylists }] =
    await Promise.all([
      supabase
        .from("intake_sessions")
        .select(
          "id, client_id, requested_service, requested_stylist, timing_preference, budget_notes, concern_notes, ai_summary, created_at",
        )
        .eq("id", sessionId)
        .maybeSingle(),
      supabase.from("services").select("id, name").order("name", { ascending: true }),
      supabase
        .from("stylists")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name", { ascending: true }),
    ]);

  if (sessionErr) throw new Error(sessionErr.message);
  if (!session) {
    return (
      <main style={mainStyle}>
        <Link href="/dashboard/appointments/intake" style={backLinkStyle}>
          ← New intake
        </Link>
        <div style={errorBoxStyle}>Intake session not found.</div>
      </main>
    );
  }

  const rec = mapIntakeToRecommendation(
    intakeRowToDecisionInput(session),
    services ?? [],
    stylists ?? [],
  );

  const clientId = clientIdParam ?? session.client_id ?? undefined;
  const bookUrl = buildNewAppointmentHref(rec, sessionId, clientId ?? null);

  const stepLabel =
    rec.recommended_next_step === "book_now"
      ? "Book service now"
      : rec.recommended_next_step === "consultation_required"
        ? "Book a consultation first"
        : "Manual review";

  return (
    <main style={mainStyle}>
      <div style={headerWrapStyle}>
        <div>
          <Link href="/dashboard/appointments/intake" style={backLinkStyle}>
            ← New intake
          </Link>
          <h1 style={titleStyle}>Booking guidance</h1>
          <p style={subtitleStyle}>
            Rule-based read of this intake (no external AI). Use as a starting point—always confirm
            with the guest.
          </p>
        </div>
      </div>

      <section style={recCardStyle}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <span style={{ ...badgeBaseStyle, ...stepBadgeStyle(rec.recommended_next_step) }}>{stepLabel}</span>
          <span style={{ ...badgeBaseStyle, background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>
            {confidenceLabel(rec.confidence_level)}
          </span>
        </div>

        <p style={{ margin: "0 0 16px 0", fontSize: 15, lineHeight: 1.6, color: "#1e293b" }}>
          {rec.reasoning_summary}
        </p>

        <div style={detailGridStyle}>
          <div>
            <strong style={detailLabelStyle}>Suggested service</strong>
            <p style={{ margin: "6px 0 0 0", fontSize: 14 }}>
              {rec.recommended_service_name ?? "—"}
              {rec.recommended_service_id ? (
                <span style={{ color: "#16a34a", fontSize: 12, marginLeft: 8 }}>(catalog match)</span>
              ) : rec.recommended_service_name ? (
                <span style={{ color: "#64748b", fontSize: 12, marginLeft: 8 }}>(hint only — pick in booking)</span>
              ) : null}
            </p>
          </div>
          <div>
            <strong style={detailLabelStyle}>Stylist match</strong>
            <p style={{ margin: "6px 0 0 0", fontSize: 14 }}>
              {rec.recommended_stylist_id
                ? (stylists ?? []).find((s) => s.id === rec.recommended_stylist_id)
                  ? `${(stylists ?? []).find((s) => s.id === rec.recommended_stylist_id)?.first_name ?? ""} ${(stylists ?? []).find((s) => s.id === rec.recommended_stylist_id)?.last_name ?? ""}`.trim()
                  : "Matched"
                : "— (select when booking)"}
            </p>
          </div>
        </div>

        {rec.recommended_next_step === "consultation_required" ? (
          <div style={calloutConsultStyle}>
            <strong>Recommendation:</strong> schedule a consultation appointment so a stylist can assess
            hair condition, timing, and pricing before a full chemical or transformation service.
          </div>
        ) : null}

        {rec.recommended_next_step === "manual_review" ? (
          <div style={calloutManualStyle}>
            <strong>Recommendation:</strong> have the desk or a stylist review this request before
            locking a service—intent wasn’t clear enough to auto-select.
          </div>
        ) : null}

        {rec.recommended_next_step === "book_now" ? (
          <div style={calloutBookStyle}>
            <strong>Next step:</strong> you can open the booking form with fields prefilled when
            confidence allows. Double-check service and time before confirming.
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20 }}>
          <Link href={bookUrl} style={primaryButtonStyle}>
            {rec.recommended_next_step === "consultation_required"
              ? "Start booking (consultation suggested)"
              : "Continue to new appointment"}
          </Link>
          <Link href="/dashboard/appointments" style={secondaryButtonStyle}>
            Back to appointments
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function DashboardIntakePage({
  searchParams,
}: {
  searchParams?: Promise<{
    saved?: string;
    id?: string;
    recommendation?: string;
    sessionId?: string;
    clientId?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};

  if (!FEATURE_INBOX_AND_INTAKE_DB) {
    return (
      <main style={mainStyle}>
        <Link href="/dashboard/appointments" style={backLinkStyle}>
          ← Back to Appointments
        </Link>
        <h1 style={titleStyle}>Guest intake</h1>
        <p style={subtitleStyle}>
          Intake capture is turned off. Enable <code>FEATURE_INBOX_AND_INTAKE_DB</code> when the
          database is ready.
        </p>
      </main>
    );
  }

  if (params.recommendation === "1" && params.sessionId) {
    return (
      <IntakeRecommendationView sessionId={params.sessionId} clientId={params.clientId} />
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: clientsData, error: clientsError } = await supabase
    .from("clients")
    .select("id, first_name, last_name, email, phone")
    .order("first_name", { ascending: true });

  if (clientsError) throw new Error(clientsError.message);
  const clients = clientsData ?? [];

  return (
    <main style={mainStyle}>
      <div style={headerWrapStyle}>
        <div>
          <Link href="/dashboard/appointments" style={backLinkStyle}>
            ← Back to Appointments
          </Link>
          <h1 style={titleStyle}>Guest intake</h1>
          <p style={subtitleStyle}>
            Capture what the guest wants before booking. After save, you&apos;ll see structured
            booking guidance (rule-based).
          </p>
        </div>
      </div>

      {params.saved === "1" ? (
        <div style={successBoxStyle}>
          Intake saved. Open{" "}
          <Link href="/dashboard/appointments/new" style={{ color: "#0b57d0", fontWeight: 700 }}>
            New appointment
          </Link>{" "}
          to link it.
        </div>
      ) : null}

      <form action={submitIntakeSession} style={formStyle}>
        <div>
          <label style={labelStyle}>Link to client (optional)</label>
          <select name="client_id" defaultValue="" style={inputStyle}>
            <option value="">Walk-in / not in system yet</option>
            {clients.map((c) => {
              const name =
                `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
                c.email ||
                c.phone ||
                "Client";
              return (
                <option key={c.id} value={c.id}>
                  {name}
                </option>
              );
            })}
          </select>
          <p style={hintStyle}>
            After submit, you&apos;ll see booking guidance. With a client linked, the next screen can
            prefill the booking form.
          </p>
        </div>

        <div>
          <label style={labelStyle}>What are you looking to do? *</label>
          <textarea
            name="looking_for"
            required
            rows={3}
            placeholder="e.g. highlights, haircut, color correction"
            style={textareaStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>When was your last appointment?</label>
          <textarea
            name="last_appointment"
            rows={2}
            placeholder="Approximate date or timeframe"
            style={textareaStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Any color currently in your hair?</label>
          <textarea name="hair_color" rows={2} placeholder="Natural, previous dye, etc." style={textareaStyle} />
        </div>

        <div>
          <label style={labelStyle}>Budget range?</label>
          <input type="text" name="budget" placeholder="e.g. $150–200" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Anything else we should know?</label>
          <textarea name="other" rows={4} placeholder="Allergies, events, reference photos…" style={textareaStyle} />
        </div>

        <div style={buttonRowStyle}>
          <button type="submit" style={primaryButtonStyle}>
            Save intake &amp; get guidance
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
  maxWidth: 720,
  margin: "0 auto",
  fontFamily: "Arial, sans-serif",
};

const headerWrapStyle: CSSProperties = {
  marginBottom: 24,
};

const backLinkStyle: CSSProperties = {
  textDecoration: "none",
  fontWeight: 700,
  color: "#111",
  display: "inline-block",
  marginBottom: 12,
};

const titleStyle: CSSProperties = {
  fontSize: "2rem",
  margin: "0 0 8px 0",
};

const subtitleStyle: CSSProperties = {
  color: "#555",
  margin: 0,
  lineHeight: 1.5,
};

const successBoxStyle: CSSProperties = {
  background: "#ecfdf5",
  border: "1px solid #a7f3d0",
  color: "#065f46",
  padding: 14,
  borderRadius: 12,
  marginBottom: 20,
  fontSize: 14,
};

const errorBoxStyle: CSSProperties = {
  background: "#ffe5e5",
  color: "#900",
  padding: 16,
  borderRadius: 12,
};

const recCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
};

const badgeBaseStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  padding: "6px 12px",
  borderRadius: 999,
};

const detailGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginBottom: 8,
};

const detailLabelStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const calloutConsultStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  fontSize: 14,
  color: "#78350f",
};

const calloutManualStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  fontSize: 14,
  color: "#334155",
};

const calloutBookStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  fontSize: 14,
  color: "#166534",
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

const hintStyle: CSSProperties = {
  margin: "8px 0 0 0",
  fontSize: 13,
  color: "#666",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const primaryButtonStyle: CSSProperties = {
  display: "inline-block",
  textAlign: "center",
  background: "#111",
  color: "#fff",
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  fontWeight: 700,
  textDecoration: "none",
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
