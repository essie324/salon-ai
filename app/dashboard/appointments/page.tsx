import Link from "next/link";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { DayScheduler } from "@/app/components/calendar/DayScheduler";
import type { StylistForScheduler, AppointmentForScheduler } from "@/app/components/calendar/DayScheduler";

type Appointment = {
  id: string;
  start_at: string;
  end_at: string | null;
  status: string;
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
};

type Stylist = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function getTodayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default async function DashboardAppointmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const resolved = await searchParams;
  const dateParam = resolved?.date?.trim();
  const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getTodayISO();

  const [
    { data: appointments, error: appointmentsError },
    { data: clients },
    { data: services },
    { data: stylists },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, start_at, end_at, status, client_id, service_id, stylist_id")
      .eq("appointment_date", selectedDate)
      .order("start_at", { ascending: true }),
    supabase.from("clients").select("id, first_name, last_name"),
    supabase.from("services").select("id, name, duration_minutes"),
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

  const enrichedAppointments: AppointmentForScheduler[] = appointmentList.map((appt) => {
    const client = appt.client_id ? clientMap.get(appt.client_id) : null;
    const service = appt.service_id ? serviceMap.get(appt.service_id) : null;
    const clientName =
      client && `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
        ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
        : "Unknown";
    return {
      id: appt.id,
      start_at: appt.start_at,
      end_at: appt.end_at,
      status: appt.status,
      stylist_id: appt.stylist_id,
      clientName,
      serviceName: service?.name ?? "—",
      durationMinutes: service?.duration_minutes ?? undefined,
    };
  });

  const stylistsForScheduler: StylistForScheduler[] = stylistList;

  const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
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
              marginBottom: 8,
            }}
          >
            ← Back to Dashboard
          </Link>
          <h1 style={{ fontSize: "1.75rem", margin: "0 0 4px 0" }}>Appointments</h1>
          <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
            Day view · 8:00 – 18:00 · 30-min slots
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <form method="get" action="/dashboard/appointments" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label htmlFor="date" style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>
              Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              defaultValue={selectedDate}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #d8d8d8",
                fontSize: 14,
              }}
            />
            <button
              type="submit"
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Go
            </button>
          </form>
          <Link
            href="/dashboard/appointments/new"
            style={{
              display: "inline-block",
              textDecoration: "none",
              padding: "10px 16px",
              borderRadius: 12,
              background: "#111",
              color: "#fff",
              fontWeight: 700,
              whiteSpace: "nowrap",
              fontSize: 14,
            }}
          >
            Create Appointment
          </Link>
        </div>
      </div>

      {appointmentsError && (
        <div
          style={{
            background: "#ffe5e5",
            color: "#900",
            padding: 16,
            borderRadius: 12,
          }}
        >
          Error loading appointments: {appointmentsError.message}
        </div>
      )}

      {!appointmentsError && (
        <>
          <p style={{ margin: 0, fontSize: 14, color: "#666", fontWeight: 600 }}>
            {dateLabel}
          </p>
          {stylistList.length === 0 ? (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e5e5",
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
              }}
            >
              <p style={{ margin: 0 }}>No active stylists. Add stylists to see the schedule.</p>
            </div>
          ) : (
            <DayScheduler
              date={selectedDate}
              stylists={stylistsForScheduler}
              appointments={enrichedAppointments}
            />
          )}
        </>
      )}
    </div>
  );
}
