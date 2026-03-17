import { createSupabaseServerClient } from "./supabaseServer";

export type CurrentUserProfile = {
  id: string | null;
  email: string | null;
  full_name: string | null;
  role: string;
  salon_id: string | null;
  location_id: string | null;
};

function normalizeRole(role: string | null | undefined) {
  if (!role) return "guest";

  const validRoles = ["owner", "manager", "receptionist", "stylist", "assistant", "guest"];
  return validRoles.includes(role) ? role : "guest";
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

