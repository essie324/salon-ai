import ModulePlaceholder from "@/app/dashboard/_components/ModulePlaceholder";
import { getActiveRole } from "@/app/lib/roleCookies";
import RoleGate from "@/app/dashboard/_components/RoleGate";

export default async function DashboardGoalsPage() {
  const role = await getActiveRole();

  return (
    <RoleGate role={role} allowed={["stylist", "manager", "admin"]}>
      <ModulePlaceholder
        title="Goals"
        description="Personal and team goals, streaks, and targets."
      />
    </RoleGate>
  );
}

