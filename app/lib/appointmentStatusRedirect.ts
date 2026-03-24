/**
 * After a status update, redirect to a safe in-app path only (no open redirects).
 */
export function resolveAppointmentStatusRedirect(args: {
  returnTo: string;
  appointmentId: string;
}): string {
  const fallback = `/dashboard/appointments/${args.appointmentId}`;
  const raw = args.returnTo.trim();
  if (!raw) return fallback;

  if (!raw.startsWith("/") || raw.includes("://") || raw.includes("//")) {
    return fallback;
  }

  const noHash = raw.split("#")[0] ?? raw;
  const pathOnly = noHash.split("?")[0] ?? noHash;

  if (pathOnly === "/appointments" || pathOnly === "/appointments/") {
    return noHash;
  }
  if (pathOnly === "/dashboard/appointments" || pathOnly === "/dashboard/appointments/") {
    return noHash;
  }
  if (pathOnly === `/dashboard/appointments/${args.appointmentId}`) {
    return noHash;
  }
  if (pathOnly.startsWith(`/dashboard/appointments/${args.appointmentId}/`)) {
    return noHash;
  }

  return fallback;
}
