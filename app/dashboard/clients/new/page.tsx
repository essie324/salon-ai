import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";

async function saveClient(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();

  const first_name = String(formData.get("first_name") || "").trim();
  const last_name = String(formData.get("last_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const hair_history = String(formData.get("hair_history") || "").trim();
  const color_history = String(formData.get("color_history") || "").trim();
  const allergy_notes = String(formData.get("allergy_notes") || "").trim();
  const preferred_stylist_id = String(formData.get("preferred_stylist_id") || "").trim();

  if (!first_name) {
    throw new Error("First name is required.");
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      first_name,
      last_name: last_name || null,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      hair_history: hair_history || null,
      color_history: color_history || null,
      allergy_notes: allergy_notes || null,
      preferred_stylist_id: preferred_stylist_id || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/dashboard/clients/${data.id}`);
}

async function saveClientAndBook(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();

  const first_name = String(formData.get("first_name") || "").trim();
  const last_name = String(formData.get("last_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const hair_history = String(formData.get("hair_history") || "").trim();
  const color_history = String(formData.get("color_history") || "").trim();
  const allergy_notes = String(formData.get("allergy_notes") || "").trim();
  const preferred_stylist_id = String(formData.get("preferred_stylist_id") || "").trim();

  if (!first_name) {
    throw new Error("First name is required.");
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      first_name,
      last_name: last_name || null,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      hair_history: hair_history || null,
      color_history: color_history || null,
      allergy_notes: allergy_notes || null,
      preferred_stylist_id: preferred_stylist_id || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/dashboard/appointments/new?clientId=${data.id}`);
}

type Stylist = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export default async function DashboardNewClientPage() {
  const supabase = await createSupabaseServerClient();
  const { data: stylists } = await supabase
    .from("stylists")
    .select("id, first_name, last_name")
    .eq("is_active", true)
    .order("first_name", { ascending: true });

  const stylistList = (stylists ?? []) as Stylist[];

  return (
    <main
      style={{
        padding: 40,
        maxWidth: 900,
        margin: "0 auto",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/dashboard/clients"
          style={{
            textDecoration: "none",
            fontWeight: 700,
            color: "#111",
          }}
        >
          ← Back to Clients
        </Link>

        <h1 style={{ fontSize: "2rem", marginTop: 12 }}>Create New Client</h1>
        <p style={{ color: "#666", margin: 0 }}>
          Quick front-desk intake for new salon clients.
        </p>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e5e5",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
        }}
      >
        <form
          style={{
            display: "grid",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <div>
              <label style={labelStyle}>First Name *</label>
              <input name="first_name" required style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Last Name</label>
              <input name="last_name" style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Phone</label>
            <input name="phone" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <input name="email" type="email" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea name="notes" rows={5} style={textareaStyle} />
          </div>

          <hr style={{ margin: "8px 0 4px", border: "none", borderTop: "1px solid #eee" }} />
          <h2 style={{ margin: "4px 0 0", fontSize: 16 }}>Consultation & Intake (optional)</h2>
          <p style={{ margin: "4px 0 8px", fontSize: 13, color: "#666" }}>
            Capture hair history and preferences to help stylists personalize future visits.
          </p>

          <div>
            <label style={labelStyle}>Hair History</label>
            <textarea
              name="hair_history"
              rows={3}
              style={textareaStyle}
              placeholder="Texture, density, previous chemical services, damage concerns…"
            />
          </div>

          <div>
            <label style={labelStyle}>Color History</label>
            <textarea
              name="color_history"
              rows={3}
              style={textareaStyle}
              placeholder="Recent color formulas, box dye history, lifting history…"
            />
          </div>

          <div>
            <label style={labelStyle}>Allergy Notes</label>
            <textarea
              name="allergy_notes"
              rows={2}
              style={textareaStyle}
              placeholder="Product sensitivities, skin reactions, fragrance allergies…"
            />
          </div>

          <div>
            <label style={labelStyle}>Preferred Stylist</label>
            <select name="preferred_stylist_id" style={inputStyle} defaultValue="">
              <option value="">No preference</option>
              {stylistList.map((s) => (
                <option key={s.id} value={s.id}>
                  {`${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Unnamed stylist"}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button formAction={saveClient} style={primaryButtonStyle}>
              Save Client
            </button>

            <button formAction={saveClientAndBook} style={secondaryButtonStyle}>
              Save and Book Appointment
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  boxSizing: "border-box",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#111",
  color: "#fff",
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "#fff",
  color: "#111",
  padding: "12px 16px",
  borderRadius: 10,
  border: "1px solid #ccc",
  fontWeight: 700,
  cursor: "pointer",
};