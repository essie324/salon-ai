import type { SupabaseClient } from "@supabase/supabase-js";
import { bookingFlagsFromNoShowCount } from "@/app/lib/bookingRules";

/**
 * After `no_show_count` is incremented, keep `deposit_required` and `booking_restricted`
 * aligned with salon policy (thresholds in `bookingRules.ts`).
 */
export function buildClientUpdateAfterNoShowIncrement(newNoShowCount: number): {
  no_show_count: number;
  last_no_show_at: string;
  deposit_required: boolean;
  booking_restricted: boolean;
} {
  const flags = bookingFlagsFromNoShowCount(newNoShowCount);
  return {
    no_show_count: newNoShowCount,
    last_no_show_at: new Date().toISOString(),
    deposit_required: flags.deposit_required,
    booking_restricted: flags.booking_restricted,
  };
}

export async function applyNoShowIncrementToClient(args: {
  supabase: SupabaseClient;
  clientId: string;
  previousNoShowCount: number;
}): Promise<void> {
  const newCount = Math.max(0, args.previousNoShowCount) + 1;
  const row = buildClientUpdateAfterNoShowIncrement(newCount);
  const { error } = await args.supabase.from("clients").update(row).eq("id", args.clientId);
  if (error) throw new Error(error.message);
}
