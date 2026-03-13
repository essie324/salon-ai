import ModulePlaceholder from "@/app/dashboard/_components/ModulePlaceholder";
import { getActiveRole } from "@/app/lib/roleCookies";
import RoleGate from "@/app/dashboard/_components/RoleGate";

export default async function DashboardMarketingPage() {
  const role = await getActiveRole();

  return (
    <RoleGate role={role} allowed={["manager", "admin"]}>
      <ModulePlaceholder
        title="Marketing"
        description="Campaigns, promos, referrals, and outreach."
      />
    </RoleGate>
  );
}

