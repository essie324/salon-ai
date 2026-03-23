import { redirect } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

async function createClient(formData: FormData) {
  "use server";

  const first_name = String(formData.get("first_name") || "").trim();
  const last_name = String(formData.get("last_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!first_name) return;

  const { data, error } = await supabase
    .from("clients")
    .insert({
      first_name,
      last_name: last_name || null,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/clients/${data.id}`);
}

export default function NewClientPage() {
  return (
    <main style={mainStyle}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/clients" style={backLinkStyle}>
          ← Back to Clients
        </Link>

        <h1 style={{ fontSize: "2rem", marginTop: 12 }}>
          Create New Client
        </h1>
      </div>

      <form action={createClient} style={formStyle}>
        <div style={gridStyle}>
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
          <label style={labelStyle}>Email</label>
          <input name="email" type="email" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Phone</label>
          <input name="phone" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Notes</label>
          <textarea name="notes" rows={5} style={textareaStyle} />
        </div>

        <button type="submit" style={buttonStyle}>
          Create Client
        </button>
      </form>
    </main>
  );
}

const mainStyle = {
  padding: 40,
  maxWidth: 900,
  margin: "0 auto",
  fontFamily: "Arial",
};

const formStyle = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 16,
  padding: 24,
  display: "grid",
  gap: 16,
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};

const labelStyle = {
  fontWeight: 700,
  display: "block",
  marginBottom: 6,
};

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
};

const textareaStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
};

const buttonStyle = {
  background: "#111",
  color: "#fff",
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
};

const backLinkStyle = {
  textDecoration: "none",
  fontWeight: 700,
  color: "#111",
};