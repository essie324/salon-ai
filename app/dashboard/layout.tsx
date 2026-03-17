import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "../lib/auth";
import { getActiveRole } from "../lib/roleCookies";
import { navForRole } from "../lib/roles";
import DashboardShell from "../components/dashboard/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUserWithProfile();

  if (!currentUser) {
    redirect("/login?redirect=/dashboard");
  }

  if (!currentUser.id || !currentUser.email) {
    redirect("/profile/setup");
  }

  const role = await getActiveRole();
  const navItems = navForRole(role);

  return (
    <DashboardShell navItems={navItems} role={role}>
      {children}
    </DashboardShell>
  );
}

