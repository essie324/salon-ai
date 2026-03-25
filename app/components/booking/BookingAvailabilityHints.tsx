import Link from "next/link";
import type { CSSProperties } from "react";
import type {
  BookableSlot,
  StylistAvailabilityRow,
  StylistSlotGroup,
} from "@/app/lib/booking/suggestions";

export type BookingAvailabilityBaseQuery = {
  clientId?: string;
  serviceId: string;
  date: string;
  intakeSessionId?: string;
  consultationHint?: string;
  intakeDecision?: string;
  rebook?: string;
};

function buildHref(slot: BookableSlot, base: BookingAvailabilityBaseQuery): string {
  const q = new URLSearchParams();
  if (base.clientId?.trim()) q.set("clientId", base.clientId.trim());
  q.set("serviceId", base.serviceId);
  q.set("date", base.date);
  q.set("time", slot.startTime);
  q.set("stylistId", slot.stylistId);
  if (base.intakeSessionId?.trim()) q.set("intakeSessionId", base.intakeSessionId.trim());
  if (base.consultationHint?.trim()) q.set("consultationHint", base.consultationHint.trim());
  if (base.intakeDecision?.trim()) q.set("intakeDecision", base.intakeDecision.trim());
  if (base.rebook?.trim()) q.set("rebook", base.rebook.trim());
  return `/dashboard/appointments/new?${q.toString()}`;
}

const panelStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 16,
  background: "#fafafa",
  marginTop: 12,
};

const titleStyle: CSSProperties = {
  margin: "0 0 10px 0",
  fontSize: "1rem",
  fontWeight: 800,
  color: "#0f172a",
};

const subStyle: CSSProperties = {
  margin: "0 0 12px 0",
  fontSize: 13,
  color: "#64748b",
  lineHeight: 1.5,
};

const groupTitleStyle: CSSProperties = {
  margin: "14px 0 8px 0",
  fontSize: 13,
  fontWeight: 800,
  color: "#334155",
};

const chipGridStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

/** Suggested open slots (server-verified available). */
const chipAvailableStyle: CSSProperties = {
  display: "inline-block",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #6ee7b7",
  background: "#f0fdf4",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  lineHeight: 1.35,
};

const emptyStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#64748b",
  lineHeight: 1.55,
};

const hintListStyle: CSSProperties = {
  margin: "10px 0 0 0",
  paddingLeft: 18,
  fontSize: 13,
  color: "#64748b",
  lineHeight: 1.55,
};

type Props = {
  durationMinutes: number;
  singleStylistMode: boolean;
  groupedByStylist: StylistSlotGroup[];
  slotsFlat: BookableSlot[];
  baseQuery: BookingAvailabilityBaseQuery;
  stylistRows: StylistAvailabilityRow[];
};

export function BookingAvailabilityHints({
  durationMinutes,
  singleStylistMode,
  groupedByStylist,
  slotsFlat,
  baseQuery,
  stylistRows,
}: Props) {
  const hasSlots = slotsFlat.length > 0;

  return (
    <section style={panelStyle} aria-label="Open times for this service and date">
      <h2 style={titleStyle}>Open times</h2>
      <p style={subStyle}>
        Times respect working hours, blocked time, existing bookings, service duration ({durationMinutes} min), and who
        can perform this service. Click a slot to fill time and stylist; you can still edit manually.
      </p>

      {!hasSlots ? (
        <p style={emptyStyle}>
          No open slots found for this combination. Try another date, another stylist, or adjust working hours /
          blocks in staff settings.
        </p>
      ) : singleStylistMode ? (
        <div style={chipGridStyle}>
          {slotsFlat.map((slot) => (
            <Link
              key={`${slot.stylistId}-${slot.startTime}`}
              href={buildHref(slot, baseQuery)}
              style={chipAvailableStyle}
              prefetch={false}
            >
              {slot.startTime}
              <span style={{ display: "block", fontWeight: 500, fontSize: 12, color: "#64748b" }}>
                {slot.stylistName} · {slot.durationMinutes} min
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <>
          {groupedByStylist.map((g) => (
            <div key={g.stylistId}>
              <p style={groupTitleStyle}>{g.stylistName}</p>
              <div style={chipGridStyle}>
                {g.slots.map((slot) => (
                  <Link
                    key={`${slot.stylistId}-${slot.startTime}`}
                    href={buildHref(slot, baseQuery)}
                    style={chipAvailableStyle}
                    prefetch={false}
                  >
                    {slot.startTime}
                    <span style={{ display: "block", fontWeight: 500, fontSize: 12, color: "#64748b" }}>
                      {slot.durationMinutes} min
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {stylistRows.some((r) => r.hint) ? (
        <ul style={hintListStyle}>
          {stylistRows.map((r, i) =>
            r.hint ? (
              <li key={`${r.stylistId}-${i}`}>
                <strong>{r.stylistName}</strong>
                {!r.eligible ? <span style={{ color: "#94a3b8" }}> (not on this service)</span> : null} — {r.hint}
              </li>
            ) : null,
          )}
        </ul>
      ) : null}
    </section>
  );
}
