import Link from "next/link";
import type { CSSProperties } from "react";
import type { SmartFallbackSuggestion } from "@/app/lib/booking/smartSuggestions";

type Props = {
  suggestions: SmartFallbackSuggestion[];
  buildHref: (s: SmartFallbackSuggestion) => string;
};

function formatDayLabel(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function BookingFallbackSuggestions({ suggestions, buildHref }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <div style={wrapStyle}>
      <p style={leadStyle}>Try one of these open times (click to prefill the form):</p>
      <div style={rowStyle}>
        {suggestions.map((s) => (
          <Link key={`${s.stylistId}-${s.date}T${s.time}-${s.label}`} href={buildHref(s)} style={chipStyle}>
            <span style={badgeStyle}>{s.label}</span>
            <span style={detailStyle}>
              {s.stylistName} · {formatDayLabel(s.date)} {formatClock(s.time)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  marginBottom: 20,
  padding: "14px 16px",
  borderRadius: 12,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const leadStyle: CSSProperties = {
  margin: "0 0 12px 0",
  fontSize: 13,
  fontWeight: 600,
  color: "#334155",
};

const rowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 4,
  textDecoration: "none",
  color: "#0f172a",
  padding: "10px 12px",
  borderRadius: 10,
  background: "#fff",
  border: "1px solid #cbd5e1",
  fontSize: 13,
  maxWidth: "100%",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const badgeStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#0369a1",
};

const detailStyle: CSSProperties = {
  fontSize: 13,
  color: "#1e293b",
  lineHeight: 1.35,
};
