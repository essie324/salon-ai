import Link from "next/link";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";

type Client = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at?: string | null;
};

function notesPreview(notes: string | null) {
  if (!notes) return "No notes yet.";
  return notes.length > 80 ? `${notes.slice(0, 80)}...` : notes;
}

export default async function DashboardClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const resolvedSearchParams = await searchParams;
  const rawQuery = resolvedSearchParams?.q ?? "";
  const query = rawQuery.trim();

  let queryBuilder = supabase
    .from("clients")
    .select("id, first_name, last_name, email, phone, notes, created_at")
    .order("first_name", { ascending: true });

  if (query) {
    queryBuilder = queryBuilder.or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`
    );
  }

  const { data, error } = await queryBuilder;
  const clients = (data ?? []) as Client[];

  return (
    <main
      style={{
        padding: 40,
        fontFamily: "Arial, sans-serif",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          marginBottom: 28,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Link
            href="/dashboard"
            style={{
              textDecoration: "none",
              fontWeight: 700,
              color: "#111",
              display: "inline-block",
              marginBottom: 10,
            }}
          >
            ← Back to Dashboard
          </Link>

          <h1 style={{ fontSize: "2.2rem", margin: "0 0 8px 0" }}>Clients</h1>
          <p style={{ margin: 0, color: "#666" }}>
            Client directory for your salon.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/dashboard/clients/new"
            style={{
              display: "inline-block",
              textDecoration: "none",
              padding: "12px 18px",
              borderRadius: 12,
              background: "#0b57d0",
              color: "#fff",
              fontWeight: 700,
              whiteSpace: "nowrap",
              fontSize: 15,
            }}
          >
            Quick Add Client
          </Link>
          <Link
            href="/dashboard/clients/new"
            style={{
              display: "inline-block",
              textDecoration: "none",
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #d4d4d4",
              background: "#fff",
              color: "#111",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            + New Client
          </Link>
        </div>
      </div>

      <form
        action="/dashboard/clients"
        method="get"
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 28,
          background: "#fff",
          border: "1px solid #e5e5e5",
          borderRadius: 18,
          padding: 18,
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
        }}
      >
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search by name, email, or phone"
          style={{
            flex: "1 1 280px",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #d8d8d8",
            fontSize: "1rem",
          }}
        />

        <button
          type="submit"
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            background: "#111",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Search
        </button>

        {query ? (
          <Link
            href="/dashboard/clients"
            style={{
              textDecoration: "none",
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              color: "#111",
              fontWeight: 700,
            }}
          >
            Clear
          </Link>
        ) : null}
      </form>

      {query ? (
        <p style={{ marginTop: 0, marginBottom: 18, color: "#555" }}>
          Showing results for: <strong>{query}</strong>
        </p>
      ) : null}

      {error && (
        <div
          style={{
            background: "#ffe5e5",
            color: "#900",
            padding: 16,
            borderRadius: 12,
            marginBottom: 24,
          }}
        >
          Error loading clients: {error.message}
        </div>
      )}

      {clients.length === 0 ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: 18,
            padding: 24,
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ margin: 0 }}>
            {query ? "No matching clients found." : "No clients found."}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
          }}
        >
          {clients.map((client) => {
            const fullName =
              `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() ||
              "Unnamed Client";

            return (
              <Link
                key={client.id}
                href={`/dashboard/clients/${client.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e5e5",
                    borderRadius: 18,
                    padding: 20,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                    height: "100%",
                  }}
                >
                  <h2 style={{ margin: "0 0 10px 0", fontSize: "1.2rem" }}>
                    {fullName}
                  </h2>

                  <p style={lineStyle}>
                    <strong>Email:</strong> {client.email || "—"}
                  </p>

                  <p style={lineStyle}>
                    <strong>Phone:</strong> {client.phone || "—"}
                  </p>

                  <p style={{ ...lineStyle, color: "#555", marginTop: 10 }}>
                    <strong>Notes:</strong> {notesPreview(client.notes)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

const lineStyle: React.CSSProperties = {
  margin: "6px 0",
};