import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * If the stylist_services table has no rows, we treat all stylists as eligible for all services (backward compatible).
 * Once any eligibility rows exist, only (stylist_id, service_id) pairs in the table are considered eligible.
 */
export async function isStylistEligibleForService(
  supabase: SupabaseClient,
  stylistId: string,
  serviceId: string
): Promise<boolean> {
  const { count: totalCount } = await supabase
    .from("stylist_services")
    .select("*", { count: "exact", head: true });

  if (totalCount === 0) return true;

  const { data } = await supabase
    .from("stylist_services")
    .select("id")
    .eq("stylist_id", stylistId)
    .eq("service_id", serviceId)
    .maybeSingle();

  return data != null;
}

/**
 * Returns stylist IDs that are eligible for the given service.
 * If no eligibility rows exist globally, returns null (caller should treat as "all active stylists").
 */
export async function getStylistIdsEligibleForService(
  supabase: SupabaseClient,
  serviceId: string
): Promise<string[] | null> {
  const { count: totalCount } = await supabase
    .from("stylist_services")
    .select("*", { count: "exact", head: true });

  if (totalCount === 0) return null;

  const { data: rows } = await supabase
    .from("stylist_services")
    .select("stylist_id")
    .eq("service_id", serviceId);

  return (rows ?? []).map((r) => r.stylist_id);
}
