/**
 * Dashboard revenue: completed appointments only (appointment_price_cents + tip_cents).
 * When payment_status is present on any row in a batch, use signed accounting via
 * `computeRevenueInsights` (paid/comped positive, refunds negative, unpaid excluded).
 * When no payment data exists yet, treat rows as recognized revenue (gross) so totals stay usable.
 */
import type { AppointmentRevenueRow, RevenueInsights } from "@/app/lib/revenue/metrics";
import { computeRevenueInsights } from "@/app/lib/revenue/metrics";

export function shouldPreferPaymentStatus(
  rows: { payment_status?: string | null }[],
): boolean {
  return rows.some((r) => String(r.payment_status ?? "").trim().length > 0);
}

/**
 * Week / day revenue breakdowns for the owner dashboard (aligned with BUILD_GUIDELINES).
 */
export function getDashboardRevenueInsights(rows: AppointmentRevenueRow[]): RevenueInsights {
  const prefer = shouldPreferPaymentStatus(rows);
  const normalized: AppointmentRevenueRow[] = prefer
    ? rows
    : rows.map((r) => ({ ...r, payment_status: "paid" }));
  return computeRevenueInsights(normalized);
}
