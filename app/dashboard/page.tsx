import Link from "next/link";
import type { CSSProperties } from "react";
import { CopyMessageButton } from "@/app/components/outreach/CopyMessageButton";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { getDashboardSummary } from "@/app/lib/dashboard/getDashboardSummary";
import { computeRevenueInsights, type AppointmentRevenueRow } from "@/app/lib/revenue/metrics";
import { getCurrentWeekRangeISO, localDateISO } from "@/app/lib/dashboard/dateRanges";
import {
  newAppointmentHrefFromRebookingContext,
  rebookingTimingHint,
} from "@/app/lib/rebooking/bookingQuery";
import {
  NO_SHOW_DEPOSIT_THRESHOLD,
  NO_SHOW_RESTRICT_THRESHOLD,
} from "@/app/lib/bookingRules";
import { ActionCenterSection } from "@/app/components/dashboard/ActionCenterSection";
import { OutreachFollowUpControls } from "@/app/components/outreach/OutreachFollowUpControls";
import {
  isOutreachQueueBucketsEmpty,
  type OutreachQueueBuckets,
} from "@/app/lib/outreach/followUp";
import type { OutreachQueueGroup, OutreachQueueItem } from "@/app/lib/outreach/queue";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const summary = await getDashboardSummary(supabase);

  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const rebookingBadgeStyle = (status: "not_due" | "due_soon" | "overdue") => {
    if (status === "overdue") {
      return { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" };
    }
    if (status === "due_soon") {
      return { background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" };
    }
    return { background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" };
  };

  const clientCategoryBadgeStyle = (
    category: "high_value" | "regular" | "at_risk" | "inactive",
  ) => {
    if (category === "high_value") {
      return { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" };
    }
    if (category === "at_risk") {
      return { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" };
    }
    if (category === "inactive") {
      return { background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" };
    }
    return { background: "#f8fafc", color: "#0f172a", border: "1px solid #e2e8f0" };
  };

  const now = new Date();
  const todayISO = localDateISO(now);
  const week = getCurrentWeekRangeISO(now);

  const [
    { data: revenueRows },
    { data: activeStylistsRows },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("appointment_date, stylist_id, appointment_price_cents, tip_cents, payment_status")
      .is("deleted_at", null)
      .eq("status", "completed")
      .gte("appointment_date", week.startISO)
      .lte("appointment_date", week.endISO),
    supabase
      .from("stylists")
      .select("id, first_name, last_name")
      .eq("is_active", true),
  ]);

  const revenueInsights = computeRevenueInsights(
    (revenueRows ?? []) as AppointmentRevenueRow[],
  );

  const stylistNameById = new Map<string, string>(
    (activeStylistsRows ?? []).map((s: any) => [
      s.id,
      `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Stylist",
    ]),
  );

  const todayRevenueCents =
    revenueInsights.revenueByDay.find((d) => d.dateISO === todayISO)?.revenueCents ?? 0;
  const todayRevenueTicketCount =
    revenueInsights.revenueByDay.find((d) => d.dateISO === todayISO)?.count ?? 0;

  const topStylistRevenue = revenueInsights.revenueByStylist
    .filter((r) => r.count > 0)
    .slice(0, 5)
    .map((r) => ({
    stylistId: r.stylistId,
    name: stylistNameById.get(r.stylistId) ?? r.stylistId,
    revenueCents: r.revenueCents,
    count: r.count,
    }));

  return (
    <main
      style={{
        padding: 40,
        fontFamily: "Arial, sans-serif",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "2.4rem", margin: "0 0 10px 0" }}>
          Salon Dashboard
        </h1>
        <p style={{ margin: 0, color: "#666" }}>
          Your operating center for clients, bookings, services, and stylists.
        </p>
      </div>

      <ActionCenterSection items={summary.actionCenter.items} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 18,
          marginBottom: 32,
        }}
      >
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Clients</div>
          <div style={statNumberStyle}>{summary.totals.clients}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Appointments</div>
          <div style={statNumberStyle}>{summary.totals.appointments}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Services</div>
          <div style={statNumberStyle}>{summary.totals.services}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Stylists</div>
          <div style={statNumberStyle}>{summary.totals.stylists}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Today&apos;s Revenue</div>
          <div style={statNumberStyle}>
            {money(todayRevenueCents)}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>
            {todayRevenueTicketCount} revenue ticket{todayRevenueTicketCount === 1 ? "" : "s"}
          </p>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>This Week&apos;s Revenue</div>
          <div style={statNumberStyle}>
            {money(revenueInsights.totalRevenueCents)}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>
            Week: {summary.week.startISO}–{summary.week.endISO} (Mon–Sun)
          </p>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Avg Ticket (Net)</div>
          <div style={statNumberStyle}>
            {revenueInsights.avgTicketCents != null ? money(revenueInsights.avgTicketCents) : "—"}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>
            Avg per paid/comped/refunded appointment
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 18,
          marginBottom: 32,
        }}
      >
        <Link href="/dashboard/clients" style={cardLinkStyle}>
          <div style={featureCardStyle}>
            <h2 style={cardTitleStyle}>Clients</h2>
            <p style={cardTextStyle}>
              Search, view, and manage client records.
            </p>
          </div>
        </Link>

        <Link href="/appointments" style={cardLinkStyle}>
          <div style={featureCardStyle}>
            <h2 style={cardTitleStyle}>Appointments</h2>
            <p style={cardTextStyle}>
              View the calendar, create bookings, and manage statuses.
            </p>
          </div>
        </Link>

        <Link href="/clients/new" style={cardLinkStyle}>
          <div style={featureCardStyle}>
            <h2 style={cardTitleStyle}>New Client</h2>
            <p style={cardTextStyle}>
              Quickly add a new client record for front-desk intake.
            </p>
          </div>
        </Link>

        <Link href="/dashboard/appointments/new" style={cardLinkStyle}>
          <div style={featureCardStyle}>
            <h2 style={cardTitleStyle}>New Appointment</h2>
            <p style={cardTextStyle}>
              Book a new appointment with client, service, and stylist.
            </p>
          </div>
        </Link>
      </div>

      <div style={{ marginBottom: 32 }}>
        <OutreachQueueSection queue={summary.outreachQueue} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 18,
        }}
      >
        <section style={featureCardStyle}>
          <h2 style={cardTitleStyle}>Client Intelligence</h2>
          <p style={{ ...cardTextStyle, marginBottom: 12, fontSize: 13 }}>
            Actionable retention and revenue insights.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={clientCategoryBadgeStyle("high_value")}>
              High value: {summary.clientIntelligence.counts.high_value}
            </span>
            <span style={clientCategoryBadgeStyle("at_risk")}>
              At risk: {summary.clientIntelligence.counts.at_risk}
            </span>
            <span style={clientCategoryBadgeStyle("regular")}>
              Regular: {summary.clientIntelligence.counts.regular}
            </span>
            <span style={clientCategoryBadgeStyle("inactive")}>
              Inactive: {summary.clientIntelligence.counts.inactive}
            </span>
          </div>

          <div style={{ marginTop: 4, marginBottom: 12 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 13 }}>At Risk</h3>
            {summary.clientIntelligence.atRisk.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "#555" }}>No at-risk clients.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {summary.clientIntelligence.atRisk.slice(0, 4).map((c) => (
                  <li
                    key={c.id}
                    style={{
                      padding: "7px 0",
                      borderBottom: "1px solid #f0f0f0",
                      fontSize: 13,
                    }}
                  >
                    <Link
                      href={`/dashboard/clients/${c.id}`}
                      style={{ textDecoration: "none", color: "#111" }}
                    >
                      <strong>{c.name}</strong>
                    </Link>
                    <div style={{ color: "#555", fontSize: 12, marginTop: 3 }}>
                      Return: {c.recommendedReturnISO ?? "—"} · No-shows: {c.noShowCount} · Cancels:{" "}
                      {c.cancellationCount}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ marginTop: 2 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 13 }}>High Value</h3>
            {summary.clientIntelligence.highValue.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "#555" }}>No high-value clients.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {summary.clientIntelligence.highValue.slice(0, 4).map((c) => (
                  <li
                    key={c.id}
                    style={{
                      padding: "7px 0",
                      borderBottom: "1px solid #f0f0f0",
                      fontSize: 13,
                    }}
                  >
                    <Link
                      href={`/dashboard/clients/${c.id}`}
                      style={{ textDecoration: "none", color: "#111" }}
                    >
                      <strong>{c.name}</strong>
                    </Link>
                    <div style={{ color: "#555", fontSize: 12, marginTop: 3 }}>
                      Spend: {money(c.totalSpendCents)} · Visits: {c.totalVisits}
                      {c.avgVisitFrequencyDays != null ? ` · Avg: ${c.avgVisitFrequencyDays} days` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section style={featureCardStyle}>
          <h2 style={cardTitleStyle}>Today&apos;s Appointments</h2>
          <p style={{ ...cardTextStyle, marginBottom: 12, fontSize: 13 }}>
            {summary.todayISO} (local)
          </p>
          <div style={{ display: "grid", gap: 6, fontSize: 13, color: "#333" }}>
            <div><strong>Total:</strong> {summary.todaysAppointments.total}</div>
            <div><strong>Confirmed:</strong> {summary.todaysAppointments.confirmed}</div>
            <div><strong>Checked-in:</strong> {summary.todaysAppointments.checked_in}</div>
            <div><strong>Completed:</strong> {summary.todaysAppointments.completed}</div>
            <div><strong>Cancelled:</strong> {summary.todaysAppointments.cancelled}</div>
            <div><strong>No-show:</strong> {summary.todaysAppointments.no_show}</div>
          </div>
        </section>

        <section style={featureCardStyle}>
          <h2 style={cardTitleStyle}>Revenue by Day</h2>
          <p style={{ ...cardTextStyle, marginBottom: 12, fontSize: 13 }}>
            Net revenue (paid/comped positive; refunds negative) for this week.
          </p>
          {revenueInsights.revenueByDay.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
              No completed appointments with revenue status yet.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {revenueInsights.revenueByDay.map((d) => (
                <li
                  key={d.dateISO}
                  style={{
                    padding: "6px 0",
                    borderBottom: "1px solid #f0f0f0",
                    fontSize: 13,
                  }}
                >
                  <strong>{d.dateISO}</strong> · {money(d.revenueCents)}
                  <span style={{ color: "#666" }}> ({d.count} tickets)</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={featureCardStyle}>
          <h2 style={cardTitleStyle}>Revenue by Stylist</h2>
          <p style={{ ...cardTextStyle, marginBottom: 12, fontSize: 13 }}>
            Top 5 stylists by net revenue for this week.
          </p>
          {topStylistRevenue.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
              No revenue results yet.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {topStylistRevenue.map((s) => (
                <li
                  key={s.stylistId}
                  style={{
                    padding: "6px 0",
                    borderBottom: "1px solid #f0f0f0",
                    fontSize: 13,
                  }}
                >
                  <Link
                    href={`/dashboard/stylists/${s.stylistId}`}
                    style={{ textDecoration: "none", color: "#111" }}
                  >
                    <strong>{s.name}</strong>
                  </Link>{" "}
                  · {money(s.revenueCents)}
                  <span style={{ color: "#666" }}> ({s.count} tickets)</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={featureCardStyle}>
          <h2 style={cardTitleStyle}>Clients to Rebook</h2>
          <p style={{ ...cardTextStyle, marginBottom: 12, fontSize: 13 }}>
            Based on each client&apos;s last completed service and a simple return window (e.g. 6–8 weeks).
          </p>
          {summary.rebooking.clientsToRebook.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
              No clients due for rebooking right now.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {summary.rebooking.clientsToRebook.map((c) => {
                const label = c.status === "overdue" ? "Overdue" : "Due soon";
                const bookHref = newAppointmentHrefFromRebookingContext({
                  clientId: c.id,
                  recommendedNextVisitISO: c.recommendedNextISO,
                  lastServiceId: c.lastServiceId,
                  preferredStylistId: c.preferredStylistId,
                  today: now,
                });
                const timingHint = rebookingTimingHint({
                  status: c.status,
                  daysUntilOrOverdue: c.daysUntilOrOverdue,
                  recommendedNextISO: c.recommendedNextISO,
                  weekStartISO: summary.week.startISO,
                  weekEndISO: summary.week.endISO,
                });
                return (
                  <li key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <Link
                        href={`/dashboard/clients/${c.id}`}
                        style={{
                          textDecoration: "none",
                          color: "#111",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          flex: "1 1 200px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                          <span
                            style={{
                              ...rebookingBadgeStyle(c.status),
                              padding: "4px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {label}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: "#555" }}>
                          Last service: {c.lastServiceName ?? "—"} · Last visit: {c.lastCompletedISO}
                          <br />
                          Recommended next: {c.recommendedNextISO}
                        </span>
                        {timingHint ? (
                          <span
                            style={{
                              fontSize: 12,
                              color: c.status === "overdue" ? "#9a3412" : "#a16207",
                              fontWeight: 700,
                            }}
                          >
                            {timingHint}
                          </span>
                        ) : null}
                      </Link>
                      <Link
                        href={bookHref}
                        style={{
                          textDecoration: "none",
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid #111",
                          background: "#111",
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: 13,
                          whiteSpace: "nowrap",
                          alignSelf: "center",
                        }}
                      >
                        Book appointment
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section style={featureCardStyle}>
          <h2 style={cardTitleStyle}>Fill These Gaps</h2>
          <p style={{ ...cardTextStyle, marginBottom: 12, fontSize: 13 }}>
            Open time blocks (working hours, excluding blocked time) longer than 30 minutes.
          </p>
          {summary.gapFill.suggestions.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
              No gaps detected for today.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {summary.gapFill.suggestions.map((g) => (
                <li
                  key={`${g.dateISO}-${g.stylist.id}-${g.startTime}-${g.endTime}`}
                  style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 520 }}>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>
                        {g.startTime}–{g.endTime} · {g.durationMinutes} min
                      </span>
                      <span style={{ fontSize: 12, color: "#555" }}>
                        {g.stylist.name}
                        {g.suggestedService ? ` · ${g.suggestedService.name}` : ""}
                      </span>
                      {g.suggestedClient ? (
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>
                          Suggested:{" "}
                          <Link href={g.bookingUrl} style={{ color: "#0b57d0", textDecoration: "none" }}>
                            {g.suggestedClient.name}
                          </Link>
                          {g.matchReasonLabel ? (
                            <span style={{ fontWeight: 500, color: "#0f766e" }}> — {g.matchReasonLabel}</span>
                          ) : null}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "#888" }}>No retention match — pick any client</span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                      <Link
                        href={g.bookingUrl}
                        style={{
                          textDecoration: "none",
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #111",
                          background: "#111",
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: 13,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Book slot
                      </Link>
                      {g.suggestedClient ? (
                        <Link
                          href={`/dashboard/clients/${g.suggestedClient.id}`}
                          style={{
                            textDecoration: "none",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#444",
                          }}
                        >
                          View client
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={featureCardStyle}>
          <h2 style={cardTitleStyle}>Due Soon Clients</h2>
          <p style={{ ...cardTextStyle, marginBottom: 12, fontSize: 13 }}>
            Recommended within the next 14 days.
          </p>
          {summary.retention.dueSoonClients.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
              No clients due soon.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {summary.retention.dueSoonClients.map((c) => (
                <li key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    style={{ textDecoration: "none", color: "#111", display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                    <span style={{ fontSize: 12, color: "#555" }}>
                      {c.lastServiceName ?? "Last service"} · last {c.lastCompletedISO} · recommended {c.recommendedNextISO}
                      {c.hasVisitMemory ? " · memory saved" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={featureCardStyle}>
          <h2 style={cardTitleStyle}>Overdue Clients</h2>
          <p style={{ ...cardTextStyle, marginBottom: 12, fontSize: 13 }}>
            Recommended date has passed (based on last completed service timing).
          </p>
          {summary.retention.overdueClients.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
              No overdue clients right now.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {summary.retention.overdueClients.map((c) => (
                <li key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    style={{ textDecoration: "none", color: "#111", display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                    <span style={{ fontSize: 12, color: "#555" }}>
                      {c.lastServiceName ?? "Last service"} · last {c.lastCompletedISO} · recommended {c.recommendedNextISO}
                      {c.hasVisitMemory ? " · memory saved" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={featureCardStyle}>
          <h2 style={cardTitleStyle}>No-show Summary</h2>
          <p style={{ ...cardTextStyle, marginBottom: 12, fontSize: 13 }}>
            Month: {summary.month.startISO}–{summary.month.endISO}
          </p>
          <div style={{ marginBottom: 10, fontSize: 13 }}>
            <strong>No-shows this month:</strong> {summary.noShows.thisMonthCount}
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
            Salon policy highlights clients at {NO_SHOW_DEPOSIT_THRESHOLD}+ no-shows (deposits) and{" "}
            {NO_SHOW_RESTRICT_THRESHOLD}+ (approval)—soft emphasis below.
          </p>
          {summary.noShows.topClients.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#555" }}>No no-show history yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {summary.noShows.topClients.map((c) => {
                const elevated = c.noShowCount >= NO_SHOW_DEPOSIT_THRESHOLD;
                return (
                  <li
                    key={c.id}
                    style={{
                      padding: "8px 10px",
                      marginBottom: 4,
                      borderRadius: 10,
                      borderBottom: "1px solid #f0f0f0",
                      background: elevated ? "#fffdf8" : "transparent",
                      borderLeft: elevated ? "3px solid #fde68a" : "3px solid transparent",
                    }}
                  >
                    <Link href={`/dashboard/clients/${c.id}`} style={{ textDecoration: "none", color: "#111" }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</span>{" "}
                      <span style={{ fontSize: 12, color: "#555" }}>
                        · {c.noShowCount} no-show{c.noShowCount === 1 ? "" : "s"}
                        {elevated ? " · review booking rules" : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section style={featureCardStyle}>
          <h2 style={cardTitleStyle}>Top Services (this week)</h2>
          <p style={{ ...cardTextStyle, marginBottom: 12, fontSize: 13 }}>
            By completed appointment count.
          </p>
          {summary.topServices.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#555" }}>No completed services this week.</p>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {summary.topServices.map((s) => (
                <li key={s.serviceId} style={{ marginBottom: 6, fontSize: 13 }}>
                  <strong>{s.serviceName}</strong> — {s.completedCount} completed
                  {s.revenueCents > 0 ? ` · ${money(s.revenueCents)}` : ""}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section style={featureCardStyle}>
          <h2 style={cardTitleStyle}>Stylist Utilization (today)</h2>
          <p style={{ ...cardTextStyle, marginBottom: 12, fontSize: 13 }}>
            Quick snapshot for active stylists.
          </p>
          {summary.stylistUtilization.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#555" }}>No active stylists.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {summary.stylistUtilization.map((s) => (
                <li key={s.stylistId} style={{ padding: "6px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>
                  <strong>{s.stylistName}</strong> — {s.appointmentsToday} appt · {s.completedToday} completed
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function OutreachQueueSection({ queue }: { queue: OutreachQueueBuckets }) {
  if (isOutreachQueueBucketsEmpty(queue)) {
    return (
      <section style={outreachSectionStyle}>
        <h2 style={outreachTitleStyle}>Outreach Queue</h2>
        <p style={outreachSubtitleStyle}>
          Daily actions from upcoming visits and retention signals. Nothing queued right now.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          Reminders cover the next two calendar days; rebooking rows use the same engine as the rest of the
          dashboard (no SMS/email automation here). You can schedule follow-ups for later without sending
          messages automatically.
        </p>
      </section>
    );
  }

  return (
    <section style={outreachSectionStyle}>
      <h2 style={outreachTitleStyle}>Outreach Queue</h2>
      <p style={outreachSubtitleStyle}>
        Who to contact: appointment reminders, due-soon rebooks, and overdue follow-ups. Staff actions only —
        this list does not send messages. Schedule a row for a later date to organize reminder work; when
        that date arrives, it appears under &quot;Needs action now&quot; again.
      </p>

      {queue.needsAction.isEmpty ? (
        <p style={{ margin: "0 0 18px 0", fontSize: 13, color: "#64748b" }}>
          Nothing needs immediate action right now{queue.scheduledFollowUp.isEmpty ? "" : " — see scheduled follow-ups below"}.
        </p>
      ) : (
        <>
          <h3 style={outreachBucketHeadingStyle}>Needs action now</h3>
          <p style={outreachBucketSubStyle}>
            Due today, past-due follow-ups, and anything not snoozed to a future date.
          </p>
          <div style={{ display: "grid", gap: 22 }}>
            {queue.needsAction.groups.map((g) => (
              <OutreachQueueGroupBlock key={g.groupId} group={g} followUpMode="active" />
            ))}
          </div>
        </>
      )}

      {!queue.scheduledFollowUp.isEmpty ? (
        <div style={{ marginTop: queue.needsAction.isEmpty ? 0 : 28 }}>
          <h3 style={outreachBucketHeadingStyle}>Scheduled follow-up</h3>
          <p style={outreachBucketSubStyle}>
            Snoozed to a future date — still the same outreach type and message preview as when you scheduled
            it.
          </p>
          <div style={{ display: "grid", gap: 22 }}>
            {queue.scheduledFollowUp.groups.map((g) => (
              <OutreachQueueGroupBlock key={`${g.groupId}-sched`} group={g} followUpMode="scheduled" />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OutreachQueueGroupBlock({
  group: g,
  followUpMode,
}: {
  group: OutreachQueueGroup;
  followUpMode: "active" | "scheduled";
}) {
  return (
    <div>
      <h3 style={outreachGroupTitleStyle}>{g.title}</h3>
      {g.subtitle ? <p style={outreachGroupSubtitleStyle}>{g.subtitle}</p> : null}
      {g.items.length === 0 ? (
        <p style={outreachEmptyStyle}>No items in this group.</p>
      ) : (
        <ul style={outreachListStyle}>
          {g.items.map((item) => (
            <OutreachQueueRow key={item.key} item={item} followUpMode={followUpMode} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OutreachQueueRow({
  item,
  followUpMode,
}: {
  item: OutreachQueueItem;
  followUpMode: "active" | "scheduled";
}) {
  const duplicateView =
    item.primaryActionHref === item.viewClientHref && item.primaryActionLabel === "View Client";
  return (
    <li style={outreachRowStyle}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={outreachNameRowStyle}>
          <span style={outreachClientNameStyle}>{item.clientName}</span>
          <span style={outreachBadgeStyle(outreachTypeBadge(item.type))}>{outreachTypeLabel(item.type)}</span>
          {item.bookingRestricted ? <span style={outreachBadgeStyle("restricted")}>Restricted</span> : null}
        </div>
        <p style={outreachContextStyle}>{item.dateContext}</p>
        <p style={outreachActionStyle}>{item.recommendedAction}</p>
        <div style={outreachPreviewWrapStyle}>
          <p style={outreachPreviewMetaStyle}>
            <span style={{ fontWeight: 700 }}>{item.template.internalLabel}</span>
            <span style={{ color: "#94a3b8" }}> · {item.template.shortActionLabel}</span>
          </p>
          <p style={outreachPreviewTextStyle}>{item.template.previewText}</p>
        </div>
        <OutreachFollowUpControls
          outreachKey={item.key}
          outreachType={item.type}
          clientId={item.clientId}
          appointmentId={item.appointmentId ?? null}
          mode={followUpMode}
          scheduledForIso={item.followUp?.scheduledFor ?? null}
        />
      </div>
      <div style={outreachCtaRowStyle}>
        {duplicateView ? (
          <>
            <Link href={item.viewClientHref} style={outreachPrimaryLinkStyle}>
              View Client
            </Link>
            <CopyMessageButton message={item.template.previewText} />
          </>
        ) : (
          <>
            <Link href={item.viewClientHref} style={outreachSecondaryLinkStyle}>
              View Client
            </Link>
            <Link href={item.primaryActionHref} style={outreachPrimaryLinkStyle}>
              {item.primaryActionLabel}
            </Link>
            {item.bookAppointmentHref ? (
              <Link href={item.bookAppointmentHref} style={outreachSecondaryLinkStyle}>
                Book Appointment
              </Link>
            ) : null}
            <CopyMessageButton message={item.template.previewText} />
          </>
        )}
      </div>
    </li>
  );
}

const outreachBucketHeadingStyle: CSSProperties = {
  margin: "0 0 6px 0",
  fontSize: 15,
  fontWeight: 800,
  color: "#0f172a",
};

const outreachBucketSubStyle: CSSProperties = {
  margin: "0 0 14px 0",
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.45,
  maxWidth: 720,
};

function outreachTypeLabel(type: string): string {
  if (type === "appointment_reminder") return "Reminder";
  if (type === "due_soon_rebooking") return "Due soon";
  return "Overdue";
}

function outreachTypeBadge(type: string): "muted" | "amber" | "rose" {
  if (type === "appointment_reminder") return "muted";
  if (type === "due_soon_rebooking") return "amber";
  return "rose";
}

function outreachBadgeStyle(t: "muted" | "amber" | "rose" | "restricted"): CSSProperties {
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

const outreachSectionStyle: CSSProperties = {
  gridColumn: "1 / -1",
  padding: 22,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  background: "linear-gradient(180deg, #fafafa 0%, #ffffff 100%)",
  boxShadow: "0 2px 12px rgba(15, 23, 42, 0.06)",
};

const outreachTitleStyle: CSSProperties = {
  margin: "0 0 8px 0",
  fontSize: "1.35rem",
  fontWeight: 800,
  color: "#0f172a",
};

const outreachSubtitleStyle: CSSProperties = {
  margin: "0 0 18px 0",
  fontSize: 14,
  color: "#475569",
  lineHeight: 1.5,
  maxWidth: 720,
};

const outreachGroupTitleStyle: CSSProperties = {
  margin: "0 0 6px 0",
  fontSize: 13,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#64748b",
};

const outreachGroupSubtitleStyle: CSSProperties = {
  margin: "0 0 12px 0",
  fontSize: 12,
  color: "#94a3b8",
  lineHeight: 1.45,
  maxWidth: 640,
};

const outreachListStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: 0,
};

const outreachRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
  padding: "14px 0",
  borderBottom: "1px solid #f1f5f9",
};

const outreachNameRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const outreachClientNameStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 15,
  color: "#0f172a",
};

const outreachContextStyle: CSSProperties = {
  margin: "6px 0 0 0",
  fontSize: 13,
  color: "#334155",
  lineHeight: 1.45,
};

const outreachActionStyle: CSSProperties = {
  margin: "4px 0 0 0",
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.4,
};

const outreachPreviewWrapStyle: CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 10,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderLeft: "3px solid #cbd5e1",
};

const outreachPreviewMetaStyle: CSSProperties = {
  margin: "0 0 6px 0",
  fontSize: 11,
  color: "#64748b",
  textTransform: "none",
  letterSpacing: "0.02em",
};

const outreachPreviewTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#334155",
  lineHeight: 1.5,
  fontStyle: "italic",
};

const outreachCtaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
};

const outreachSecondaryLinkStyle: CSSProperties = {
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

const outreachPrimaryLinkStyle: CSSProperties = {
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

const outreachEmptyStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#94a3b8",
  fontStyle: "italic",
};

const statCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
};

const statLabelStyle: CSSProperties = {
  color: "#666",
  fontWeight: 700,
  marginBottom: 10,
};

const statNumberStyle: CSSProperties = {
  fontSize: "2rem",
  fontWeight: 800,
  color: "#111",
};

const cardLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "inherit",
};

const featureCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  height: "100%",
};

const cardTitleStyle: CSSProperties = {
  margin: "0 0 10px 0",
  fontSize: "1.2rem",
};

const cardTextStyle: CSSProperties = {
  margin: 0,
  color: "#555",
  lineHeight: 1.5,
};