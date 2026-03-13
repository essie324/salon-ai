import Link from "next/link";
import ModulePlaceholder from "@/app/dashboard/_components/ModulePlaceholder";

export default function DashboardAppointmentsPage() {
  return (
    <div className="space-y-6">
      <ModulePlaceholder
        title="Appointments"
        description="Dashboard-safe entry point for appointment workflows."
        actions={[
          { label: "Open legacy calendar", href: "/appointments" },
          { label: "Create appointment", href: "/appointments/new" },
        ]}
      />

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/20 dark:text-zinc-200">
        <p className="font-medium">Note</p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Your current working calendar is still at{" "}
          <Link href="/appointments" className="underline">
            /appointments
          </Link>
          . This dashboard route is the stable home for future refactors.
        </p>
      </div>
    </div>
  );
}

