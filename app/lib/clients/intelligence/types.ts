export type ClientCategory = "high_value" | "regular" | "at_risk" | "inactive";

export type ClientVisitMetrics = {
  lastVisitAt: Date | null;
  totalVisits: number; // completed visits
  avgVisitFrequencyDays: number | null; // average days between completed visits
  noShowCount: number;
  cancellationCount: number;
};

export type ClientSpendMetrics = {
  totalSpendCents: number; // net spend (refunds negative); unpaid => 0
};

export type ClientCategoryClassification = {
  category: ClientCategory;
  labels: string[]; // short explainers for UI
};

export type ClientIntelligence = {
  clientId: string;
  category: ClientCategory;
  labels: string[];

  metrics: ClientVisitMetrics;
  spend: ClientSpendMetrics;

  // If available (based on rebooking rules)
  rebookingStatus?: "not_due" | "due_soon" | "overdue";
  recommendedReturnDate?: Date | null;
};