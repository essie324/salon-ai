import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * After creating an appointment with `intake_session_id`, mirror the link on the intake row.
 * Optionally backfills `client_id` on the intake when it was captured anonymously.
 */
export async function linkIntakeSessionToAppointment(args: {
  supabase: SupabaseClient;
  appointmentId: string;
  intakeSessionId: string;
  clientId: string;
}): Promise<{ error: Error | null }> {
  const { supabase, appointmentId, intakeSessionId, clientId } = args;

  const { data: intake, error: fetchErr } = await supabase
    .from("intake_sessions")
    .select("id, client_id, appointment_id")
    .eq("id", intakeSessionId)
    .maybeSingle();

  if (fetchErr) return { error: new Error(fetchErr.message) };
  if (!intake) return { error: new Error("Intake session not found.") };
  if (intake.client_id && intake.client_id !== clientId) {
    return { error: new Error("Intake session belongs to a different client.") };
  }
  if (intake.appointment_id && intake.appointment_id !== appointmentId) {
    return { error: new Error("Intake is already linked to another appointment.") };
  }

  const patch: { appointment_id: string; client_id?: string } = {
    appointment_id: appointmentId,
  };
  if (!intake.client_id) {
    patch.client_id = clientId;
  }

  const { error: updErr } = await supabase
    .from("intake_sessions")
    .update(patch)
    .eq("id", intakeSessionId);

  if (updErr) return { error: new Error(updErr.message) };
  return { error: null };
}
