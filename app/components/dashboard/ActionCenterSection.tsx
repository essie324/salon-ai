import Link from "next/link";
import type { CSSProperties } from "react";
import { CopyMessageButton } from "@/app/components/outreach/CopyMessageButton";
import type { ActionCenterItem } from "@/app/lib/actionCenter/today";

function categoryLabel(cat: ActionCenterItem["category"]): string {
  if (cat === "revenue") return "Revenue";
  if (cat === "outreach") return "Outreach";
  return "Reminder";
}

function categoryBadgeStyle(cat: ActionCenterItem["category"]): CSSProperties {
  if (cat === "revenue") {
    return { background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" };
  }
  if (cat === "outreach") {
    return { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" };
  }
  return { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" };
}

function typeLabel(t: ActionCenterItem["type"]): string {
  if (t === "gap") return "Gap";
  if (t === "outreach") return "Outreach";
  return "Reminder";
}

export function ActionCenterSection({ items }: { items: ActionCenterItem[] }) {
  return (
    <section style={sectionStyle}>
      <h2 style={titleStyle}>Today&apos;s Action Center</h2>
      <p style={subtitleStyle}>
        Highest-impact actions for right now: gaps to fill, retention outreach, and reminders for visits
        today or tomorrow. Staff-only — nothing sends automatically.
      </p>

      {items.length === 0 ? (
        <p style={emptyStyle}>You&apos;re caught up — no prioritized actions at the moment.</p>
      ) : (
        <ul style={listStyle}>
          {items.map((item) => (
            <li key={item.id} style={rowStyle}>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div style={nameRowStyle}>
                  <span
                    style={{
                      ...badgeBaseStyle,
                      ...categoryBadgeStyle(item.category),
                    }}
                  >
                    {categoryLabel(item.category)} · {typeLabel(item.type)}
                  </span>
                  {item.clientName ? (
                    item.type === "gap" && item.gapBookingHref ? (
                      <Link href={item.gapBookingHref} style={{ ...clientNameStyle, textDecoration: "none", color: "#0b57d0" }}>
                        {item.clientName}
                      </Link>
                    ) : (
                      <span style={clientNameStyle}>{item.clientName}</span>
                    )
                  ) : (
                    <span style={clientNameMutedStyle}>—</span>
                  )}
                </div>
                <p style={timeStyle}>{item.timeContext}</p>
                <p style={descStyle}>{item.description}</p>
                {item.fitHint ? (
                  <p style={fitHintStyle}>{item.fitHint}</p>
                ) : null}
                {item.stylistName ? (
                  <p style={stylistStyle}>
                    <strong>Stylist:</strong> {item.stylistName}
                  </p>
                ) : null}
              </div>
              <div style={ctaRowStyle}>
                {item.ctas.map((c, i) => {
                  if (c.kind === "book") {
                    return (
                      <Link key={`${item.id}-b-${i}`} href={c.href} style={primaryCtaStyle}>
                        {c.label}
                      </Link>
                    );
                  }
                  if (c.kind === "view_client") {
                    return (
                      <Link key={`${item.id}-vc-${i}`} href={c.href} style={secondaryCtaStyle}>
                        View Client
                      </Link>
                    );
                  }
                  if (c.kind === "view_appointment") {
                    return (
                      <Link key={`${item.id}-va-${i}`} href={c.href} style={secondaryCtaStyle}>
                        View Appointment
                      </Link>
                    );
                  }
                  return <CopyMessageButton key={`${item.id}-cm-${i}`} message={c.message} />;
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const sectionStyle: CSSProperties = {
  marginBottom: 28,
  padding: 22,
  borderRadius: 16,
  border: "1px solid #0f172a",
  background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
  boxShadow: "0 2px 14px rgba(15, 23, 42, 0.08)",
};

const titleStyle: CSSProperties = {
  margin: "0 0 8px 0",
  fontSize: "1.5rem",
  fontWeight: 800,
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  margin: "0 0 18px 0",
  fontSize: 14,
  color: "#475569",
  lineHeight: 1.5,
  maxWidth: 720,
};

const emptyStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#64748b",
  fontStyle: "italic",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: 0,
};

const rowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
  padding: "14px 0",
  borderBottom: "1px solid #e2e8f0",
};

const nameRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const badgeBaseStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  padding: "3px 8px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};

const clientNameStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 15,
  color: "#0f172a",
};

const clientNameMutedStyle: CSSProperties = {
  fontSize: 13,
  color: "#94a3b8",
};

const timeStyle: CSSProperties = {
  margin: "6px 0 0 0",
  fontSize: 13,
  color: "#334155",
  fontWeight: 600,
};

const descStyle: CSSProperties = {
  margin: "4px 0 0 0",
  fontSize: 13,
  color: "#64748b",
  lineHeight: 1.45,
};

const fitHintStyle: CSSProperties = {
  margin: "4px 0 0 0",
  fontSize: 12,
  color: "#0f766e",
  fontWeight: 600,
  lineHeight: 1.4,
};

const stylistStyle: CSSProperties = {
  margin: "6px 0 0 0",
  fontSize: 12,
  color: "#64748b",
};

const ctaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
};

const secondaryCtaStyle: CSSProperties = {
  textDecoration: "none",
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 700,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const primaryCtaStyle: CSSProperties = {
  textDecoration: "none",
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 800,
  fontSize: 13,
  whiteSpace: "nowrap",
};
