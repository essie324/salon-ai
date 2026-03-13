import type { AppRole } from "@/app/lib/roles";
import { canAccess, roleLabel } from "@/app/lib/roles";

export default function RoleGate({
  role,
  allowed,
  children,
  fallback,
}: {
  role: AppRole;
  allowed: AppRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (canAccess(role, allowed)) return children;

  return (
    fallback ?? (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Not authorized</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your current role is <span className="font-medium">{roleLabel(role)}</span>.
        </p>
      </div>
    )
  );
}

