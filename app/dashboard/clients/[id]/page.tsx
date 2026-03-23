import Link from "next/link";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { statusLabel } from "@/app/lib/appointmentStatus";
import { computeClientRebookingDecision, type RebookingStatus } from "@/app/lib/rebooking/engine";
import { computeClientVisitMetrics } from "@/app/lib/clients/intelligence/metrics";
import { computeClientTotalSpendCents } from "@/app/lib/clients/intelligence/spend";
import { classifyClientCategory } from "@/app/lib/clients/intelligence/classifyClient";
import type { ClientCategory } from "@/app/lib/clients/intelligence/types";
import { hasAnyVisitMemory, type AppointmentMemory } from "@/app/lib/visitMemory";
import { computeClientBehaviorPatterns } from "@/app/lib/clients/patterns";

type Client = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  hair_history?: string | null;
  color_history?: string | null;
  allergy_notes?: string | null;
  preferred_stylist_id?: string | null;
  no_show_count?: number | null;
  last_no_show_at?: string | null;
  deposit_required?: boolean | null;
  booking_restricted?: boolean | null;
  restriction_note?: string | null;
};

type Appointment = {
  id: string;
  start_at: string;
  end_at: string | null;
  status: string;
  notes: string | null;
  service_id: string | null;
  stylist_id: string | null;
  appointment_price_cents?: number | null;
  tip_cents?: number | null;
  payment_status?: string | null;
};

type Service = {
  id: string;
  name: string | null;
  duration_minutes: number | null;
  price_cents: number | null;
};

type Stylist = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function formatDate(startIso: string) {
  const d = new Date(startIso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeRange(startIso: string, endIso: string | null) {
  const start = new Date(startIso);
  const startTime = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (!endIso) return startTime;

  const end = new Date(endIso);
  const endTime = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${startTime} – ${endTime}`;
}

export default async function DashboardClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { id } = await params;

  const [
    { data: client, error: clientError },
    { data: appointments, error: appointmentsError },
    { data: services },
    { data: stylists },
    { data: memories },
    { data: intakeSessions },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, first_name, last_name, email, phone, notes, hair_history, color_history, allergy_notes, preferred_stylist_id, no_show_count, last_no_show_at, deposit_required, booking_restricted, restriction_note",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select(
        "id, start_at, end_at, status, notes, service_id, stylist_id, appointment_price_cents, tip_cents, payment_status",
      )
      .eq("client_id", id)
      .order("start_at", { ascending: false }),
    supabase.from("services").select("id, name, duration_minutes, price_cents"),
    supabase.from("stylists").select("id, first_name, last_name"),
    // fetch all memories for this client's appointments (by joining through appointments)
    supabase
      .from("appointment_memories")
      .select(
        "id, appointment_id, formula_notes, developer_notes, technique_notes, processing_notes, aftercare_notes, photo_urls, created_at, appointments!inner(client_id)",
      )
      .eq("appointments.client_id", id),
    supabase
      .from("intake_sessions")
      .select(
        "id, source, requested_service, requested_stylist, timing_preference, budget_notes, concern_notes, ai_summary, appointment_id, created_at",
      )
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (clientError) {
    return (
      <main style={mainStyle}>
        <Link href="/dashboard/clients" style={backLinkStyle}>
          ← Back to Clients
        </Link>

        <div style={errorBoxStyle}>Error loading client: {clientError.message}</div>
      </main>
    );
  }

  if (!client) {
    return (
      <main style={mainStyle}>
        <Link href="/dashboard/clients" style={backLinkStyle}>
          ← Back to Clients
        </Link>

        <div style={cardStyle}>
          <h1 style={{ marginTop: 0 }}>Client not found</h1>
          <p>This client record does not exist.</p>
        </div>
      </main>
    );
  }

  const typedClient = client as Client;
  const appointmentList = (appointments ?? []) as Appointment[];
  const serviceList = (services ?? []) as Service[];
  const stylistList = (stylists ?? []) as Stylist[];
  const memoryList = (memories ?? []) as unknown as AppointmentMemory[];
  const intakeList = (intakeSessions ?? []) as {
    id: string;
    source: string | null;
    requested_service: string | null;
    requested_stylist: string | null;
    timing_preference: string | null;
    budget_notes: string | null;
    concern_notes: string | null;
    ai_summary: string | null;
    appointment_id: string | null;
    created_at: string;
  }[];

  const memoryByAppointmentId = new Map<string, AppointmentMemory>();
  for (const m of memoryList) {
    if (m?.appointment_id) memoryByAppointmentId.set(m.appointment_id, m);
  }

  const recentFormulaMemory = appointmentList
    .filter((a) => a.status === "completed")
    .map((a) => ({ appt: a, mem: memoryByAppointmentId.get(a.id) ?? null }))
    .find(({ mem }) => hasAnyVisitMemory(mem));

  const serviceMap = new Map(serviceList.map((s) => [s.id, s]));
  const stylistMap = new Map(stylistList.map((s) => [s.id, s]));

  const clientPatterns = computeClientBehaviorPatterns({
    appointments: appointmentList.map((a) => ({
      start_at: a.start_at,
      status: a.status,
      service_id: a.service_id,
      stylist_id: a.stylist_id,
    })),
    serviceById: new Map(serviceList.map((s) => [s.id, { name: s.name }])),
    stylistById: stylistMap,
  });

  const fullName =
    `${typedClient.first_name ?? ""} ${typedClient.last_name ?? ""}`.trim() ||
    "Unnamed Client";

  const preferredStylist =
    typedClient.preferred_stylist_id &&
    stylistMap.get(typedClient.preferred_stylist_id) != null
      ? stylistMap.get(typedClient.preferred_stylist_id)!
      : null;

  const preferredStylistName =
    preferredStylist &&
    `${preferredStylist.first_name ?? ""} ${preferredStylist.last_name ?? ""}`.trim();

  const noShowCount = typedClient.no_show_count ?? 0;
  const lastNoShowAt = typedClient.last_no_show_at
    ? new Date(typedClient.last_no_show_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const depositRequired = typedClient.deposit_required === true || noShowCount >= 2;
  const bookingRestricted = typedClient.booking_restricted === true || noShowCount >= 3;
  const restrictionNote = typedClient.restriction_note?.trim() || null;

  const rebooking = computeClientRebookingDecision({
    appointments: appointmentList.map((a) => ({
      start_at: a.start_at,
      status: a.status,
      service_id: a.service_id,
    })),
    serviceById: new Map(serviceList.map((s) => [s.id, { name: s.name }])),
    clientRisk: {
      noShowCount,
      depositRequired,
      bookingRestricted,
    },
  });

  const clientVisitMetrics = computeClientVisitMetrics(appointmentList);
  const clientSpend = computeClientTotalSpendCents(appointmentList);

  const clientCategory = classifyClientCategory({
    now: new Date(),
    metrics: clientVisitMetrics,
    rebookingStatus: rebooking.status,
    recommendedReturnDate: rebooking.recommended_date,
    spendCents: clientSpend.totalSpendCents,
  });

  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const clientCategoryBadgeStyle = (category: ClientCategory) => {
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

  const clientCategoryLabel =
    clientCategory.category === "high_value"
      ? "High value"
      : clientCategory.category === "at_risk"
        ? "At risk"
        : clientCategory.category === "inactive"
          ? "Inactive"
          : "Regular";

  const lastCompletedLabel =
    rebooking.last_completed_at != null
      ? new Date(rebooking.last_completed_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

  const recommendedLabel =
    rebooking.recommended_date != null
      ? rebooking.recommended_date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

  return (
    <main style={mainStyle}>
      <div style={headerRowStyle}>
        <div>
          <Link href="/dashboard/clients" style={backLinkStyle}>
            ← Back to Clients
          </Link>

          <h1 style={titleStyle}>{fullName}</h1>
          <p style={{ margin: 0, color: "#666" }}>
            Client profile and appointment history
          </p>
        </div>

        <div style={headerActionsStyle}>
          <Link href={`/dashboard/clients/${id}/edit`} style={secondaryButtonStyle}>
            Edit Client
          </Link>
          <Link
            href={`/dashboard/appointments/new?clientId=${id}`}
            style={primaryButtonStyle}
          >
            Book Next Appointment
          </Link>
        </div>
      </div>

      <div style={gridStyle}>
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Client Info</h2>

          <p style={lineStyle}>
            <strong>Email:</strong> {typedClient.email || "—"}
          </p>

          <p style={lineStyle}>
            <strong>Phone:</strong> {typedClient.phone || "—"}
          </p>

          <div style={{ marginTop: 14 }}>
            <strong>Notes:</strong>
            <div style={notesBoxStyle}>
              {typedClient.notes || "No notes yet."}
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              background: noShowCount > 0 ? "#fef8f6" : "#f8f8f8",
              border: noShowCount > 0 ? "1px solid #f5e6e0" : "1px solid #eee",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>No-shows</h3>
            <p style={{ margin: "4px 0", fontSize: 14 }}>
              <strong>Count:</strong> {noShowCount}
            </p>
            <p style={{ margin: "4px 0", fontSize: 14 }}>
              <strong>Last:</strong> {lastNoShowAt ?? "—"}
            </p>
          </div>

          <div
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 12,
              background: bookingRestricted ? "#fef2f2" : depositRequired ? "#fff7ed" : "#f8f8f8",
              border: bookingRestricted
                ? "1px solid #fecaca"
                : depositRequired
                  ? "1px solid #fed7aa"
                  : "1px solid #eee",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Booking protection</h3>
            <p style={{ margin: "4px 0", fontSize: 14 }}>
              <strong>Deposit required:</strong> {depositRequired ? "Yes" : "No"}
            </p>
            <p style={{ margin: "4px 0", fontSize: 14 }}>
              <strong>Booking restricted:</strong> {bookingRestricted ? "Yes" : "No"}
            </p>
            {restrictionNote ? (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#555" }}>
                <strong>Note:</strong> {restrictionNote}
              </p>
            ) : null}
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              background: "#f8fbff",
              border: "1px solid #e0edff",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Rebooking</h3>
            {rebooking.last_completed_at == null ? (
              <p style={{ margin: 0, fontSize: 14, color: "#555" }}>
                No completed visits yet. Once this guest completes a service, we&apos;ll recommend their next visit date here.
              </p>
            ) : (
              <>
                <p style={{ margin: "4px 0", fontSize: 14 }}>
                  <strong>Last visit:</strong>{" "}
                  {lastCompletedLabel}{" "}
                  {rebooking.last_service_name ? `· ${rebooking.last_service_name}` : ""}
                </p>
                {recommendedLabel ? (
                  <p style={{ margin: "4px 0", fontSize: 14 }}>
                    <strong>Recommended next visit:</strong> {recommendedLabel}
                  </p>
                ) : (
                  <p style={{ margin: "4px 0", fontSize: 14 }}>
                    <strong>Recommended next visit:</strong> — (consultation-only)
                  </p>
                )}
                {recommendedLabel && (
                  <p
                    style={{
                      margin: "4px 0",
                      fontSize: 13,
                      color:
                        rebooking.status === "overdue"
                          ? "#b91c1c"
                          : rebooking.status === "due"
                            ? "#92400e"
                            : "#15803d",
                      fontWeight: 600,
                    }}
                  >
                    {rebooking.status === "overdue"
                      ? "Overdue — time for maintenance"
                      : rebooking.status === "due"
                        ? "Due for maintenance"
                        : "Upcoming — on track"}
                    {typeof rebooking.days_since_last_visit === "number"
                      ? ` · ${rebooking.days_since_last_visit} day${rebooking.days_since_last_visit === 1 ? "" : "s"} since last visit`
                      : ""}
                  </p>
                )}
                {recommendedLabel && rebooking.reasoning ? (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666", fontWeight: 700 }}>
                    Why: {rebooking.reasoning}
                  </p>
                ) : null}

                {recommendedLabel && (
                  <div style={{ marginTop: 12 }}>
                    <Link
                      href={`/dashboard/appointments/new?clientId=${id}`}
                      style={primaryButtonStyle}
                    >
                      Book Next Appointment
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          <div
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 12,
              background: "#fff",
              border: "1px solid #eee",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Rebooking Recommendation</h3>
            {rebooking.last_completed_at == null ? (
              <p style={{ margin: 0, fontSize: 14, color: "#555" }}>
                No completed visits yet.
              </p>
            ) : (
              (() => {
                const status = rebooking.status;
                const label =
                  status === "overdue"
                    ? "Overdue"
                    : status === "due"
                      ? "Due"
                      : "Upcoming";
                const color =
                  status === "overdue"
                    ? "#b91c1c"
                    : status === "due"
                      ? "#92400e"
                      : "#166534";
                return (
                  <>
                    <p style={{ margin: "6px 0", fontSize: 14 }}>
                      <strong>Last completed service:</strong>{" "}
                      {rebooking.last_service_name ?? "—"}{" "}
                      {rebooking.last_completed_at ? `· ${lastCompletedLabel}` : ""}
                    </p>
                    <p style={{ margin: "6px 0", fontSize: 14 }}>
                      <strong>Recommended next visit:</strong>{" "}
                      {recommendedLabel ?? "—"}
                    </p>
                    <p style={{ margin: "6px 0", fontSize: 13, fontWeight: 700, color }}>
                      Status: {label}
                    </p>
                    {rebooking.reasoning ? (
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666", fontWeight: 800 }}>
                        Why: {rebooking.reasoning}
                      </p>
                    ) : null}
                  </>
                );
              })()
            )}
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              background: "#fff",
              border: "1px solid #eee",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Client Intelligence</h3>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <span
                style={{
                  ...clientCategoryBadgeStyle(clientCategory.category),
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                {clientCategoryLabel}
              </span>
              {clientCategory.labels[0] ? (
                <span style={{ fontSize: 12, color: "#666", fontWeight: 800 }}>
                  {clientCategory.labels[0]}
                </span>
              ) : null}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 12, color: "#666", fontWeight: 800 }}>Last visit</p>
                <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 900 }}>
                  {clientVisitMetrics.lastVisitAt
                    ? clientVisitMetrics.lastVisitAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </p>
              </div>

              <div>
                <p style={{ margin: 0, fontSize: 12, color: "#666", fontWeight: 800 }}>Total visits</p>
                <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 900 }}>
                  {clientVisitMetrics.totalVisits}
                </p>
              </div>

              <div>
                <p style={{ margin: 0, fontSize: 12, color: "#666", fontWeight: 800 }}>Avg frequency</p>
                <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 900 }}>
                  {clientVisitMetrics.avgVisitFrequencyDays != null
                    ? `${clientVisitMetrics.avgVisitFrequencyDays} days`
                    : "—"}
                </p>
              </div>

              <div>
                <p style={{ margin: 0, fontSize: 12, color: "#666", fontWeight: 800 }}>No-shows</p>
                <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 900 }}>
                  {clientVisitMetrics.noShowCount}
                </p>
              </div>

              <div>
                <p style={{ margin: 0, fontSize: 12, color: "#666", fontWeight: 800 }}>Cancellations</p>
                <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 900 }}>
                  {clientVisitMetrics.cancellationCount}
                </p>
              </div>

              <div>
                <p style={{ margin: 0, fontSize: 12, color: "#666", fontWeight: 800 }}>Total spend</p>
                <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 900 }}>
                  {money(clientSpend.totalSpendCents)}
                </p>
              </div>
            </div>

            {clientCategory.category === "at_risk" || clientCategory.category === "inactive" ? (
              <div style={{ marginTop: 12 }}>
                <Link href={`/dashboard/appointments/new?clientId=${id}`} style={primaryButtonStyle}>
                  Book Next Appointment
                </Link>
              </div>
            ) : null}
          </div>

          <div
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 12,
              background: "#fff",
              border: "1px solid #eee",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Client Insights</h3>

            <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#111" }}>
              Usually books every{" "}
              {clientPatterns.avgVisitFrequencyWeeks != null
                ? `${clientPatterns.avgVisitFrequencyWeeks} weeks`
                : "—"}
            </p>

            <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#111" }}>
              Prefers {clientPatterns.preferredServiceKeyword ?? "—"}
            </p>

            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 800,
                color: clientPatterns.riskLabel === "Risk client" ? "#b91c1c" : "#166534",
              }}
            >
              {clientPatterns.riskLabel}
            </p>

            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#666" }}>
              Based on recent no-shows and cancellations. (no-shows: {clientPatterns.noShowCount}, cancelled:{" "}
              {clientPatterns.cancellationCount})
            </p>
          </div>

          <div style={{ marginTop: 16 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Consultation & Intake</h3>
            <p style={lineStyle}>
              <strong>Hair History:</strong>{" "}
              {typedClient.hair_history && typedClient.hair_history.trim()
                ? typedClient.hair_history
                : "—"}
            </p>
            <p style={lineStyle}>
              <strong>Color History:</strong>{" "}
              {typedClient.color_history && typedClient.color_history.trim()
                ? typedClient.color_history
                : "—"}
            </p>
            <p style={lineStyle}>
              <strong>Allergy Notes:</strong>{" "}
              {typedClient.allergy_notes && typedClient.allergy_notes.trim()
                ? typedClient.allergy_notes
                : "—"}
            </p>
            <p style={lineStyle}>
              <strong>Preferred Stylist:</strong>{" "}
              {preferredStylistName || "No preference set"}
            </p>
          </div>

          <div style={{ marginTop: 18 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Recent Formula Memory</h3>
            {!recentFormulaMemory ? (
              <p style={{ margin: 0, fontSize: 14, color: "#555" }}>
                No saved visit memory yet. Add formula notes on a completed appointment to build a technical history.
              </p>
            ) : (
              <div style={{ padding: 12, borderRadius: 12, background: "#f8f8f8" }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#444" }}>
                  <strong>Most recent:</strong> {formatDate(recentFormulaMemory.appt.start_at)} ·{" "}
                  {formatTimeRange(recentFormulaMemory.appt.start_at, recentFormulaMemory.appt.end_at)}
                </p>
                {recentFormulaMemory.mem?.formula_notes?.trim() ? (
                  <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>
                    {recentFormulaMemory.mem.formula_notes}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 14, color: "#555" }}>
                    Formula details were not saved, but this visit has memory attached.
                  </p>
                )}
                <div style={{ marginTop: 10 }}>
                  <Link
                    href={`/dashboard/appointments/${recentFormulaMemory.appt.id}`}
                    style={{ fontSize: 13, color: "#0b57d0", textDecoration: "none", fontWeight: 700 }}
                  >
                    View full visit memory →
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 18 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Recent Intake Context</h3>
            <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#555" }}>
              Request context (what the guest asked for). Kept separate from appointment facts.
            </p>
            {intakeList.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, color: "#555" }}>
                No intake sessions yet.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {intakeList.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid #eee",
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
                      {new Date(s.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {s.source ? ` · ${s.source}` : ""}
                      {s.appointment_id ? " · linked to appointment" : ""}
                    </div>

                    {s.ai_summary?.trim() ? (
                      <div style={{ marginBottom: 8, fontSize: 14, whiteSpace: "pre-wrap" }}>
                        {s.ai_summary}
                      </div>
                    ) : null}

                    <div style={{ fontSize: 13, color: "#333", display: "grid", gap: 4 }}>
                      {s.requested_service?.trim() ? (
                        <div><strong>Requested service:</strong> {s.requested_service}</div>
                      ) : null}
                      {s.requested_stylist?.trim() ? (
                        <div><strong>Requested stylist:</strong> {s.requested_stylist}</div>
                      ) : null}
                      {s.timing_preference?.trim() ? (
                        <div><strong>Timing preference:</strong> {s.timing_preference}</div>
                      ) : null}
                      {s.budget_notes?.trim() ? (
                        <div><strong>Budget:</strong> {s.budget_notes}</div>
                      ) : null}
                      {s.concern_notes?.trim() ? (
                        <div><strong>Concerns:</strong> {s.concern_notes}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Appointment History</h2>

          {appointmentsError && (
            <div style={errorBoxStyle}>
              Error loading appointments: {appointmentsError.message}
            </div>
          )}

          {!appointmentsError && appointmentList.length === 0 ? (
            <p>No appointments found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {appointmentList.map((appt) => {
                const service = appt.service_id
                  ? serviceMap.get(appt.service_id)
                  : null;
                const stylist = appt.stylist_id
                  ? stylistMap.get(appt.stylist_id)
                  : null;
                const memory = memoryByAppointmentId.get(appt.id) ?? null;
                const hasMemory = hasAnyVisitMemory(memory);
                const notesPreview =
                  appt.notes && appt.notes.trim()
                    ? appt.notes.length > 80
                      ? appt.notes.slice(0, 80).trim() + "…"
                      : appt.notes
                    : null;

                return (
                  <Link
                    key={appt.id}
                    href={`/dashboard/appointments/${appt.id}`}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                    }}
                  >
                    <div style={appointmentCardStyle}>
                      <div style={appointmentHeaderStyle}>
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            {formatDate(appt.start_at)}
                          </div>
                          <div style={{ fontSize: 13, color: "#444" }}>
                            {formatTimeRange(appt.start_at, appt.end_at)}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {hasMemory ? (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "6px 10px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                border: "1px solid #dbeafe",
                              }}
                            >
                              Memory saved
                            </span>
                          ) : null}
                          <span style={statusBadgeStyle(appt.status)}>
                            {statusLabel(appt.status)}
                          </span>
                        </div>
                      </div>

                      <p style={lineStyle}>
                        <strong>Service:</strong> {service?.name ?? "—"}
                      </p>

                      <p style={lineStyle}>
                        <strong>Stylist:</strong>{" "}
                        {stylist
                          ? `${stylist.first_name ?? ""} ${
                              stylist.last_name ?? ""
                            }`.trim()
                          : "—"}
                      </p>

                      {notesPreview && (
                        <p
                          style={{
                            ...lineStyle,
                            fontSize: 13,
                            color: "#555",
                            fontStyle: "italic",
                          }}
                        >
                          {notesPreview}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  padding: 40,
  fontFamily: "Arial, sans-serif",
  maxWidth: 1200,
  margin: "0 auto",
};

const headerRowStyle: React.CSSProperties = {
  marginBottom: 24,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 16,
};

const headerActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const titleStyle: React.CSSProperties = {
  fontSize: "2.2rem",
  margin: "12px 0 8px 0",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 360px) 1fr",
  gap: 24,
  alignItems: "start",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 18,
  padding: 24,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
};

const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 16,
  fontSize: "1.2rem",
};

const notesBoxStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 12,
  borderRadius: 12,
  background: "#f8f8f8",
  minHeight: 70,
};

const appointmentCardStyle: React.CSSProperties = {
  border: "1px solid #e8e8e8",
  borderRadius: 16,
  padding: 18,
  background: "#fff",
};

const appointmentHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 10,
  gap: 12,
};

const lineStyle: React.CSSProperties = {
  margin: "6px 0",
};

const backLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "#111",
  fontWeight: 700,
};

const primaryButtonStyle: React.CSSProperties = {
  textDecoration: "none",
  padding: "10px 16px",
  borderRadius: 12,
  background: "#111",
  color: "#fff",
  fontWeight: 700,
};

const secondaryButtonStyle: React.CSSProperties = {
  textDecoration: "none",
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #d4d4d4",
  background: "#fff",
  color: "#111",
  fontWeight: 700,
};

const errorBoxStyle: React.CSSProperties = {
  background: "#ffe5e5",
  color: "#900",
  padding: 16,
  borderRadius: 12,
};

function statusBadgeStyle(status: string): React.CSSProperties {
  let bg = "#f5f5f5";
  let color = "#444";

  switch (status) {
    case "scheduled":
      bg = "#eef6ff";
      color = "#0b57d0";
      break;
    case "confirmed":
      bg = "#e8f5e9";
      color = "#2e7d32";
      break;
    case "completed":
      bg = "#ebfff0";
      color = "#137333";
      break;
    case "cancelled":
      bg = "#fff1f1";
      color = "#b42318";
      break;
    case "no_show":
      bg = "#f5f5f5";
      color = "#6b7280";
      break;
    default:
      break;
  }

  return {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    fontWeight: 700,
    textTransform: "capitalize",
    background: bg,
    color,
    fontSize: 12,
  };
}