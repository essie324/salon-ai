export type AppointmentIntelligenceLike = {
  start_at: string;
  status: string;
  service_id: string | null;
  appointment_price_cents?: number | null;
  tip_cents?: number | null;
  payment_status?: string | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function safeDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function computeClientVisitMetrics(
  appointments: AppointmentIntelligenceLike[],
): {
  lastVisitAt: Date | null;
  totalVisits: number;
  avgVisitFrequencyDays: number | null;
  noShowCount: number;
  cancellationCount: number;
} {
  const completed = appointments
    .filter((a) => a.status === "completed")
    .map((a) => ({ start_at: a.start_at }))
    .map((x) => ({ ...x, date: safeDate(x.start_at) }))
    .filter((x) => x.date != null) as { start_at: string; date: Date }[];

  // Sort ascending for interval computation.
  completed.sort((a, b) => a.date.getTime() - b.date.getTime());

  const lastVisitAt = completed.length > 0 ? completed[completed.length - 1].date : null;
  const totalVisits = completed.length;

  let avgVisitFrequencyDays: number | null = null;
  if (completed.length >= 2) {
    const deltasDays: number[] = [];
    for (let i = 1; i < completed.length; i++) {
      const prev = completed[i - 1].date;
      const cur = completed[i].date;
      const deltaDays = (cur.getTime() - prev.getTime()) / MS_PER_DAY;
      if (deltaDays > 0) deltasDays.push(deltaDays);
    }
    if (deltasDays.length > 0) {
      const avg = deltasDays.reduce((a, b) => a + b, 0) / deltasDays.length;
      // Friendly rounding (1 decimal).
      avgVisitFrequencyDays = Math.round(avg * 10) / 10;
    }
  }

  const noShowCount = appointments.filter((a) => a.status === "no_show").length;
  const cancellationCount = appointments.filter((a) => a.status === "cancelled").length;

  return {
    lastVisitAt,
    totalVisits,
    avgVisitFrequencyDays,
    noShowCount,
    cancellationCount,
  };
}

