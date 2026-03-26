import Link from "next/link";
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
import { OutreachQueueSection } from "./_components/OutreachQueueSection";

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
                <li key={`${g.stylist.id}-${g.startTime}`} style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>
                        {g.startTime}–{g.endTime} · {g.durationMinutes} min
                      </span>
                      <span style={{ fontSize: 12, color: "#555" }}>
                        {g.stylist.name}
                        {g.suggestedService ? ` · ${g.suggestedService.name}` : ""}
                        {g.suggestedClient ? ` · ${g.suggestedClient.name} (${g.suggestedClient.status === "overdue" ? "overdue" : "due soon"})` : ""}
                      </span>
                    </div>
                    <Link
                      href={g.bookingUrl}
                      style={{
                        textDecoration: "none",
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid #d4d4d4",
                        background: "#fff",
                        color: "#111",
                        fontWeight: 800,
                        fontSize: 13,
                        whiteSpace: "nowrap",
                        alignSelf: "flex-start",
                      }}
                    >
                      Book into gap →
                    </Link>
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

const statCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
};

const statLabelStyle: React.CSSProperties = {
  color: "#666",
  fontWeight: 700,
  marginBottom: 10,
};

const statNumberStyle: React.CSSProperties = {
  fontSize: "2rem",
  fontWeight: 800,
  color: "#111",
};

const cardLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "inherit",
};

const featureCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  height: "100%",
};

const cardTitleStyle: React.CSSProperties = {
  margin: "0 0 10px 0",
  fontSize: "1.2rem",
};

const cardTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#555",
  lineHeight: 1.5,
};