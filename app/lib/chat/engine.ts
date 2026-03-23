import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decideReceptionistAction,
  type ReceptionistDecision,
} from "@/app/lib/ai/receptionist";

export type InboxIntakeSession = {
  id: string;
  client_id: string | null;
  requested_service: string | null;
  requested_stylist: string | null;
  timing_preference: string | null;
  budget_notes: string | null;
  concern_notes: string | null;
  ai_summary: string | null;
  created_at: string;
  appointment_id?: string | null;
};

export type InboxDecisionBundle = {
  intakeSession: InboxIntakeSession;
  decision: ReceptionistDecision;
  resolved: {
    recommendedServiceName: string | null;
    recommendedStylistName: string | null;
  };
  topSlot: ReceptionistDecision["recommended_time_slots"][number] | null;
  canBook: boolean;
  cannotBookReason?: string;
};

export function localDateTimeToISOString(dateISO: string, timeHHMM: string): string {
  // Interprets `YYYY-MM-DD` + `HH:MM` in the server's local timezone.
  // This matches how other booking pages in this codebase build `start_at` / `end_at`.
  return new Date(`${dateISO}T${timeHHMM}`).toISOString();
}

export function toAppointmentDraftFromSlot(args: {
  slot: {
    date: string; // YYYY-MM-DD (local)
    time: string; // HH:MM (local)
    end_time?: string; // HH:MM (local) (optional)
  };
}): {
  appointment_date: string;
  appointment_time: string;
  start_at: string;
  end_at: string | null;
} {
  const { slot } = args;
  const start_at = localDateTimeToISOString(slot.date, slot.time);
  const end_at = slot.end_time ? localDateTimeToISOString(slot.date, slot.end_time) : null;

  return {
    appointment_date: slot.date,
    appointment_time: slot.time,
    start_at,
    end_at,
  };
}

function fullStylistName(s: { first_name: string | null; last_name: string | null }): string {
  return `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim();
}

export async function getInboxConversationDecision(args: {
  supabase: SupabaseClient;
  intakeSession: InboxIntakeSession;
  maxSlots?: number;
}): Promise<InboxDecisionBundle> {
  const { supabase, intakeSession } = args;
  const maxSlots = args.maxSlots ?? 3;

  const decision = await decideReceptionistAction({
    supabase,
    input: {
      client_id: intakeSession.client_id ?? null,
      requested_service: intakeSession.requested_service ?? null,
      requested_stylist: intakeSession.requested_stylist ?? null,
      timing_preference: intakeSession.timing_preference ?? null,
      budget_notes: intakeSession.budget_notes ?? null,
      concern_notes: intakeSession.concern_notes ?? null,
      maxSlots,
    },
  });

  const topSlot = decision.recommended_time_slots[0] ?? null;
  const recommendedServiceId = decision.recommended_service_id;
  const recommendedStylistId =
    decision.recommended_stylist_id ?? topSlot?.stylist_id ?? null;

  const [{ data: svcRow }, { data: stylistRow }] = await Promise.all([
    recommendedServiceId
      ? supabase
          .from("services")
          .select("id, name")
          .eq("id", recommendedServiceId)
          .maybeSingle()
      : Promise.resolve({ data: null } as any),
    recommendedStylistId
      ? supabase
          .from("stylists")
          .select("id, first_name, last_name")
          .eq("id", recommendedStylistId)
          .maybeSingle()
      : Promise.resolve({ data: null } as any),
  ]);

  const recommendedServiceName = (svcRow as any)?.name ?? null;
  const recommendedStylistName =
    stylistRow && "first_name" in stylistRow
      ? fullStylistName(stylistRow as any)
      : null;

  const canBook =
    !!intakeSession.client_id &&
    !decision.flags.needs_consultation &&
    !decision.flags.requires_manual_review &&
    !!decision.recommended_service_id &&
    !!recommendedStylistId &&
    decision.recommended_time_slots.length > 0;

  let cannotBookReason: string | undefined;
  if (!intakeSession.client_id) cannotBookReason = "Missing client record.";
  else if (decision.flags.needs_consultation) cannotBookReason = "Consultation required first.";
  else if (decision.flags.requires_manual_review) cannotBookReason = "Manual review required.";
  else if (!decision.recommended_service_id) cannotBookReason = "Could not infer a service.";
  else if (!recommendedStylistId) cannotBookReason = "Could not infer a stylist.";
  else if (decision.recommended_time_slots.length === 0) cannotBookReason = "No available slots.";

  return {
    intakeSession,
    decision,
    resolved: {
      recommendedServiceName,
      recommendedStylistName,
    },
    topSlot,
    canBook,
    cannotBookReason,
  };
}

