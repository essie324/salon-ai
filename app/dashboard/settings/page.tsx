import { redirect } from "next/navigation";
import ModulePlaceholder from "@/app/dashboard/_components/ModulePlaceholder";
import { getActiveRole, setActiveRole } from "@/app/lib/roleCookies";
import { ALL_ROLES, roleLabel, type AppRole } from "@/app/lib/roles";
import RoleGate from "@/app/dashboard/_components/RoleGate";

async function setRoleAction(formData: FormData) {
  "use server";
  const role = String(formData.get("role") || "guest") as AppRole;
  await setActiveRole(role);
  redirect("/dashboard");
}

export default async function DashboardSettingsPage() {
  const role = await getActiveRole();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Manager/admin settings will live here. A dev-only role switcher is
          included until auth is implemented.
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 md:p-6">
        <h2 className="text-sm font-semibold">Temporary role switcher</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Current role: <span className="font-medium">{roleLabel(role)}</span>
        </p>

        <form action={setRoleAction} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Role
            </span>
            <select
              name="role"
              defaultValue={role}
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Switch role
          </button>
        </form>

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
          This writes an httpOnly cookie (`salon_role`). Replace this with real
          Supabase auth + profile roles later.
        </p>
      </section>

      <section className="space-y-3">
        <RoleGate
          role={role}
          allowed={["manager", "admin"]}
          fallback={
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/20 dark:text-zinc-200">
              <p className="font-medium">Manager/Admin settings</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                Switch to Manager or Admin to see settings modules.
              </p>
            </div>
          }
        >
          <ModulePlaceholder
            title="Settings modules"
            description="Business settings placeholders (taxes, hours, policies, staff)."
          />
        </RoleGate>
      </section>
    </div>
  );
}

