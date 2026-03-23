import type { AppointmentIntelligenceLike } from "./metrics";

export type PaymentStatusContribution =
  | "unpaid"
  | "paid"
  | "refunded"
  | "comped"
  | (string & {});

function normalizedPaymentStatus(v: string | null | undefined): PaymentStatusContribution {
  const s = (v ?? "").toLowerCase().trim();
  if (!s) return "unpaid";
  return s as PaymentStatusContribution;
}

export function computeClientTotalSpendCents(
  appointments: AppointmentIntelligenceLike[],
): { totalSpendCents: number } {
  // Net spend:
  // - paid/comped: positive (price + tip)
  // - refunded: negative
  // - unpaid: 0
  // We only count from completed appointments because those are the only ones expected to have payment.
  const completed = appointments.filter((a) => a.status === "completed");

  let totalSpendCents = 0;
  for (const a of completed) {
    const priceCents = a.appointment_price_cents ?? 0;
    const tipCents = a.tip_cents ?? 0;
    const base = priceCents + tipCents;
    const paymentStatus = normalizedPaymentStatus(a.payment_status);

    if (paymentStatus === "paid" || paymentStatus === "comped") totalSpendCents += base;
    else if (paymentStatus === "refunded") totalSpendCents -= base;
    // unpaid/unknown => no contribution
  }

  return { totalSpendCents };
}

