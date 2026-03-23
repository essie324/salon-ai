export type ClientDepositInputs = {
  no_show_count?: number | null;
  deposit_required?: boolean | null;
  booking_restricted?: boolean | null;
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

export function computeDepositPolicy(client: ClientDepositInputs | null): DepositPolicy {
  const noShows = client?.no_show_count ?? 0;
  const manuallyDepositRequired = !!client?.deposit_required;
  const restricted = !!client?.booking_restricted;
  const note = client?.restriction_note?.trim() || "";

  if (restricted) {
    return {
      bookingRestricted: true,
      restrictionMessage:
        note ||
        "This client is currently restricted from booking due to repeated no-shows. Please contact a manager to override.",
      depositRequired: false,
      depositAmountCents: null,
      depositStatus: "not_required",
    };
  }

  const depositRequired = manuallyDepositRequired || noShows >= 2;

  return {
    bookingRestricted: false,
    depositRequired,
    depositAmountCents: depositRequired ? DEFAULT_DEPOSIT_CENTS : null,
    depositStatus: depositRequired ? "required" : "not_required",
  };
}

