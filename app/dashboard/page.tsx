import Link from "next/link";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const [
    { count: clientsCount },
    { count: appointmentsCount },
    { count: servicesCount },
    { count: stylistsCount },
  ] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("appointments").select("*", { count: "exact", head: true }),
    supabase.from("services").select("*", { count: "exact", head: true }),
    supabase.from("stylists").select("*", { count: "exact", head: true }),
  ]);

  return (
    <main
      style={{
        padding: 40,
        fontFamily: "Arial, sans-serif",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "2.4rem", margin: "0 0 10px 0" }}>
          Salon Dashboard
        </h1>
        <p style={{ margin: 0, color: "#666" }}>
          Your operating center for clients, bookings, services, and stylists.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 18,
          marginBottom: 32,
        }}
      >
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Clients</div>
          <div style={statNumberStyle}>{clientsCount ?? 0}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Appointments</div>
          <div style={statNumberStyle}>{appointmentsCount ?? 0}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Services</div>
          <div style={statNumberStyle}>{servicesCount ?? 0}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Stylists</div>
          <div style={statNumberStyle}>{stylistsCount ?? 0}</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 18,
        }}
      >
        <Link href="/dashboard/clients" style={cardLinkStyle}>
          <div style={featureCardStyle}>
            <h2 style={cardTitleStyle}>Clients</h2>
            <p style={cardTextStyle}>
              Search, view, and manage client records.
            </p>
          </div>
        </Link>

        <Link href="/appointments" style={cardLinkStyle}>
          <div style={featureCardStyle}>
            <h2 style={cardTitleStyle}>Appointments</h2>
            <p style={cardTextStyle}>
              View the calendar, create bookings, and manage statuses.
            </p>
          </div>
        </Link>

        <Link href="/clients/new" style={cardLinkStyle}>
          <div style={featureCardStyle}>
            <h2 style={cardTitleStyle}>New Client</h2>
            <p style={cardTextStyle}>
              Quickly add a new client record for front-desk intake.
            </p>
          </div>
        </Link>

        <Link href="/dashboard/appointments/new" style={cardLinkStyle}>
          <div style={featureCardStyle}>
            <h2 style={cardTitleStyle}>New Appointment</h2>
            <p style={cardTextStyle}>
              Book a new appointment with client, service, and stylist.
            </p>
          </div>
        </Link>
      </div>
    </main>
  );
}

const statCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
};

const statLabelStyle: React.CSSProperties = {
  color: "#666",
  fontWeight: 700,
  marginBottom: 10,
};

const statNumberStyle: React.CSSProperties = {
  fontSize: "2rem",
  fontWeight: 800,
  color: "#111",
};

const cardLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "inherit",
};

const featureCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  height: "100%",
};

const cardTitleStyle: React.CSSProperties = {
  margin: "0 0 10px 0",
  fontSize: "1.2rem",
};

const cardTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#555",
  lineHeight: 1.5,
};