import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { getActiveRole } from "@/app/lib/roleCookies";
import RoleGate from "@/app/dashboard/_components/RoleGate";

type Service = {
  id: string;
  name: string | null;
  duration_minutes: number | null;
};

async function saveStylistServices(stylistId: string, formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const assigned = formData.getAll("assigned") as string[];
  const validIds = assigned.filter(Boolean);

  const { data: existing } = await supabase
    .from("stylist_services")
    .select("id, service_id")
    .eq("stylist_id", stylistId);

  const currentSet = new Set((existing ?? []).map((r) => r.service_id));
  const desiredSet = new Set(validIds);

  const toDelete = [...currentSet].filter((id) => !desiredSet.has(id));
  const toInsert = [...desiredSet].filter((id) => !currentSet.has(id));

  for (const serviceId of toDelete) {
    await supabase
      .from("stylist_services")
      .delete()
      .eq("stylist_id", stylistId)
      .eq("service_id", serviceId);
  }
  for (const serviceId of toInsert) {
    await supabase.from("stylist_services").insert({
      stylist_id: stylistId,
      service_id: serviceId,
    });
  }

  redirect(`/dashboard/stylists/${stylistId}`);
}

export default async function DashboardStylistServicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const role = await getActiveRole();
  const supabase = await createSupabaseServerClient();
  const { id: stylistId } = await params;

  const { data: stylist, error: stylistError } = await supabase
    .from("stylists")
    .select("id, first_name, last_name")
    .eq("id", stylistId)
    .maybeSingle();

  if (stylistError || !stylist) {
    return (
      <RoleGate role={role} allowed={["manager", "admin"]}>
        <main
          style={{
            padding: 40,
            fontFamily: "Arial, sans-serif",
            maxWidth: 560,
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
          </div>
        </main>
      </RoleGate>
    );
  }

  const [
    { data: services },
    { data: eligibilityRows },
  ] = await Promise.all([
    supabase.from("services").select("id, name, duration_minutes").order("name", { ascending: true }),
    supabase.from("stylist_services").select("service_id").eq("stylist_id", stylistId),
  ]);

  const serviceList = (services ?? []) as Service[];
  const assignedServiceIds = new Set((eligibilityRows ?? []).map((r) => r.service_id));
  const stylistName =
    `${stylist.first_name ?? ""} ${stylist.last_name ?? ""}`.trim() || "Unnamed Stylist";

  const saveAction = saveStylistServices.bind(null, stylistId);

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  };
  const labelStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    cursor: "pointer",
    fontSize: 15,
  };

  return (
    <RoleGate role={role} allowed={["manager", "admin"]}>
      <main
        style={{
          padding: 40,
          fontFamily: "Arial, sans-serif",
          maxWidth: 560,
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <Link
            href={`/dashboard/stylists/${stylistId}`}
            style={{
              textDecoration: "none",
              fontWeight: 700,
              color: "#111",
              display: "inline-block",
              marginBottom: 10,
            }}
          >
            ← Back to {stylistName}
          </Link>
          <h1 style={{ fontSize: "2rem", margin: "0 0 8px 0" }}>
            Manage services for {stylistName}
          </h1>
          <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
            Check the services this stylist can perform. Uncheck to remove. Saving updates
            booking eligibility and alternate stylist suggestions.
          </p>
        </div>

        <form action={saveAction} style={{ ...cardStyle, display: "grid", gap: 8 }}>
          {serviceList.map((s) => (
            <label key={s.id} style={labelStyle}>
              <input
                type="checkbox"
                name="assigned"
                value={s.id}
                defaultChecked={assignedServiceIds.has(s.id)}
                style={{ width: 18, height: 18 }}
              />
              <span>
                {s.name ?? "Unnamed"}
                {s.duration_minutes != null ? ` — ${s.duration_minutes} min` : ""}
              </span>
            </label>
          ))}
          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <button
              type="submit"
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "none",
                background: "#0b57d0",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Save changes
            </button>
            <Link
              href={`/dashboard/stylists/${stylistId}`}
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid #d4d4d4",
                background: "#fff",
                color: "#111",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </RoleGate>
  );
}
