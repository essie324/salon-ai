import { cookies } from "next/headers";
import { normalizeRole, type AppRole } from "./roles";
import { getCurrentUserWithProfile } from "./auth";

const ROLE_COOKIE = "salon_role";

export async function getActiveRole(): Promise<AppRole> {
  // Primary source: Supabase auth + profiles table
  const current = await getCurrentUserWithProfile();
  if (current) {
    return current.role;
  }

  // Compatibility fallback: legacy cookie-based role,
  // kept for local development and non-auth flows.
  const store = await cookies();
  return normalizeRole(store.get(ROLE_COOKIE)?.value);
}

export async function setActiveRole(role: AppRole) {
  const store = await cookies();
  store.set(ROLE_COOKIE, role, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
}

