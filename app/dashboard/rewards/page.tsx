import ModulePlaceholder from "@/app/dashboard/_components/ModulePlaceholder";
import { getActiveRole } from "@/app/lib/roleCookies";
import RoleGate from "@/app/dashboard/_components/RoleGate";

export default async function DashboardRewardsPage() {
  const role = await getActiveRole();

  return (
    <RoleGate role={role} allowed={["stylist", "manager", "admin"]}>
      <ModulePlaceholder
        title="Rewards"
        description="Loyalty, incentives, and staff rewards."
      />
    </RoleGate>
  );
}

