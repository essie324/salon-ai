export type ServiceLike = {
  duration_minutes?: number | null;
};

/**
 * Returns service duration in minutes.
 * - Uses service.duration_minutes when present
 * - Falls back to 60 minutes when missing
 */
export function getServiceDuration(service: ServiceLike | null | undefined): number {
  if (service && service.duration_minutes != null && !Number.isNaN(service.duration_minutes)) {
    return Number(service.duration_minutes);
  }
  return 60;
}

