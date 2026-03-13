import ModulePlaceholder from "@/app/dashboard/_components/ModulePlaceholder";
import { getActiveRole } from "@/app/lib/roleCookies";
import RoleGate from "@/app/dashboard/_components/RoleGate";

export default async function DashboardServicesPage() {
  const role = await getActiveRole();

  return (
    <RoleGate role={role} allowed={["manager", "admin"]}>
      <ModulePlaceholder
        title="Services"
        description="Service catalog, pricing, add-ons, and durations."
        actions={[{ label: "Legacy services route", href: "/services" }]}
      />
    </RoleGate>
  );
}

