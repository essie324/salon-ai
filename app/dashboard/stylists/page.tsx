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

export default async function DashboardStylistsPage() {
  const role = await getActiveRole();
  const supabase = await createSupabaseServerClient();

  const { data: stylists } = await supabase
    .from("stylists")
    .select("id, first_name, last_name, is_active")
    .order("first_name", { ascending: true });

  const list = (stylists ?? []) as Stylist[];

  return (
    <RoleGate role={role} allowed={["manager", "admin"]}>
      <main
        style={{
          padding: 40,
          fontFamily: "Arial, sans-serif",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: 28 }}>
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
          <h1 style={{ fontSize: "2.2rem", margin: "0 0 8px 0" }}>Stylists</h1>
          <p style={{ margin: 0, color: "#666" }}>
            Manage stylists and which services they can perform.
          </p>
        </div>

        {list.length === 0 ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e5e5",
              borderRadius: 18,
              padding: 24,
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            }}
          >
            <p style={{ margin: 0 }}>No stylists found.</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 18,
            }}
          >
            {list.map((stylist) => {
              const name =
                `${stylist.first_name ?? ""} ${stylist.last_name ?? ""}`.trim() ||
                "Unnamed Stylist";
              return (
                <Link
                  key={stylist.id}
                  href={`/dashboard/stylists/${stylist.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
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
                      {name}
                    </h2>
                    <p style={{ margin: "6px 0", color: "#555", fontSize: 14 }}>
                      {stylist.is_active !== false ? "Active" : "Inactive"}
                    </p>
                    <p style={{ margin: "10px 0 0", fontSize: 13, color: "#0b57d0", fontWeight: 600 }}>
                      Manage services →
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </RoleGate>
  );
}
