import type { ClientCategory, ClientCategoryClassification, ClientVisitMetrics } from "./types";
import type { ClientRebookingDecision } from "@/app/lib/rebooking/engine";

export type ClassifyClientOptions = {
  inactiveDays?: number; // last visit older than this => inactive
  frequentMaxAvgDays?: number; // avg visit frequency days <= this => frequent
  highValueMinSpendCents?: number; // spend threshold (net cents)
  highValueMinVisits?: number; // fallback "frequent" signal
};

export const DEFAULT_CLASSIFY_OPTIONS: Required<ClassifyClientOptions> = {
  inactiveDays: 90,
  frequentMaxAvgDays: 45,
  highValueMinSpendCents: 100000, // $1000
  highValueMinVisits: 6,
};

function daysBetween(now: Date, then: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / MS_PER_DAY));
}

export function classifyClientCategory(args: {
  now: Date;
  metrics: ClientVisitMetrics;
  rebookingStatus?: ClientRebookingDecision["status"];
  recommendedReturnDate?: Date | null;
  spendCents: number;
  options?: ClassifyClientOptions;
}): ClientCategoryClassification {
  const opts = { ...DEFAULT_CLASSIFY_OPTIONS, ...(args.options ?? {}) };
  const { now, metrics, rebookingStatus, spendCents } = args;

  const lastVisitAt = metrics.lastVisitAt;
  if (!lastVisitAt) {
    return { category: "inactive" as ClientCategory, labels: ["No completed visits yet."] };
  }

  const ageDays = daysBetween(now, lastVisitAt);
  if (ageDays >= opts.inactiveDays) {
    return {
      category: "inactive" as ClientCategory,
      labels: [`Inactive: ${ageDays} days since last visit.`],
    };
  }

  // At risk = overdue/due window signal.
  if (rebookingStatus === "overdue" || rebookingStatus === "due") {
    return {
      category: "at_risk" as ClientCategory,
      labels: [
        rebookingStatus === "overdue" ? "Overdue return window." : "Due for maintenance soon.",
      ],
    };
  }

  const avgDays = metrics.avgVisitFrequencyDays;
  const frequentSignal =
    (avgDays != null && avgDays <= opts.frequentMaxAvgDays) || metrics.totalVisits >= opts.highValueMinVisits;

  const highValue = spendCents >= opts.highValueMinSpendCents && frequentSignal;
  if (highValue) {
    return {
      category: "high_value" as ClientCategory,
      labels: ["High value: frequent + strong spend."],
    };
  }

  return { category: "regular" as ClientCategory, labels: ["Regular client pattern."] };
}

