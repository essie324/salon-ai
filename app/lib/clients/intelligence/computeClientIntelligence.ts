import type { ClientIntelligence, ClientCategory } from "./types";
import type { AppointmentIntelligenceLike } from "./metrics";
import { computeClientVisitMetrics } from "./metrics";
import { computeClientTotalSpendCents } from "./spend";
import { classifyClientCategory } from "./classifyClient";
import { computeClientRebookingDecision } from "@/app/lib/rebooking/engine";

export async function computeClientIntelligence(args: {
  clientId: string;
  now: Date;
  appointments: AppointmentIntelligenceLike[];
  serviceById: Map<string, { name: string | null }>;
}): Promise<ClientIntelligence> {
  const { clientId, now, appointments, serviceById } = args;

  const metrics = computeClientVisitMetrics(appointments);
  const spend = computeClientTotalSpendCents(appointments);

  const rebooking = computeClientRebookingDecision({
    appointments,
    serviceById,
    today: now,
    dueSoonDays: 14,
  });

  const recommendedReturnDate = rebooking.recommended_next_visit_date;
  const rebookingStatus = rebooking.rebooking_status;

  const classification = classifyClientCategory({
    now,
    metrics,
    rebookingStatus,
    recommendedReturnDate,
    spendCents: spend.totalSpendCents,
  });

  return {
    clientId,
    category: classification.category as ClientCategory,
    labels: classification.labels,
    metrics,
    spend,
    rebookingStatus,
    recommendedReturnDate,
  };
}

