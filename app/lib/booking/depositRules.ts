import {
  effectiveNoShowCount,
  shouldBlockSelfServeBooking,
  shouldShowDepositRequiredWarning,
  type ClientBookingRuleFields,
} from "@/app/lib/bookingRules";

export { effectiveNoShowCount };

export type ClientDepositInputs = ClientBookingRuleFields & {
  restriction_note?: string | null;
};

export type DepositPolicy = {
  bookingRestricted: boolean;
  restrictionMessage?: string;
  depositRequired: boolean;
  depositAmountCents: number | null;
  depositStatus: "not_required" | "required";
};

const DEFAULT_DEPOSIT_CENTS = 2500; // simple placeholder: $25.00

/**
 * Policy for deposits and restrictions (booking engine + UI).
 * Combines manual flags on the client with automatic rules from `no_show_count`.
 */
export function computeDepositPolicy(client: ClientDepositInputs | null): DepositPolicy {
  const note = client?.restriction_note?.trim() || "";

  if (shouldBlockSelfServeBooking(client)) {
    return {
      bookingRestricted: true,
      restrictionMessage:
        note ||
        "This client requires manual approval before booking (repeated no-shows or restriction on file).",
      depositRequired: false,
      depositAmountCents: null,
      depositStatus: "not_required",
    };
  }

  const depositRequired = shouldShowDepositRequiredWarning(client);

  return {
    bookingRestricted: false,
    depositRequired,
    depositAmountCents: depositRequired ? DEFAULT_DEPOSIT_CENTS : null,
    depositStatus: depositRequired ? "required" : "not_required",
  };
}
