import Link from "next/link";
import { getActiveRole } from "@/app/lib/roleCookies";
import { roleLabel } from "@/app/lib/roles";

export default async function DashboardOverviewPage() {
  const role = await getActiveRole();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This is the dashboard shell foundation. Current role:{" "}
          <span className="font-medium">{roleLabel(role)}</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card
          title="Appointments"
          description="View, filter, and manage bookings."
          href="/dashboard/appointments"
        />
        <Card
          title="Clients"
          description="Client profiles, history, notes."
          href="/dashboard/clients"
        />
        <Card
          title="Earnings"
          description="Tips, commission, payouts."
          href="/dashboard/earnings"
        />
        <Card
          title="Settings"
          description="Business settings and configuration."
          href="/dashboard/settings"
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/20 dark:text-zinc-200">
        <p className="font-medium">Temporary role setup</p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Until real auth is added, role is stored in an httpOnly cookie. Use{" "}
          <Link href="/dashboard/settings" className="underline">
            Dashboard Settings
          </Link>{" "}
          to switch roles for development.
        </p>
      </div>
    </div>
  );
}

function Card({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        </div>
        <span className="text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-700 dark:group-hover:text-zinc-200">
          →
        </span>
      </div>
    </Link>
  );
}

