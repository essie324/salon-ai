import Link from "next/link";
import type { CSSProperties } from "react";
import type { OutreachQueueResult } from "@/app/lib/outreach/queue";

type Props = {
  queue: OutreachQueueResult;
};

export function OutreachQueueSection({ queue }: Props) {
  if (queue.isEmpty) {
    return (
      <section style={sectionStyle}>
        <h2 style={titleStyle}>Outreach Queue</h2>
        <p style={subtitleStyle}>
          Daily actions from upcoming visits and retention signals. Nothing queued right now.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          Reminders cover the next two calendar days; rebooking rows use the same engine as the rest of the
          dashboard (no SMS/email automation here).
        </p>
      </section>
    );
  }

  return (
    <section style={sectionStyle}>
      <h2 style={titleStyle}>Outreach Queue</h2>
      <p style={subtitleStyle}>
        Who to contact today: appointment reminders, due-soon rebooks, and overdue follow-ups. Staff actions
        only — this list does not send messages.
      </p>

      <div style={{ display: "grid", gap: 22 }}>
        {queue.groups.map((g) => (
          <div key={g.groupId}>
            <h3 style={groupTitleStyle}>{g.title}</h3>
            {g.subtitle ? <p style={groupSubtitleStyle}>{g.subtitle}</p> : null}
            {g.items.length === 0 ? (
              <p style={emptyStyle}>No items in this group.</p>
            ) : (
              <ul style={listStyle}>
                {g.items.map((item) => {
                  const duplicateView =
                    item.primaryActionHref === item.viewClientHref &&
                    item.primaryActionLabel === "View client";
                  return (
                    <li key={item.key} style={rowStyle}>
                      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                        <div style={nameRowStyle}>
                          <span style={clientNameStyle}>{item.clientName}</span>
                          <span style={badgeStyle(typeBadge(item.type))}>{typeLabel(item.type)}</span>
                          {item.bookingRestricted ? (
                            <span style={badgeStyle("restricted")}>Restricted</span>
                          ) : null}
                        </div>
                        <p style={contextStyle}>{item.dateContext}</p>
                        <p style={actionStyle}>{item.recommendedAction}</p>
                      </div>
                      <div style={ctaRowStyle}>
                        {duplicateView ? (
                          <Link href={item.viewClientHref} style={primaryLinkStyle}>
                            View client
                          </Link>
                        ) : (
                          <>
                            <Link href={item.viewClientHref} style={secondaryLinkStyle}>
                              View client
                            </Link>
                            <Link href={item.primaryActionHref} style={primaryLinkStyle}>
                              {item.primaryActionLabel}
                            </Link>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function typeLabel(type: string): string {
  if (type === "appointment_reminder") return "Reminder";
  if (type === "due_soon_rebooking") return "Due soon";
  return "Overdue";
}

function typeBadge(type: string): "muted" | "amber" | "rose" {
  if (type === "appointment_reminder") return "muted";
  if (type === "due_soon_rebooking") return "amber";
  return "rose";
}

function badgeStyle(t: "muted" | "amber" | "rose" | "restricted"): CSSProperties {
  const base: CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    padding: "3px 8px",
    borderRadius: 999,
    whiteSpace: "nowrap",
  };
  if (t === "amber") {
    return { ...base, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" };
  }
  if (t === "rose") {
    return { ...base, background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" };
  }
  if (t === "restricted") {
    return { ...base, background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" };
  }
  return { ...base, background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" };
}

const sectionStyle: CSSProperties = {
  gridColumn: "1 / -1",
  padding: 22,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  background: "linear-gradient(180deg, #fafafa 0%, #ffffff 100%)",
  boxShadow: "0 2px 12px rgba(15, 23, 42, 0.06)",
};

const titleStyle: CSSProperties = {
  margin: "0 0 8px 0",
  fontSize: "1.35rem",
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

const groupTitleStyle: CSSProperties = {
  margin: "0 0 6px 0",
  fontSize: 13,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#64748b",
};

const groupSubtitleStyle: CSSProperties = {
  margin: "0 0 12px 0",
  fontSize: 12,
  color: "#94a3b8",
  lineHeight: 1.45,
  maxWidth: 640,
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
  borderBottom: "1px solid #f1f5f9",
};

const nameRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const clientNameStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 15,
  color: "#0f172a",
};

const contextStyle: CSSProperties = {
  margin: "6px 0 0 0",
  fontSize: 13,
  color: "#334155",
  lineHeight: 1.45,
};

const actionStyle: CSSProperties = {
  margin: "4px 0 0 0",
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.4,
};

const ctaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
};

const secondaryLinkStyle: CSSProperties = {
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

const primaryLinkStyle: CSSProperties = {
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

const emptyStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#94a3b8",
  fontStyle: "italic",
};
