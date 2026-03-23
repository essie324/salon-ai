import type { SupabaseClient } from "@supabase/supabase-js";
import { isStylistEligibleForService } from "@/app/lib/stylistServiceEligibility";
import { isStylistAvailable } from "./availability";
import { checkAppointmentConflict } from "./conflicts";
import { determineConsultationRouting } from "./consultationRouting";
import { computeDepositPolicy } from "./depositRules";

export type ValidateAppointmentRequestArgs = {
  supabase: SupabaseClient;
  clientId?: string;
  stylistId: string;
  serviceId: string;
  startAt: string;
  endAt: string;
  excludeAppointmentId?: string;
  serviceGoal?: string;
  intakeNotes?: string;
  skipConsultationCheck?: boolean;
};

export type ValidateAppointmentResult = {
  valid: boolean;
  reason?:
    | "stylist_not_eligible"
    | "outside_working_hours"
    | "blocked_time"
    | "appointment_conflict"
    | "consultation_required"
    | "booking_restricted";
  message?: string;
  depositRequired?: boolean;
  depositAmountCents?: number | null;
  depositStatus?: "not_required" | "required";
};

/**
 * Central booking engine validation:
 * - Eligibility (stylist can perform service)
 * - Availability (working hours + blocked time)
 * - Conflict (overlapping appointments)
 */
export async function validateAppointmentRequest(
  args: ValidateAppointmentRequestArgs,
): Promise<ValidateAppointmentResult> {
  const {
    supabase,
    clientId,
    stylistId,
    serviceId,
    startAt,
    endAt,
    excludeAppointmentId,
    serviceGoal,
    intakeNotes,
    skipConsultationCheck,
  } = args;

  if (!stylistId || !serviceId || !startAt || !endAt) {
    return { valid: false, reason: "outside_working_hours" };
  }

  if (clientId) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("no_show_count, deposit_required, booking_restricted, restriction_note")
      .eq("id", clientId)
      .maybeSingle();

    const policy = computeDepositPolicy(clientRow as any);
    if (policy.bookingRestricted) {
      return {
        valid: false,
        reason: "booking_restricted",
        message: policy.restrictionMessage,
      };
    }
  }

  if (!skipConsultationCheck && serviceId) {
    const { data: serviceRow } = await supabase
      .from("services")
      .select("id, name")
      .eq("id", serviceId)
      .maybeSingle();

    const routing = determineConsultationRouting({
      serviceName: (serviceRow as { name?: string } | null)?.name ?? null,
      serviceGoal,
      intakeNotes,
    });

    if (routing.requiresConsultation) {
      return {
        valid: false,
        reason: "consultation_required",
        message:
          routing.message ??
          "This request should begin with a consultation before booking the full service.",
      };
    }
  }

  const eligible = await isStylistEligibleForService(supabase, stylistId, serviceId);
  if (!eligible) {
    return { valid: false, reason: "stylist_not_eligible" };
  }

  const availability = await isStylistAvailable(supabase, stylistId, startAt, endAt);
  if (!availability.available) {
    return { valid: false, reason: availability.reason };
  }

  const conflict = await checkAppointmentConflict(
    supabase,
    stylistId,
    startAt,
    endAt,
    excludeAppointmentId,
  );
  if (conflict.conflict) {
    return { valid: false, reason: "appointment_conflict" };
  }

  let depositMeta: Pick<ValidateAppointmentResult, "depositRequired" | "depositAmountCents" | "depositStatus"> = {};
  if (clientId) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("no_show_count, deposit_required, booking_restricted, restriction_note")
      .eq("id", clientId)
      .maybeSingle();
    const policy = computeDepositPolicy(clientRow as any);
    depositMeta = {
      depositRequired: policy.depositRequired,
      depositAmountCents: policy.depositAmountCents,
      depositStatus: policy.depositStatus,
    };
  }

  return { valid: true, ...depositMeta };
}

