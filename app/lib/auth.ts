import { createSupabaseServerClient } from "./supabaseServer";
import type { AppRole } from "./roles";

export type CurrentUserProfile = {
  id: string | null;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  salon_id: string | null;
  location_id: string | null;
};

function normalizeRole(role: string | null | undefined) {
  if (!role) return "guest";

  // Supabase `profiles.role` may contain legacy role names. We normalize into
  // the app's `AppRole` union so dashboard gating works reliably.
  const validRoles: AppRole[] = ["guest", "stylist", "manager", "admin"];
  return (validRoles.includes(role as AppRole) ? (role as AppRole) : "guest") as AppRole;
}

export async function getCurrentUserWithProfile(): Promise<CurrentUserProfile | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, salon_id, location_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return {
      id: user.id,
      email: user.email ?? null,
      full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
      role: "guest",
      salon_id: null,
      location_id: null,
    };
  }

  return {
    id: profile.id,
    email: profile.email ?? user.email ?? null,
    full_name: profile.full_name ?? null,
    role: normalizeRole(profile.role),
    salon_id: profile.salon_id ?? null,
    location_id: profile.location_id ?? null,
  };
}

