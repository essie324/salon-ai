import { redirect } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

async function createAppointment(formData: FormData) {
  "use server";

  const client_id = String(formData.get("client_id") || "");
  const service_id = String(formData.get("service_id") || "");
  const stylist_id = String(formData.get("stylist_id") || "");
  const appointment_date = String(formData.get("appointment_date") || "");
  const appointment_time = String(formData.get("appointment_time") || "");
  const notes = String(formData.get("notes") || "");
  const status = "scheduled";

  if (!client_id || !service_id || !stylist_id || !appointment_date || !appointment_time) {
    return;
  }

  // Compute start_at from the selected date and time.
  // The browser sends local date/time; we store as ISO. Adjust later if you
  // introduce explicit salon timezones.
  const startAtLocal = new Date(`${appointment_date}T${appointment_time}`);
  const start_at = startAtLocal.toISOString();

  // Look up service duration to compute end_at. If not available, default to 60 minutes.
  const { data: serviceRow } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", service_id)
    .maybeSingle();

  const durationMinutes =
    serviceRow && (serviceRow as any).duration_minutes != null
      ? Number((serviceRow as any).duration_minutes)
      : 60;

  const endAtLocal = new Date(startAtLocal.getTime() + durationMinutes * 60 * 1000);
  const end_at = endAtLocal.toISOString();

  const { error } = await supabase.from("appointments").insert({
    client_id,
    service_id,
    stylist_id,
    // New scheduling source of truth
    start_at,
    end_at,
    // Temporary compatibility fields
    appointment_date,
    appointment_time,
    notes,
    status,
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/appointments");
}

export default async function NewAppointmentPage() {
  const [
    { data: clients },
    { data: services },
    { data: stylists },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, first_name, last_name")
      .order("first_name", { ascending: true }),
    supabase
      .from("services")
      .select("id, name, duration_minutes, price_cents")
      .order("name", { ascending: true }),
    supabase
      .from("stylists")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("first_name", { ascending: true }),
  ]);

  return (
    <main
      style={{
        padding: 40,
        fontFamily: "Arial, sans-serif",
        maxWidth: 760,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
        }}
      >
        <div>
          <h1 style={{ fontSize: "2rem", margin: "0 0 8px 0" }}>New Appointment</h1>
          <p style={{ margin: 0, color: "#666" }}>
            Create a new salon booking.
          </p>
        </div>

        <Link
          href="/appointments"
          style={{
            textDecoration: "none",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            color: "#111",
            background: "#fff",
          }}
        >
          Back to Calendar
        </Link>
      </div>

      <form
        action={createAppointment}
        style={{
          display: "grid",
          gap: 18,
          background: "#fff",
          border: "1px solid #e5e5e5",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
        }}
      >
        <div>
          <label htmlFor="client_id" style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
            Client
          </label>
          <select id="client_id" name="client_id" required style={inputStyle} defaultValue="">
            <option value="" disabled>Select a client</option>
            {clients?.map((client) => (
              <option key={client.id} value={client.id}>
                {client.first_name} {client.last_name ?? ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="service_id" style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
            Service
          </label>
          <select id="service_id" name="service_id" required style={inputStyle} defaultValue="">
            <option value="" disabled>Select a service</option>
            {services?.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} — {service.duration_minutes ?? "—"} min —{" "}
                {service.price_cents != null ? `$${(service.price_cents / 100).toFixed(2)}` : "—"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="stylist_id" style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
            Stylist
          </label>
          <select id="stylist_id" name="stylist_id" required style={inputStyle} defaultValue="">
            <option value="" disabled>Select a stylist</option>
            {stylists?.map((stylist) => (
              <option key={stylist.id} value={stylist.id}>
                {stylist.first_name} {stylist.last_name ?? ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label htmlFor="appointment_date" style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
              Date
            </label>
            <input id="appointment_date" name="appointment_date" type="date" required style={inputStyle} />
          </div>

          <div>
            <label htmlFor="appointment_time" style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
              Time
            </label>
            <input id="appointment_time" name="appointment_time" type="time" required style={inputStyle} />
          </div>
        </div>

        <div>
          <label htmlFor="notes" style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            placeholder="Consultation notes, special requests, color history, etc."
            style={{ ...inputStyle, resize: "vertical", minHeight: 110 }}
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
          Save Appointment
        </button>
      </form>
    </main>
  );
}

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