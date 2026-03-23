import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";

async function updateClient(id: string, formData: FormData) {
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

  if (!first_name) return;

  const { error } = await supabase
    .from("clients")
    .update({
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
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/dashboard/clients/${id}`);
}

type Client = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

type Stylist = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export default async function DashboardClientEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { id } = await params;

  const [{ data, error }, { data: stylists }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, first_name, last_name, email, phone, notes, hair_history, color_history, allergy_notes, preferred_stylist_id",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("stylists")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("first_name", { ascending: true }),
  ]);

  if (error) {
    return (
      <main style={mainStyle}>
        <Link href="/dashboard/clients" style={backLinkStyle}>
          ← Back to Clients
        </Link>
        <div style={errorBoxStyle}>Error loading client: {error.message}</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={mainStyle}>
        <Link href="/dashboard/clients" style={backLinkStyle}>
          ← Back to Clients
        </Link>
        <div style={cardStyle}>
          <h1 style={{ marginTop: 0 }}>Client not found</h1>
          <p>This client record does not exist or may have been removed.</p>
        </div>
      </main>
    );
  }

  const client = data as Client;
  const stylistList = (stylists ?? []) as Stylist[];

  return (
    <main style={mainStyle}>
      <div style={headerRowStyle}>
        <div>
          <Link href={`/dashboard/clients/${id}`} style={backLinkStyle}>
            ← Back to Client Profile
          </Link>
          <h1 style={titleStyle}>Edit Client</h1>
          <p style={{ margin: 0, color: "#666" }}>
            Update client details and notes.
          </p>
        </div>
      </div>

      <form
        action={updateClient.bind(null, id)}
        style={{
          ...cardStyle,
          display: "grid",
          gap: 18,
          maxWidth: 760,
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
            <label htmlFor="first_name" style={labelStyle}>
              First Name
            </label>
            <input
              id="first_name"
              name="first_name"
              defaultValue={client.first_name ?? ""}
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="last_name" style={labelStyle}>
              Last Name
            </label>
            <input
              id="last_name"
              name="last_name"
              defaultValue={client.last_name ?? ""}
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" style={labelStyle}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={client.email ?? ""}
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="phone" style={labelStyle}>
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={client.phone ?? ""}
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="notes" style={labelStyle}>
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={client.notes ?? ""}
            rows={6}
            style={{
              ...inputStyle,
              resize: "vertical",
              minHeight: 140,
            }}
          />
        </div>

        <hr style={{ margin: "4px 0", border: "none", borderTop: "1px solid #eee" }} />
        <h2 style={{ fontSize: 16, margin: "4px 0 0" }}>Consultation & Intake (optional)</h2>
        <p style={{ margin: "4px 0 8px", fontSize: 13, color: "#666" }}>
          Use these fields to capture ongoing consultation context for AI and stylists.
        </p>

        <div>
          <label htmlFor="hair_history" style={labelStyle}>
            Hair History
          </label>
          <textarea
            id="hair_history"
            name="hair_history"
            defaultValue={(client as any).hair_history ?? ""}
            rows={3}
            style={{
              ...inputStyle,
              resize: "vertical",
              minHeight: 80,
            }}
          />
        </div>

        <div>
          <label htmlFor="color_history" style={labelStyle}>
            Color History
          </label>
          <textarea
            id="color_history"
            name="color_history"
            defaultValue={(client as any).color_history ?? ""}
            rows={3}
            style={{
              ...inputStyle,
              resize: "vertical",
              minHeight: 80,
            }}
          />
        </div>

        <div>
          <label htmlFor="allergy_notes" style={labelStyle}>
            Allergy Notes
          </label>
          <textarea
            id="allergy_notes"
            name="allergy_notes"
            defaultValue={(client as any).allergy_notes ?? ""}
            rows={2}
            style={{
              ...inputStyle,
              resize: "vertical",
              minHeight: 60,
            }}
          />
        </div>

        <div>
          <label htmlFor="preferred_stylist_id" style={labelStyle}>
            Preferred Stylist
          </label>
          <select
            id="preferred_stylist_id"
            name="preferred_stylist_id"
            defaultValue={(client as any).preferred_stylist_id ?? ""}
            style={inputStyle}
          >
            <option value="">No preference</option>
            {stylistList.map((s) => (
              <option key={s.id} value={s.id}>
                {`${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Unnamed stylist"}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" style={submitButtonStyle}>
          Save Changes
        </button>
      </form>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  padding: 40,
  fontFamily: "Arial, sans-serif",
  maxWidth: 1200,
  margin: "0 auto",
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
  fontSize: "2.2rem",
  margin: "12px 0 8px 0",
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
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #d8d8d8",
  fontSize: "1rem",
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
};
