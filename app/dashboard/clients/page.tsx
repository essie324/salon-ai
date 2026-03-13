import ModulePlaceholder from "@/app/dashboard/_components/ModulePlaceholder";
import { getActiveRole } from "@/app/lib/roleCookies";
import RoleGate from "@/app/dashboard/_components/RoleGate";

export default async function DashboardClientsPage() {
  const role = await getActiveRole();

  return (
    <RoleGate role={role} allowed={["stylist", "manager", "admin"]}>
      <ModulePlaceholder
        title="Clients"
        description="Client profiles, visit history, and notes."
        actions={[{ label: "Legacy clients route", href: "/clients" }]}
      />
    </RoleGate>
  );
}

