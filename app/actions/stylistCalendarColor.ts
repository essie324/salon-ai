"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { parseCalendarColorForDb } from "@/app/lib/calendar/stylistColors";

/**
 * Saves a validated hex calendar color for a stylist (or clears when empty/invalid).
 */
export async function updateStylistCalendarColor(formData: FormData) {
  const stylistId = String(formData.get("stylistId") ?? "").trim();
  const raw = String(formData.get("calendar_color") ?? "");
  if (!stylistId) return;

  const calendar_color = parseCalendarColorForDb(raw);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("stylists")
    .update({ calendar_color })
    .eq("id", stylistId);

  if (error) {
    console.error("updateStylistCalendarColor", error.message);
    return;
  }

  revalidatePath(`/dashboard/stylists/${stylistId}`);
  revalidatePath("/dashboard/appointments");
}
