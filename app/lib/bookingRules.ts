/**
 * Central rules for deposits and booking restrictions from no-show history.
 * Staff can also set `deposit_required` / `booking_restricted` manually on the client.
 */

export const NO_SHOW_DEPOSIT_THRESHOLD = 2;
export const NO_SHOW_RESTRICT_THRESHOLD = 3;

export type ClientBookingRuleFields = {
  no_show_count?: number | null;
  deposit_required?: boolean | null;
  booking_restricted?: boolean | null;
};

export function effectiveNoShowCount(client: ClientBookingRuleFields | null | undefined): number {
  return Math.max(0, client?.no_show_count ?? 0);
}

/** Rule-based: ≥2 recorded no-shows → deposit policy applies. */
export function isDepositRequiredByNoShowRule(count: number): boolean {
  return count >= NO_SHOW_DEPOSIT_THRESHOLD;
}

/** Rule-based: ≥3 recorded no-shows → online/self-serve booking blocked. */
export function isBookingRestrictedByNoShowRule(count: number): boolean {
  return count >= NO_SHOW_RESTRICT_THRESHOLD;
}

/**
 * Persisted flags that should be stored on the client row after a no-show count change.
 */
export function bookingFlagsFromNoShowCount(noShowCount: number): {
  deposit_required: boolean;
  booking_restricted: boolean;
} {
  return {
    deposit_required: isDepositRequiredByNoShowRule(noShowCount),
    booking_restricted: isBookingRestrictedByNoShowRule(noShowCount),
  };
}

/** Block creating an appointment from the dashboard form without manual override. */
export function shouldBlockSelfServeBooking(client: ClientBookingRuleFields | null | undefined): boolean {
  if (!client) return false;
  if (client.booking_restricted === true) return true;
  return isBookingRestrictedByNoShowRule(effectiveNoShowCount(client));
}

/**
 * Show deposit warning on booking (booking still allowed unless restricted).
 */
export function shouldShowDepositRequiredWarning(client: ClientBookingRuleFields | null | undefined): boolean {
  if (!client) return false;
  if (client.deposit_required === true) return true;
  return isDepositRequiredByNoShowRule(effectiveNoShowCount(client));
}

export const MANUAL_APPROVAL_BOOKING_MESSAGE =
  "Client requires manual approval before booking.";
