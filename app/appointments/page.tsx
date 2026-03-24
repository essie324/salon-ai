import AppointmentActions from "../components/AppointmentActions";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

type Appointment = {
  id: string;
  start_at: string;
  end_at: string | null;
  // Legacy compatibility fields kept during migration
  appointment_date?: string;
  appointment_time?: string;
  status: string;
  notes: string | null;
  client_id: string | null;
  service_id: string | null;
  stylist_id: string | null;
};

type Client = {
  id: string;
  first_name: string | null;
  last_name: string | null;
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

function formatDateLabelFromStart(startIso: string) {
  const date = new Date(startIso);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeRange(startIso: string, endIso: string | null) {
  const start = new Date(startIso);
  const startTime = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (!endIso) return startTime;

  const end = new Date(endIso);
  const endTime = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${startTime} – ${endTime}`;
}

function groupByStartDate(appointments: Appointment[]) {
  const groups: Record<string, Appointment[]> = {};

  for (const appt of appointments) {
    const dateKey = new Date(appt.start_at).toISOString().slice(0, 10);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(appt);
  }

  return groups;
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ stylist?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedStylistId = resolvedSearchParams?.stylist ?? "all";

  const [
    { data: appointments, error },
    { data: clients },
    { data: services },
    { data: stylists },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("*")
      .order("start_at", { ascending: true }),
    supabase.from("clients").select("id, first_name, last_name"),
    supabase.from("services").select("id, name, duration_minutes, price_cents"),
    supabase
      .from("stylists")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("first_name", { ascending: true }),
  ]);

  const appointmentList = (appointments ?? []) as Appointment[];
  const clientList = (clients ?? []) as Client[];
  const serviceList = (services ?? []) as Service[];
  const stylistList = (stylists ?? []) as Stylist[];

  const clientMap = new Map(clientList.map((c) => [c.id, c]));
  const serviceMap = new Map(serviceList.map((s) => [s.id, s]));
  const stylistMap = new Map(stylistList.map((s) => [s.id, s]));

  const filteredAppointments =
    selectedStylistId === "all"
      ? appointmentList
      : appointmentList.filter((appt) => appt.stylist_id === selectedStylistId);

  const statusReturnTo =
    selectedStylistId === "all"
      ? "/appointments"
      : `/appointments?stylist=${encodeURIComponent(selectedStylistId)}`;

  const groupedAppointments = groupByStartDate(filteredAppointments);
  const sortedDates = Object.keys(groupedAppointments).sort();

  return (
    <main
      style={{
        padding: 40,
        fontFamily: "Arial, sans-serif",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          marginBottom: 32,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: "2.2rem", marginBottom: 8 }}>Appointment Calendar</h1>
          <p style={{ color: "#666", margin: 0 }}>
            Daily schedule view for upcoming salon bookings.
          </p>
        </div>

        <Link
          href="/appointments/new"
          style={{
            textDecoration: "none",
            padding: "12px 16px",
            borderRadius: 12,
            background: "#111",
            color: "#fff",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          + Create Appointment
        </Link>
      </div>

      <section
        style={{
          marginBottom: 28,
          background: "#fff",
          border: "1px solid #e8e8e8",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
        }}
      >
        <h2 style={{ fontSize: "1rem", margin: "0 0 12px 0" }}>Filter by Stylist</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/appointments"
            style={{
              ...filterButtonStyle,
              background: selectedStylistId === "all" ? "#111" : "#fff",
              color: selectedStylistId === "all" ? "#fff" : "#111",
            }}
          >
            All Stylists
          </Link>

          {stylistList.map((stylist) => {
            const fullName = `${stylist.first_name ?? ""} ${stylist.last_name ?? ""}`.trim();

            return (
              <Link
                key={stylist.id}
                href={`/appointments?stylist=${stylist.id}`}
                style={{
                  ...filterButtonStyle,
                  background: selectedStylistId === stylist.id ? "#111" : "#fff",
                  color: selectedStylistId === stylist.id ? "#fff" : "#111",
                }}
              >
                {fullName || "Unnamed Stylist"}
              </Link>
            );
          })}
        </div>
      </section>

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
          Error loading appointments: {error.message}
        </div>
      )}

      {sortedDates.length === 0 ? (
        <p>No appointments found.</p>
      ) : (
        <div style={{ display: "grid", gap: 28 }}>
          {sortedDates.map((dateKey) => (
            <section key={dateKey}>
              <h2
                style={{
                  fontSize: "1.35rem",
                  marginBottom: 14,
                  paddingBottom: 8,
                  borderBottom: "2px solid #eee",
                }}
              >
                {formatDateLabelFromStart(groupedAppointments[dateKey][0].start_at)}
              </h2>

              <div style={{ display: "grid", gap: 14 }}>
                {groupedAppointments[dateKey].map((appt) => {
                  const client = appt.client_id ? clientMap.get(appt.client_id) : null;
                  const service = appt.service_id ? serviceMap.get(appt.service_id) : null;
                  const stylist = appt.stylist_id ? stylistMap.get(appt.stylist_id) : null;

                  return (
                    <div
                      key={appt.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "140px 1fr 220px",
                        gap: 18,
                        alignItems: "center",
                        background: "#fff",
                        border: "1px solid #e8e8e8",
                        borderRadius: 16,
                        padding: 18,
                        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                          {formatTimeRange(appt.start_at, appt.end_at)}
                        </div>
                        <div style={{ color: "#666", marginTop: 4 }}>
                          {service?.duration_minutes ?? "—"} min
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6 }}>
                          {client?.first_name ?? "Unknown"} {client?.last_name ?? ""}
                        </div>

                        <div style={{ marginBottom: 4 }}>
                          <strong>Service:</strong> {service?.name ?? "—"}
                        </div>

                        <div style={{ marginBottom: 4 }}>
                          <strong>Stylist:</strong> {stylist?.first_name ?? "—"}{" "}
                          {stylist?.last_name ?? ""}
                        </div>

                        <div style={{ marginBottom: 4 }}>
                          <strong>Price:</strong>{" "}
                          {service?.price_cents != null
                            ? `$${(service.price_cents / 100).toFixed(2)}`
                            : "—"}
                        </div>

                        <div>
                          <strong>Notes:</strong> {appt.notes || "—"}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ marginBottom: 12 }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "8px 12px",
                              borderRadius: 999,
                              background:
                                appt.status === "scheduled"
                                  ? "#eef6ff"
                                  : appt.status === "completed"
                                  ? "#ebfff0"
                                  : appt.status === "cancelled"
                                  ? "#fff1f1"
                                  : "#f5f5f5",
                              color:
                                appt.status === "scheduled"
                                  ? "#0b57d0"
                                  : appt.status === "completed"
                                  ? "#137333"
                                  : appt.status === "cancelled"
                                  ? "#b42318"
                                  : "#555",
                              fontWeight: 700,
                              textTransform: "capitalize",
                            }}
                          >
                            {appt.status}
                          </span>
                        </div>

                        <AppointmentActions id={appt.id} returnTo={statusReturnTo} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

const filterButtonStyle: React.CSSProperties = {
  textDecoration: "none",
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid #ddd",
  fontWeight: 700,
};