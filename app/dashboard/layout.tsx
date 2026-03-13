import DashboardShell from "@/app/components/dashboard/DashboardShell";
import { getActiveRole } from "@/app/lib/roleCookies";
import { navForRole } from "@/app/lib/roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getActiveRole();
  const navItems = navForRole(role);

  return (
    <DashboardShell role={role} navItems={navItems}>
      {children}
    </DashboardShell>
  );
}

