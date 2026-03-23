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
  clientRisk?: {
    noShowCount?: number | null;
    depositRequired?: boolean | null;
    bookingRestricted?: boolean | null;
  };
}): Promise<ClientIntelligence> {
  const { clientId, now, appointments, serviceById, clientRisk } = args;

  const metrics = computeClientVisitMetrics(appointments);
  const spend = computeClientTotalSpendCents(appointments);

  const rebooking = computeClientRebookingDecision({
    appointments,
    serviceById,
    today: now,
    dueSoonDays: 14,
    clientRisk,
  });

  const recommendedReturnDate = rebooking.recommended_date;
  const rebookingStatus = rebooking.status;

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

