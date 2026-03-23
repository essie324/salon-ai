export type AppRole = "guest" | "stylist" | "manager" | "admin";

export type NavItem = {
  label: string;
  href: string;
  roles: AppRole[];
};

export const ALL_ROLES: AppRole[] = ["guest", "stylist", "manager", "admin"];

export function isAppRole(value: unknown): value is AppRole {
  return (
    value === "guest" ||
    value === "stylist" ||
    value === "manager" ||
    value === "admin"
  );
}

export function normalizeRole(value: unknown): AppRole {
  return isAppRole(value) ? value : "guest";
}

export function roleLabel(role: AppRole) {
  switch (role) {
    case "guest":
      return "Guest";
    case "stylist":
      return "Stylist";
    case "manager":
      return "Manager";
    case "admin":
      return "Admin";
  }
}

export function roleAtLeast(role: AppRole, minimum: Exclude<AppRole, "guest">) {
  const rank: Record<AppRole, number> = {
    guest: 0,
    stylist: 1,
    manager: 2,
    admin: 3,
  };
  return rank[role] >= rank[minimum];
}

export function canAccess(role: AppRole, allowed: AppRole[]) {
  return allowed.includes(role);
}

export const DASHBOARD_NAV: NavItem[] = [
  { label: "Overview", href: "/dashboard", roles: ALL_ROLES },
  { label: "Appointments", href: "/dashboard/appointments", roles: ALL_ROLES },
  { label: "Clients", href: "/dashboard/clients", roles: ["stylist", "manager", "admin"] },
  { label: "Services", href: "/dashboard/services", roles: ["manager", "admin"] },
  { label: "Stylists", href: "/dashboard/stylists", roles: ["manager", "admin"] },
  { label: "Strategy", href: "/dashboard/strategy", roles: ["admin"] },
  { label: "Earnings", href: "/dashboard/earnings", roles: ["stylist", "manager", "admin"] },
  { label: "Goals", href: "/dashboard/goals", roles: ["stylist", "manager", "admin"] },
  { label: "Rewards", href: "/dashboard/rewards", roles: ["stylist", "manager", "admin"] },
  { label: "Marketing", href: "/dashboard/marketing", roles: ["manager", "admin"] },
  { label: "Settings", href: "/dashboard/settings", roles: ["manager", "admin"] },
];

export function navForRole(role: AppRole) {
  return DASHBOARD_NAV.filter((item) => item.roles.includes(role));
}

