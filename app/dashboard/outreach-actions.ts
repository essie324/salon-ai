"use server";

import { revalidatePath } from "next/cache";
import { scheduledForFromDateInput } from "@/app/lib/outreach/followUp";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";

const OUTREACH_TYPES = [
  "appointment_reminder",
  "due_soon_rebooking",
  "overdue_outreach",
] as const;

const MESSAGE_PREVIEW_MAX = 8000;

function keyMatchesType(key: string, type: string): boolean {
  if (type === "appointment_reminder") return key.startsWith("ar-");
  if (type === "due_soon_rebooking") return key.startsWith("ds-");
  if (type === "overdue_outreach") return key.startsWith("ov-");
  return false;
}

async function validateClientAndAppointment(input: {
  clientId: string;
  outreachType: string;
  appointmentId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase.from("clients").select("id").eq("id", input.clientId).maybeSingle();
  if (!client) return { ok: false, error: "Client not found" };

  if (input.outreachType === "appointment_reminder" && input.appointmentId) {
    const { data: appt } = await supabase
      .from("appointments")
      .select("id, client_id")
      .eq("id", input.appointmentId)
      .maybeSingle();
    if (!appt || appt.client_id !== input.clientId) {
      return { ok: false, error: "Appointment does not match client" };
    }
  }
  return { ok: true };
}

function parseCommon(formData: FormData) {
  const outreachKey = String(formData.get("outreachKey") ?? "").trim();
  const outreachType = String(formData.get("outreachType") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();
  const appointmentIdRaw = formData.get("appointmentId");
  const appointmentId = appointmentIdRaw ? String(appointmentIdRaw).trim() : null;
  return { outreachKey, outreachType, clientId, appointmentId: appointmentId || null };
}

function parseMessagePreview(formData: FormData): string {
  const raw = String(formData.get("messagePreview") ?? "");
  const t = raw.trim();
  if (!t) return "";
  return t.length > MESSAGE_PREVIEW_MAX ? t.slice(0, MESSAGE_PREVIEW_MAX) : t;
}

export async function scheduleOutreachFollowUp(formData: FormData): Promise<void> {
  const { outreachKey, outreachType, clientId, appointmentId } = parseCommon(formData);
  const dateStr = String(formData.get("scheduledDate") ?? "").trim();

  if (!outreachKey || !outreachType || !clientId || !dateStr) return;
  if (!OUTREACH_TYPES.includes(outreachType as (typeof OUTREACH_TYPES)[number])) return;
  if (!keyMatchesType(outreachKey, outreachType)) return;

  const v = await validateClientAndAppointment({ clientId, outreachType, appointmentId });
  if (!v.ok) return;

  let scheduledFor: string;
  try {
    scheduledFor = scheduledForFromDateInput(dateStr);
  } catch {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("outreach_actions").upsert(
    {
      outreach_key: outreachKey,
      outreach_type: outreachType,
      client_id: clientId,
      appointment_id: appointmentId,
      action_state: "scheduled",
      scheduled_for: scheduledFor,
      is_ready: false,
    },
    { onConflict: "outreach_key" },
  );

  if (error) return;

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function dismissOutreachFollowUp(formData: FormData): Promise<void> {
  const { outreachKey, outreachType, clientId, appointmentId } = parseCommon(formData);

  if (!outreachKey || !outreachType || !clientId) return;
  if (!OUTREACH_TYPES.includes(outreachType as (typeof OUTREACH_TYPES)[number])) return;
  if (!keyMatchesType(outreachKey, outreachType)) return;

  const v = await validateClientAndAppointment({ clientId, outreachType, appointmentId });
  if (!v.ok) return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("outreach_actions").upsert(
    {
      outreach_key: outreachKey,
      outreach_type: outreachType,
      client_id: clientId,
      appointment_id: appointmentId,
      action_state: "dismissed",
      scheduled_for: null,
      is_ready: false,
      sent_at: null,
      last_message_preview: null,
    },
    { onConflict: "outreach_key" },
  );

  if (error) return;

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function clearOutreachSchedule(formData: FormData): Promise<void> {
  const { outreachKey, outreachType, clientId, appointmentId } = parseCommon(formData);

  if (!outreachKey || !outreachType || !clientId) return;
  if (!OUTREACH_TYPES.includes(outreachType as (typeof OUTREACH_TYPES)[number])) return;
  if (!keyMatchesType(outreachKey, outreachType)) return;

  const v = await validateClientAndAppointment({ clientId, outreachType, appointmentId });
  if (!v.ok) return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("outreach_actions").upsert(
    {
      outreach_key: outreachKey,
      outreach_type: outreachType,
      client_id: clientId,
      appointment_id: appointmentId,
      action_state: "new",
      scheduled_for: null,
      is_ready: false,
    },
    { onConflict: "outreach_key" },
  );

  if (error) return;

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function markOutreachReady(formData: FormData): Promise<void> {
  const { outreachKey, outreachType, clientId, appointmentId } = parseCommon(formData);

  if (!outreachKey || !outreachType || !clientId) return;
  if (!OUTREACH_TYPES.includes(outreachType as (typeof OUTREACH_TYPES)[number])) return;
  if (!keyMatchesType(outreachKey, outreachType)) return;

  const v = await validateClientAndAppointment({ clientId, outreachType, appointmentId });
  if (!v.ok) return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("outreach_actions").upsert(
    {
      outreach_key: outreachKey,
      outreach_type: outreachType,
      client_id: clientId,
      appointment_id: appointmentId,
      action_state: "ready_to_send",
      scheduled_for: null,
      is_ready: true,
      sent_at: null,
    },
    { onConflict: "outreach_key" },
  );

  if (error) return;

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function sendOutreachNow(formData: FormData): Promise<void> {
  const { outreachKey, outreachType, clientId, appointmentId } = parseCommon(formData);
  const messagePreview = parseMessagePreview(formData);

  if (!outreachKey || !outreachType || !clientId) return;
  if (!OUTREACH_TYPES.includes(outreachType as (typeof OUTREACH_TYPES)[number])) return;
  if (!keyMatchesType(outreachKey, outreachType)) return;

  const v = await validateClientAndAppointment({ clientId, outreachType, appointmentId });
  if (!v.ok) return;

  const sentAt = new Date().toISOString();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("outreach_actions").upsert(
    {
      outreach_key: outreachKey,
      outreach_type: outreachType,
      client_id: clientId,
      appointment_id: appointmentId,
      action_state: "sent",
      scheduled_for: null,
      is_ready: false,
      sent_at: sentAt,
      last_message_preview: messagePreview || null,
    },
    { onConflict: "outreach_key" },
  );

  if (error) return;

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/clients/${clientId}`);
}
