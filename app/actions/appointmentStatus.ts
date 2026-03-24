"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { resolveAppointmentStatusRedirect } from "@/app/lib/appointmentStatusRedirect";
import {
  ALLOWED_APPOINTMENT_STATUSES,
  performAppointmentStatusUpdate,
} from "@/app/lib/appointmentStatusUpdate";

/**
 * Updates appointment status via `performAppointmentStatusUpdate` (single source of truth).
 * Form fields: `id`, `newStatus`, optional `cancellation_note`, optional `returnTo` (safe in-app path).
 */
export async function updateAppointmentStatus(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "").trim();
  const newStatus = String(formData.get("newStatus") ?? "").trim();
  const cancellationNote = String(formData.get("cancellation_note") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "").trim();

  if (!id || !newStatus) return;
  if (!(ALLOWED_APPOINTMENT_STATUSES as readonly string[]).includes(newStatus)) return;

  await performAppointmentStatusUpdate({
    supabase,
    appointmentId: id,
    newStatus,
    cancellationNote: cancellationNote || null,
  });

  const { data: appt } = await supabase
    .from("appointments")
    .select("client_id")
    .eq("id", id)
    .maybeSingle();

  const clientId = (appt as { client_id?: string } | null)?.client_id;

  if (clientId) {
    revalidatePath(`/dashboard/clients/${clientId}`);
  }

  revalidatePath("/appointments");
  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/appointments/${id}`);
  revalidatePath(`/dashboard/appointments/${id}/edit`);

  redirect(resolveAppointmentStatusRedirect({ returnTo, appointmentId: id }));
}
