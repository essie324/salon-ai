import { createSupabaseServerClient } from "./supabaseServer";
import { normalizeRole, type AppRole } from "./roles";

export type CurrentUserProfile = {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  salonId: string | null;
  locationId: string | null;
};

export async function getCurrentUserWithProfile(): Promise<CurrentUserProfile | null> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role, salon_id, location_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return {
      id: user.id,
      email: user.email ?? "",
      fullName: null,
      role: "guest",
      salonId: null,
      locationId: null,
    };
  }

  return {
    id: user.id,
    email: (profile as any).email ?? user.email ?? "",
    fullName: (profile as any).full_name ?? null,
    role: normalizeRole((profile as any).role),
    salonId: (profile as any).salon_id ?? null,
    locationId: (profile as any).location_id ?? null,
  };
}

