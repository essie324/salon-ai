import type { SupabaseClient } from "@supabase/supabase-js";
import { applyNoShowIncrementToClient } from "@/app/lib/noShowEnforcement";

export const ALLOWED_APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
] as const;

/**
 * Single implementation for appointment status changes (no-show side effects, cancellation notes).
 * Used only by `updateAppointmentStatus` — keeps counting / client flags consistent app-wide.
 */
export async function performAppointmentStatusUpdate(args: {
  supabase: SupabaseClient;
  appointmentId: string;
  newStatus: string;
  cancellationNote?: string | null;
}): Promise<void> {
  const { supabase, appointmentId, newStatus } = args;
  const cancellationNote = args.cancellationNote;

  const { data: before, error: beforeErr } = await supabase
    .from("appointments")
    .select("status, client_id")
    .eq("id", appointmentId)
    .maybeSingle();

  if (beforeErr) throw new Error(beforeErr.message);

  const previousStatus = (before as { status?: string } | null)?.status ?? "";
  const clientId = (before as { client_id?: string } | null)?.client_id;

  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (newStatus === "cancelled") {
    updatePayload.cancellation_note = cancellationNote?.trim() || null;
  } else {
    updatePayload.cancellation_note = null;
  }

  const { error } = await supabase.from("appointments").update(updatePayload).eq("id", appointmentId);

  if (error) throw new Error(error.message);

  if (newStatus === "no_show" && previousStatus !== "no_show" && clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("no_show_count")
      .eq("id", clientId)
      .maybeSingle();

    const current = (client as { no_show_count?: number } | null)?.no_show_count ?? 0;

    await applyNoShowIncrementToClient({
      supabase,
      clientId,
      previousNoShowCount: current,
    });
  }
}
