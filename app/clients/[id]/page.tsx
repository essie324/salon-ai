import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Client = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

type Appointment = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  notes: string | null;
  service_id: string | null;
  stylist_id: string | null;
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

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [
    { data: client, error: clientError },
    { data: appointments, error: appointmentsError },
    { data: services },
    { data: stylists },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone, notes")
      .eq("id", id)
      .maybeSingle(),

    supabase
      .from("appointments")
      .select(
        "id, appointment_date, appointment_time, status, notes, service_id, stylist_id"
      )
      .eq("client_id", id)
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: false }),

    supabase
      .from("services")
      .select("id, name, duration_minutes, price_cents"),

    supabase
      .from("stylists")
      .select("id, first_name, last_name"),
  ]);

  if (clientError) {
    return (
      <main style={mainStyle}>
        <Link href="/clients" style={backLinkStyle}>
          ← Back to Clients
        </Link>

        <div style={errorBoxStyle}>
          Error loading client: {clientError.message}
        </div>
      </main>
    );
  }

  if (!client) {
    return (
      <main style={mainStyle}>
        <Link href="/clients" style={backLinkStyle}>
          ← Back to Clients
        </Link>

        <div style={cardStyle}>
          <h1 style={{ marginTop: 0 }}>Client not found</h1>
          <p>This client record does not exist.</p>
        </div>
      </main>
    );
  }

  const typedClient = client as Client;
  const appointmentList = (appointments ?? []) as Appointment[];
  const serviceList = (services ?? []) as Service[];
  const stylistList = (stylists ?? []) as Stylist[];

  const serviceMap = new Map(serviceList.map((s) => [s.id, s]));
  const stylistMap = new Map(stylistList.map((s) => [s.id, s]));

  const fullName =
    `${typedClient.first_name ?? ""} ${typedClient.last_name ?? ""}`.trim() ||
    "Unnamed Client";

  return (
    <main style={mainStyle}>
      <div style={headerRowStyle}>
        <div>
          <Link href="/clients" style={backLinkStyle}>
            ← Back to Clients
          </Link>

          <h1 style={titleStyle}>{fullName}</h1>

          <p style={{ margin: 0, color: "#666" }}>
            Client profile and appointment history
          </p>
        </div>

        <Link href={`/clients/${id}/edit`} style={editButtonStyle}>
          Edit Client
        </Link>
      </div>

      <div style={gridStyle}>
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Client Info</h2>

          <p style={lineStyle}>
            <strong>Email:</strong> {typedClient.email || "—"}
          </p>

          <p style={lineStyle}>
            <strong>Phone:</strong> {typedClient.phone || "—"}
          </p>

          <div style={{ marginTop: 14 }}>
            <strong>Notes:</strong>

            <div style={notesBoxStyle}>
              {typedClient.notes || "No notes yet."}
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Appointment History</h2>

          {appointmentsError && (
            <div style={errorBoxStyle}>
              Error loading appointments: {appointmentsError.message}
            </div>
          )}

          {!appointmentsError && appointmentList.length === 0 ? (
            <p>No appointments found.</p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {appointmentList.map((appt) => {
                const service = appt.service_id
                  ? serviceMap.get(appt.service_id)
                  : null;

                const stylist = appt.stylist_id
                  ? stylistMap.get(appt.stylist_id)
                  : null;

                return (
                  <div key={appt.id} style={appointmentCardStyle}>
                    <div style={appointmentHeaderStyle}>
                      <div style={{ fontWeight: 700 }}>
                        {appt.appointment_date} at {appt.appointment_time}
                      </div>

                      <span style={statusStyle}>{appt.status}</span>
                    </div>

                    <p style={lineStyle}>
                      <strong>Service:</strong> {service?.name ?? "—"}
                    </p>

                    <p style={lineStyle}>
                      <strong>Stylist:</strong>{" "}
                      {stylist
                        ? `${stylist.first_name ?? ""} ${stylist.last_name ?? ""}`
                        : "—"}
                    </p>

                    <p style={lineStyle}>
                      <strong>Duration:</strong>{" "}
                      {service?.duration_minutes ?? "—"} min
                    </p>

                    <p style={lineStyle}>
                      <strong>Price:</strong>{" "}
                      {service?.price_cents != null
                        ? `$${(service.price_cents / 100).toFixed(2)}`
                        : "—"}
                    </p>

                    <p style={lineStyle}>
                      <strong>Notes:</strong> {appt.notes || "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
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

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 360px) 1fr",
  gap: 24,
  alignItems: "start",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 18,
  padding: 24,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
};

const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 16,
  fontSize: "1.2rem",
};

const notesBoxStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 12,
  borderRadius: 12,
  background: "#f8f8f8",
  minHeight: 70,
};

const appointmentCardStyle: React.CSSProperties = {
  border: "1px solid #e8e8e8",
  borderRadius: 16,
  padding: 18,
  background: "#fff",
};

const appointmentHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 10,
};

const statusStyle: React.CSSProperties = {
  background: "#eef6ff",
  padding: "6px 12px",
  borderRadius: 999,
  fontWeight: 700,
};

const lineStyle: React.CSSProperties = {
  margin: "6px 0",
};

const backLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "#111",
  fontWeight: 700,
};

const editButtonStyle: React.CSSProperties = {
  textDecoration: "none",
  padding: "12px 16px",
  borderRadius: 12,
  background: "#111",
  color: "#fff",
  fontWeight: 700,
};

const errorBoxStyle: React.CSSProperties = {
  background: "#ffe5e5",
  color: "#900",
  padding: 16,
  borderRadius: 12,
};