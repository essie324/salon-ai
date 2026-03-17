import { cookies } from "next/headers";
import { normalizeRole, type AppRole } from "./roles";
import { getCurrentUserWithProfile } from "./auth";

const ROLE_COOKIE = "salon_role";

export async function getActiveRole(): Promise<AppRole> {
  // Primary source of truth:
  // - Supabase auth session + `public.profiles.role`
  // - This must always win when the user is authenticated.
  const current = await getCurrentUserWithProfile();
  if (current) {
    return current.role;
  }

  // Dev/compatibility fallback ONLY:
  // - Used for local development and non-auth flows.
  // - Must never override an authenticated user's profile role.
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

