import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { FEATURE_INBOX_AND_INTAKE_DB } from "@/app/lib/featureFlags";

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

  if (client_id && id) {
    const q = new URLSearchParams();
    q.set("clientId", client_id);
    q.set("intakeSessionId", id);
    q.set("message", "Intake saved — finish booking below.");
    redirect(`/dashboard/appointments/new?${q.toString()}`);
  }

  redirect(
    `/dashboard/appointments/intake?saved=1${id ? `&id=${encodeURIComponent(id)}` : ""}`,
  );
}

export default async function DashboardIntakePage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; id?: string }>;
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
            Capture what the guest wants before booking. Saved to intake sessions (structured; not
            the same as appointment notes).
          </p>
        </div>
      </div>

      {params.saved === "1" ? (
        <div style={successBoxStyle}>
          Intake saved.{" "}
          {params.id ? (
            <>
              You can link it when you{" "}
              <Link href="/dashboard/appointments/new" style={{ color: "#0b57d0", fontWeight: 700 }}>
                create an appointment
              </Link>
              .
            </>
          ) : null}
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
          <p style={hintStyle}>If you pick a client, we&apos;ll send you to new appointment with this intake linked.</p>
        </div>

        <div>
          <label style={labelStyle}>What are you looking to do? *</label>
          <textarea name="looking_for" required rows={3} placeholder="e.g. highlights, haircut, color correction" style={textareaStyle} />
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
            Save intake
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
