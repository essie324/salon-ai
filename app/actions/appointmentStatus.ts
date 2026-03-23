"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";

const ALLOWED_STATUSES = ["scheduled", "confirmed", "checked_in", "completed", "cancelled", "no_show"];

/**
 * Updates an appointment's status (and optional cancellation_note when cancelling).
 * When status is set to no_show, increments the client's no_show_count and sets last_no_show_at.
 */
export async function updateAppointmentStatus(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "").trim();
  const newStatus = String(formData.get("newStatus") ?? "").trim();
  const cancellationNote = String(formData.get("cancellation_note") ?? "").trim();

  if (!id || !newStatus) return;
  if (!ALLOWED_STATUSES.includes(newStatus)) return;

  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (newStatus === "cancelled") {
    updatePayload.cancellation_note = cancellationNote || null;
  } else {
    updatePayload.cancellation_note = null;
  }

  const { error } = await supabase
    .from("appointments")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  if (newStatus === "no_show") {
    const { data: appt } = await supabase
      .from("appointments")
      .select("client_id")
      .eq("id", id)
      .maybeSingle();

    const clientId = (appt as { client_id?: string } | null)?.client_id;
    if (clientId) {
      const { data: client } = await supabase
        .from("clients")
        .select("no_show_count")
        .eq("id", clientId)
        .maybeSingle();

      const current = (client as { no_show_count?: number } | null)?.no_show_count ?? 0;
      await supabase
        .from("clients")
        .update({
          no_show_count: current + 1,
          last_no_show_at: new Date().toISOString(),
        })
        .eq("id", clientId);

      revalidatePath(`/dashboard/clients/${clientId}`);
    }
  }

  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/appointments/${id}`);
  revalidatePath(`/dashboard/appointments/${id}/edit`);
  redirect(`/dashboard/appointments/${id}`);
}
