"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";

export async function archiveAppointment(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) return;

  const { error } = await supabase
    .from("appointments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/appointments");
  revalidatePath(`/dashboard/appointments/${id}`);
  revalidatePath(`/dashboard/appointments/${id}/edit`);
  redirect("/dashboard/appointments");
}

