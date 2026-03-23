import Link from "next/link";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { getActiveRole } from "@/app/lib/roleCookies";
import RoleGate from "@/app/dashboard/_components/RoleGate";

type Stylist = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean | null;
};

type Service = {
  id: string;
  name: string | null;
  duration_minutes: number | null;
};

type WorkingHour = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working: boolean;
};

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function DashboardStylistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const role = await getActiveRole();
  const supabase = await createSupabaseServerClient();
  const { id } = await params;

  const { data: stylist, error: stylistError } = await supabase
    .from("stylists")
    .select("id, first_name, last_name, is_active")
    .eq("id", id)
    .maybeSingle();

  if (stylistError || !stylist) {
    return (
      <RoleGate role={role} allowed={["manager", "admin"]}>
        <main
          style={{
            padding: 40,
            fontFamily: "Arial, sans-serif",
            maxWidth: 700,
            margin: "0 auto",
          }}
        >
          <Link
            href="/dashboard/stylists"
            style={{
              textDecoration: "none",
              fontWeight: 700,
              color: "#111",
              display: "inline-block",
              marginBottom: 10,
            }}
          >
            ← Back to Stylists
          </Link>
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e5e5",
              borderRadius: 18,
              padding: 24,
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            }}
          >
            <h1 style={{ marginTop: 0 }}>Stylist not found</h1>
            <p style={{ margin: 0, color: "#555" }}>
              This stylist does not exist or may have been removed.
            </p>
          </div>
        </main>
      </RoleGate>
    );
  }

  const [{ data: eligibilityRows }, { data: services }, { data: workingRows }] = await Promise.all([
    supabase.from("stylist_services").select("service_id").eq("stylist_id", id),
    supabase.from("services").select("id, name, duration_minutes").order("name", { ascending: true }),
    supabase
      .from("stylist_working_hours")
      .select("day_of_week, start_time, end_time, is_working")
      .eq("stylist_id", id)
      .order("day_of_week", { ascending: true }),
  ]);

  const assignedServiceIds = new Set((eligibilityRows ?? []).map((r) => r.service_id));

  const serviceList = (services ?? []) as Service[];
  const assignedServices = serviceList.filter((s) => assignedServiceIds.has(s.id));

  const workingByDay = new Map<number, WorkingHour>();
  for (const row of (workingRows ?? []) as WorkingHour[]) {
    workingByDay.set(row.day_of_week, {
      day_of_week: row.day_of_week,
      start_time: String(row.start_time),
      end_time: String(row.end_time),
      is_working: !!row.is_working,
    });
  }

  const name =
    `${(stylist as Stylist).first_name ?? ""} ${(stylist as Stylist).last_name ?? ""}`.trim() ||
    "Unnamed Stylist";

  return (
    <RoleGate role={role} allowed={["manager", "admin"]}>
      <main
        style={{
          padding: 40,
          fontFamily: "Arial, sans-serif",
          maxWidth: 800,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <Link
              href="/dashboard/stylists"
              style={{
                textDecoration: "none",
                fontWeight: 700,
                color: "#111",
                display: "inline-block",
                marginBottom: 10,
              }}
            >
              ← Back to Stylists
            </Link>
            <h1 style={{ fontSize: "2rem", margin: "0 0 8px 0" }}>{name}</h1>
            <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
              {(stylist as Stylist).is_active !== false ? "Active" : "Inactive"}
            </p>
          </div>

          <Link
            href={`/dashboard/stylists/${id}/availability`}
            style={{
              textDecoration: "none",
              padding: "10px 16px",
              borderRadius: 12,
              background: "#0b57d0",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            Manage availability
          </Link>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: 18,
            padding: 24,
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Weekly hours</h2>
            <Link
              href={`/dashboard/stylists/${id}/availability`}
              style={{
                textDecoration: "none",
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid #d4d4d4",
                background: "#fff",
                color: "#111",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Edit working hours
            </Link>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#444" }}>
            {DAY_LABELS.map((label, idx) => {
              const row = workingByDay.get(idx);
              if (!row || !row.is_working) {
                return (
                  <li key={idx} style={{ marginBottom: 4 }}>
                    <strong>{label}:</strong> Off
                  </li>
                );
              }
              return (
                <li key={idx} style={{ marginBottom: 4 }}>
                  <strong>{label}:</strong> {String(row.start_time).slice(0, 5)}–{" "}
                  {String(row.end_time).slice(0, 5)}
                </li>
              );
            })}
          </ul>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: 18,
            padding: 24,
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Services this stylist can perform</h2>
            <Link
              href={`/dashboard/stylists/${id}/services`}
              style={{
                textDecoration: "none",
                padding: "10px 16px",
                borderRadius: 12,
                background: "#0b57d0",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Manage services
            </Link>
          </div>
          {assignedServices.length === 0 ? (
            <p style={{ margin: 0, color: "#555" }}>
              No services assigned yet. Booking will treat this stylist as eligible for all
              services until you add assignments. Click &quot;Manage services&quot; to assign.
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {assignedServices.map((s) => (
                <li key={s.id} style={{ marginBottom: 6 }}>
                  {s.name ?? "Unnamed"}
                  {s.duration_minutes != null ? ` — ${s.duration_minutes} min` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </RoleGate>
  );
}
