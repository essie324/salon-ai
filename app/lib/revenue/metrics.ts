export type AppointmentRevenueRow = {
  appointment_date?: string | null;
  stylist_id?: string | null;
  appointment_price_cents?: number | null;
  tip_cents?: number | null;
  payment_status?: string | null;
};

export type RevenuePaymentStatus =
  | "unpaid"
  | "paid"
  | "refunded"
  | "comped"
  | (string & {});

export type SignedRevenue = {
  signedRevenueCents: number; // refunds are negative; unpaid is 0
  included: boolean; // included in avgTicket denominators
};

export type RevenueByDay = {
  dateISO: string;
  revenueCents: number; // signed (refunds negative)
  count: number; // included appointment count
};

export type RevenueByStylist = {
  stylistId: string;
  revenueCents: number; // signed (refunds negative)
  count: number; // included appointment count
};

export type RevenueInsights = {
  totalRevenueCents: number; // signed
  includedCount: number;
  avgTicketCents: number | null; // null when no included appointments
  revenueByDay: RevenueByDay[];
  revenueByStylist: RevenueByStylist[];
};

const normalizedPaymentStatus = (v: string | null | undefined): RevenuePaymentStatus => {
  const s = (v ?? "").toLowerCase().trim();
  if (!s) return "unpaid";
  return s as RevenuePaymentStatus;
};

export function computeAppointmentTotalCents(row: AppointmentRevenueRow): number {
  const priceCents = row.appointment_price_cents ?? 0;
  const tipCents = row.tip_cents ?? 0;
  return priceCents + tipCents;
}

/**
 * Converts a payment status into a "signed" revenue contribution.
 * - paid/comped => positive
 * - refunded => negative
 * - unpaid => 0
 */
export function computeSignedRevenueContribution(row: AppointmentRevenueRow): SignedRevenue {
  const payment_status = normalizedPaymentStatus(row.payment_status);
  const base = computeAppointmentTotalCents(row);

  if (payment_status === "paid" || payment_status === "comped") {
    return { signedRevenueCents: base, included: true };
  }

  if (payment_status === "refunded") {
    return { signedRevenueCents: -base, included: true };
  }

  // unpaid or unknown => do not count as revenue
  return { signedRevenueCents: 0, included: false };
}

export function computeRevenueInsights(
  rows: AppointmentRevenueRow[],
  options?: {
    includeDateISO?: (dateISO: string) => boolean;
  },
): RevenueInsights {
  const revenueTotal = {
    cents: 0,
    includedCount: 0,
  };

  const byDay = new Map<string, { cents: number; count: number }>();
  const byStylist = new Map<string, { cents: number; count: number }>();

  for (const row of rows) {
    const dateISO = row.appointment_date ?? null;
    if (!dateISO) continue;
    if (options?.includeDateISO && !options.includeDateISO(dateISO)) continue;

    const contrib = computeSignedRevenueContribution(row);
    revenueTotal.cents += contrib.signedRevenueCents;
    if (contrib.included) revenueTotal.includedCount += 1;

    const dayCur = byDay.get(dateISO) ?? { cents: 0, count: 0 };
    dayCur.cents += contrib.signedRevenueCents;
    if (contrib.included) dayCur.count += 1;
    byDay.set(dateISO, dayCur);

    const stylistId = row.stylist_id ?? null;
    if (stylistId) {
      const styCur = byStylist.get(stylistId) ?? { cents: 0, count: 0 };
      styCur.cents += contrib.signedRevenueCents;
      if (contrib.included) styCur.count += 1;
      byStylist.set(stylistId, styCur);
    }
  }

  const revenueByDay: RevenueByDay[] = Array.from(byDay.entries())
    .map(([dateISO, v]) => ({ dateISO, revenueCents: v.cents, count: v.count }))
    .sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1));

  const revenueByStylist: RevenueByStylist[] = Array.from(byStylist.entries())
    .map(([stylistId, v]) => ({
      stylistId,
      revenueCents: v.cents,
      count: v.count,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents);

  return {
    totalRevenueCents: revenueTotal.cents,
    includedCount: revenueTotal.includedCount,
    avgTicketCents: revenueTotal.includedCount > 0 ? Math.round(revenueTotal.cents / revenueTotal.includedCount) : null,
    revenueByDay,
    revenueByStylist,
  };
}

