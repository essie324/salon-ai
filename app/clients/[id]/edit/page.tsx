import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

async function updateClient(id: string, formData: FormData) {
  "use server";

  const first_name = String(formData.get("first_name") || "").trim();
  const last_name = String(formData.get("last_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!first_name) return;

  const { error } = await supabase
    .from("clients")
    .update({
      first_name,
      last_name: last_name || null,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/clients/${id}`);
}

type Client = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, email, phone, notes")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <main style={mainStyle}>
        <Link href="/clients" style={backLinkStyle}>
          ← Back to Clients
        </Link>
        <div style={errorBoxStyle}>Error loading client: {error.message}</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={mainStyle}>
        <Link href="/clients" style={backLinkStyle}>
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

  return (
    <main style={mainStyle}>
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Link href={`/clients/${id}`} style={backLinkStyle}>
            ← Back to Client Profile
          </Link>
          <h1 style={{ fontSize: "2.1rem", margin: "12px 0 8px 0" }}>
            Edit Client
          </h1>
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

        <button
          type="submit"
          style={{
            padding: "14px 18px",
            borderRadius: 12,
            border: "none",
            background: "#111",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Save Changes
        </button>
      </form>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  padding: 40,
  fontFamily: "Arial, sans-serif",
  maxWidth: 1100,
  margin: "0 auto",
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