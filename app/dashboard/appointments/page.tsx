import Link from "next/link";
import type { CSSProperties } from "react";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { FEATURE_INBOX_AND_INTAKE_DB } from "@/app/lib/featureFlags";
import { localDateISO } from "@/app/lib/dashboard/dateRanges";
import { normalizeAppointmentDate } from "@/app/lib/appointmentLocalTime";
import { DayScheduler } from "@/app/components/calendar/DayScheduler";
import { WeekScheduler } from "@/app/components/calendar/WeekScheduler";
import {
  addCalendarDays,
  enumerateDatesInclusive,
  getWeekRangeForDateISO,
  toSchedulerAppointments,
} from "@/app/lib/calendar/schedulerData";
import {
  resolveStylistCalendarColor,
  UNASSIGNED_APPOINTMENT_BLOCK_COLOR,
} from "@/app/lib/calendar/stylistColors";

type SearchParams = {
  date?: string;
  status?: string;
  stylistId?: string;
  showArchived?: string;
  /** `day` (default) | `week` | `list` */
  view?: string;
};

type AppointmentRow = {
  id: string;
  appointment_date: string | null;
  appointment_time: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
  notes: string | null;
  service_goal: string | null;
  payment_status: string | null;
  deposit_required: boolean | null;
  deposit_status: string | null;
  appointment_price_cents: number | null;
  tip_cents: number | null;
  deleted_at: string | null;
  client_id: string | null;
  stylist_id: string | null;
  service_id: string | null;
};

type ClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  no_show_count: number | null;
};

type StylistRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  calendar_color: string | null;
};

type ServiceRow = {
  id: string;
  name: string | null;
  duration_minutes: number | null;
  price_cents: number | null;
};

function formatMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatName(first: string | null | undefined, last: string | null | undefined) {
  return `${first ?? ""} ${last ?? ""}`.trim() || "Unnamed";
}

function statusColor(status: string | null | undefined): string {
  switch (status) {
    case "confirmed":
      return "#2563eb";
    case "checked_in":
      return "#ea580c";
    case "completed":
      return "#16a34a";
    case "cancelled":
      return "#6b7280";
    case "no_show":
      return "#dc2626";
    default:
      return "#374151";
  }
}

function paymentBadgeColor(status: string | null | undefined): string {
  switch (status) {
    case "paid":
      return "#166534";
    case "refunded":
      return "#7c2d12";
    case "comped":
      return "#4c1d95";
    default:
      return "#374151";
  }
}

function buildAppointmentsHref(p: {
  date: string;
  view: "day" | "week" | "list";
  status: string;
  stylistId: string;
  showArchived: boolean;
}) {
  const q = new URLSearchParams();
  q.set("date", p.date);
  if (p.view !== "day") q.set("view", p.view);
  if (p.status) q.set("status", p.status);
  if (p.stylistId) q.set("stylistId", p.stylistId);
  if (p.showArchived) q.set("showArchived", "true");
  return `/dashboard/appointments?${q.toString()}`;
}

export default async function DashboardAppointmentsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  /** Day view is keyed by stored `appointment_date` (calendar), not `start_at` UTC instant. */
  const selectedDate =
    normalizeAppointmentDate(params.date ?? "") ?? localDateISO();
  const selectedStatus = params.status || "";
  const selectedStylistId = params.stylistId || "";
  const showArchived = params.showArchived === "true";
  const viewParam = params.view;
  const view: "day" | "week" | "list" =
    viewParam === "list" ? "list" : viewParam === "week" ? "week" : "day";

  const weekRange = getWeekRangeForDateISO(selectedDate);
  const weekDates = enumerateDatesInclusive(weekRange.startISO, weekRange.endISO);

  const supabase = await createSupabaseServerClient();

  const appointmentsSelect =
    "id, appointment_date, appointment_time, start_at, end_at, status, notes, service_goal, payment_status, deposit_required, deposit_status, appointment_price_cents, tip_cents, deleted_at, client_id, stylist_id, service_id";

  // Filter by `appointment_date` (calendar day), not `start_at` — matches booking form.
  let appointmentsQuery = supabase
    .from("appointments")
    .select(appointmentsSelect)
    .order("appointment_time", { ascending: true });

  if (view === "week") {
    appointmentsQuery = appointmentsQuery
      .gte("appointment_date", weekRange.startISO)
      .lte("appointment_date", weekRange.endISO);
  } else {
    appointmentsQuery = appointmentsQuery.eq("appointment_date", selectedDate);
  }

  if (selectedStatus) {
    appointmentsQuery = appointmentsQuery.eq("status", selectedStatus);
  }

  if (selectedStylistId) {
    appointmentsQuery = appointmentsQuery.eq("stylist_id", selectedStylistId);
  }

  if (showArchived) {
    appointmentsQuery = appointmentsQuery.not("deleted_at", "is", null);
  } else {
    appointmentsQuery = appointmentsQuery.is("deleted_at", null);
  }

  const [
    { data: appointmentsData, error: appointmentsError },
    { data: clientsData, error: clientsError },
    { data: stylistsData, error: stylistsError },
    { data: servicesData, error: servicesError },
  ] = await Promise.all([
    appointmentsQuery,
    supabase
      .from("clients")
      .select("id, first_name, last_name, no_show_count"),
    supabase
      .from("stylists")
      .select("id, first_name, last_name, calendar_color")
      .eq("is_active", true)
      .order("first_name", { ascending: true }),
    supabase
      .from("services")
      .select("id, name, duration_minutes, price_cents")
      .order("name", { ascending: true }),
  ]);

  if (appointmentsError) {
    return (
      <main style={mainStyle}>
        <div style={headerRowStyle}>
          <div>
            <Link href="/dashboard" style={backLinkStyle}>
              ← Back to Dashboard
            </Link>
            <h1 style={titleStyle}>Appointments</h1>
          </div>
        </div>
        <div style={errorBoxStyle}>
          Error loading appointments: {appointmentsError.message}
        </div>
      </main>
    );
  }

  if (clientsError) {
    return (
      <main style={mainStyle}>
        <div style={errorBoxStyle}>Error loading clients: {clientsError.message}</div>
      </main>
    );
  }

  if (stylistsError) {
    return (
      <main style={mainStyle}>
        <div style={errorBoxStyle}>Error loading stylists: {stylistsError.message}</div>
      </main>
    );
  }

  if (servicesError) {
    return (
      <main style={mainStyle}>
        <div style={errorBoxStyle}>Error loading services: {servicesError.message}</div>
      </main>
    );
  }

  const appointments = (appointmentsData ?? []) as AppointmentRow[];
  const clients = (clientsData ?? []) as ClientRow[];
  const stylists = (stylistsData ?? []) as StylistRow[];
  const services = (servicesData ?? []) as ServiceRow[];

  const clientMap = new Map(
    clients.map((client) => [
      client.id,
      {
        name: formatName(client.first_name, client.last_name),
        noShowCount: client.no_show_count ?? 0,
      },
    ])
  );

  const stylistMap = new Map(
    stylists.map((stylist) => [
      stylist.id,
      formatName(stylist.first_name, stylist.last_name),
    ])
  );

  const serviceMap = new Map(
    services.map((service) => [
      service.id,
      {
        name: service.name ?? "Unnamed Service",
        duration: service.duration_minutes,
        price: service.price_cents,
      },
    ])
  );

  const totals = appointments.reduce(
    (acc, appt) => {
      acc.total += 1;
      if (appt.status === "confirmed") acc.confirmed += 1;
      if (appt.status === "completed") acc.completed += 1;
      if (appt.status === "cancelled") acc.cancelled += 1;
      if (appt.status === "no_show") acc.noShow += 1;
      return acc;
    },
    { total: 0, confirmed: 0, completed: 0, cancelled: 0, noShow: 0 }
  );

  const stylistsForCalendar = selectedStylistId
    ? stylists.filter((s) => s.id === selectedStylistId)
    : stylists;

  const stylistColorById = new Map(
    stylists.map((s) => [s.id, resolveStylistCalendarColor(s.id, s.calendar_color)] as const),
  );

  const stylistsForDayScheduler = stylistsForCalendar.map((s) => ({
    id: s.id,
    first_name: s.first_name,
    last_name: s.last_name,
    calendarColor: resolveStylistCalendarColor(s.id, s.calendar_color),
  }));

  const schedulerInputs = appointments.map((appt) => {
    const client = appt.client_id ? clientMap.get(appt.client_id) : null;
    const service = appt.service_id ? serviceMap.get(appt.service_id) : null;
    const stylistCalendarColor = appt.stylist_id
      ? stylistColorById.get(appt.stylist_id) ??
        resolveStylistCalendarColor(appt.stylist_id, null)
      : UNASSIGNED_APPOINTMENT_BLOCK_COLOR;
    return {
      id: appt.id,
      start_at: appt.start_at,
      end_at: appt.end_at,
      status: appt.status,
      stylist_id: appt.stylist_id,
      service_id: appt.service_id,
      appointment_date: appt.appointment_date,
      clientName: client?.name ?? "Unknown",
      serviceName: service?.name ?? "—",
      durationMinutes: service?.duration ?? 60,
      stylistCalendarColor,
      clientNoShowCount: client?.noShowCount,
    };
  });
  const schedulerAppointments = toSchedulerAppointments(schedulerInputs);

  const prevDay = addCalendarDays(selectedDate, -1);
  const nextDay = addCalendarDays(selectedDate, 1);
  const prevWeekAnchor = addCalendarDays(selectedDate, -7);
  const nextWeekAnchor = addCalendarDays(selectedDate, 7);

  const filterLinkBase = {
    date: selectedDate,
    view,
    status: selectedStatus,
    stylistId: selectedStylistId,
    showArchived,
  } as const;

  return (
    <main style={mainStyle}>
      <div style={headerRowStyle}>
        <div>
          <Link href="/dashboard" style={backLinkStyle}>
            ← Back to Dashboard
          </Link>
          <h1 style={titleStyle}>Appointments</h1>
          <p style={subtitleStyle}>
            Salon schedule: day or week grid with stylist columns, or switch to list for payments and
            details. Times use each appointment&apos;s stored start/end.
          </p>
        </div>

        <div style={headerActionsStyle}>
          {FEATURE_INBOX_AND_INTAKE_DB ? (
            <Link href="/dashboard/appointments/intake" style={secondaryButtonStyle}>
              Guest intake
            </Link>
          ) : null}
          <Link href="/dashboard/appointments/new" style={primaryButtonStyle}>
            Create Appointment
          </Link>
        </div>
      </div>

      <form method="get" action="/dashboard/appointments" style={filterCardStyle}>
        <div style={filterGridStyle}>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" name="date" defaultValue={selectedDate} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Status</label>
            <select name="status" defaultValue={selectedStatus} style={inputStyle}>
              <option value="">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked In</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Stylist</label>
            <select name="stylistId" defaultValue={selectedStylistId} style={inputStyle}>
              <option value="">All stylists</option>
              {stylists.map((stylist) => (
                <option key={stylist.id} value={stylist.id}>
                  {formatName(stylist.first_name, stylist.last_name)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Archived</label>
            <select
              name="showArchived"
              defaultValue={showArchived ? "true" : "false"}
              style={inputStyle}
            >
              <option value="false">Active only</option>
              <option value="true">Archived only</option>
            </select>
          </div>
        </div>

        <input type="hidden" name="view" value={view} />

        <div style={buttonRowStyle}>
          <button type="submit" style={primarySubmitStyle}>
            Apply Filters
          </button>

          <Link href="/dashboard/appointments" style={secondaryButtonStyle}>
            Reset
          </Link>
        </div>
      </form>

      <div style={statsGridStyle}>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Appointments</div>
          <div style={statValueStyle}>{totals.total}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Confirmed</div>
          <div style={statValueStyle}>{totals.confirmed}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Completed</div>
          <div style={statValueStyle}>{totals.completed}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Cancelled</div>
          <div style={statValueStyle}>{totals.cancelled}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>No Shows</div>
          <div style={statValueStyle}>{totals.noShow}</div>
        </div>
      </div>

      <div style={calendarToolbarStyle}>
        <div style={viewToggleRowStyle}>
          <span style={toolbarLabelStyle}>Layout</span>
          <Link
            href={buildAppointmentsHref({ ...filterLinkBase, view: "day" })}
            style={view === "day" ? viewPillActiveStyle : viewPillStyle}
          >
            Day
          </Link>
          <Link
            href={buildAppointmentsHref({ ...filterLinkBase, view: "week" })}
            style={view === "week" ? viewPillActiveStyle : viewPillStyle}
          >
            Week
          </Link>
          <Link
            href={buildAppointmentsHref({ ...filterLinkBase, view: "list" })}
            style={view === "list" ? viewPillActiveStyle : viewPillStyle}
          >
            List
          </Link>
        </div>
        <div style={navRowStyle}>
          {view === "week" ? (
            <>
              <Link
                href={buildAppointmentsHref({ ...filterLinkBase, date: prevWeekAnchor })}
                style={navLinkStyle}
              >
                ← Previous week
              </Link>
              <Link
                href={buildAppointmentsHref({
                  ...filterLinkBase,
                  date: localDateISO(),
                })}
                style={navLinkStyle}
              >
                This week
              </Link>
              <Link
                href={buildAppointmentsHref({ ...filterLinkBase, date: nextWeekAnchor })}
                style={navLinkStyle}
              >
                Next week →
              </Link>
            </>
          ) : (
            <>
              <Link
                href={buildAppointmentsHref({ ...filterLinkBase, date: prevDay })}
                style={navLinkStyle}
              >
                ← Previous day
              </Link>
              <Link
                href={buildAppointmentsHref({ ...filterLinkBase, date: localDateISO() })}
                style={navLinkStyle}
              >
                Today
              </Link>
              <Link
                href={buildAppointmentsHref({ ...filterLinkBase, date: nextDay })}
                style={navLinkStyle}
              >
                Next day →
              </Link>
            </>
          )}
        </div>
        <p style={calendarHintStyle}>
          {view === "week"
            ? `Week of ${weekRange.startISO}–${weekRange.endISO} (Mon–Sun).`
            : `Day ${selectedDate}.`}{" "}
          Archived / deleted appointments are excluded from the active schedule.
        </p>
      </div>

      {view !== "list" ? (
        <div style={{ marginBottom: 28 }}>
          {view === "day" ? (
            <DayScheduler
              date={selectedDate}
              stylists={stylistsForDayScheduler}
              appointments={schedulerAppointments}
            />
          ) : (
            <WeekScheduler
              weekDates={weekDates}
              appointments={schedulerAppointments}
              prefillStylistId={selectedStylistId || undefined}
            />
          )}
        </div>
      ) : null}

      {view === "list" && appointments.length === 0 ? (
        <div style={emptyCardStyle}>No appointments found for this view.</div>
      ) : null}

      {view === "list" && appointments.length > 0 ? (
        <div style={listWrapStyle}>
          {appointments.map((appt) => {
            const client = appt.client_id ? clientMap.get(appt.client_id) : null;
            const stylistName = appt.stylist_id ? stylistMap.get(appt.stylist_id) : null;
            const service = appt.service_id ? serviceMap.get(appt.service_id) : null;
            const totalRevenue =
              (appt.appointment_price_cents ?? service?.price ?? 0) + (appt.tip_cents ?? 0);

            return (
              <Link
                key={appt.id}
                href={`/dashboard/appointments/${appt.id}`}
                style={cardLinkStyle}
              >
                <div style={appointmentCardStyle}>
                  <div style={appointmentTopRowStyle}>
                    <div>
                      <div style={appointmentTitleStyle}>
                        {client?.name ?? "Unknown Client"}
                      </div>
                      <div style={metaTextStyle}>
                        {appt.appointment_time || "—"} • {service?.name ?? "Unknown Service"}
                      </div>
                    </div>

                    <div
                      style={{
                        ...statusBadgeStyle,
                        color: statusColor(appt.status),
                        borderColor: `${statusColor(appt.status)}33`,
                        background: `${statusColor(appt.status)}12`,
                      }}
                    >
                      {appt.status ?? "scheduled"}
                    </div>
                  </div>

                  <div style={detailsGridStyle}>
                    <div>
                      <div style={smallLabelStyle}>Stylist</div>
                      <div>{stylistName ?? "—"}</div>
                    </div>

                    <div>
                      <div style={smallLabelStyle}>Duration</div>
                      <div>{service?.duration != null ? `${service.duration} min` : "—"}</div>
                    </div>

                    <div>
                      <div style={smallLabelStyle}>Service Price</div>
                      <div>{formatMoney(appt.appointment_price_cents ?? service?.price)}</div>
                    </div>

                    <div>
                      <div style={smallLabelStyle}>Tip</div>
                      <div>{formatMoney(appt.tip_cents)}</div>
                    </div>

                    <div>
                      <div style={smallLabelStyle}>Total</div>
                      <div>{formatMoney(totalRevenue)}</div>
                    </div>

                    <div>
                      <div style={smallLabelStyle}>Payment</div>
                      <div
                        style={{
                          ...inlineBadgeStyle,
                          color: paymentBadgeColor(appt.payment_status),
                          borderColor: `${paymentBadgeColor(appt.payment_status)}33`,
                          background: `${paymentBadgeColor(appt.payment_status)}12`,
                        }}
                      >
                        {appt.payment_status ?? "unpaid"}
                      </div>
                    </div>
                  </div>

                  <div style={footerRowStyle}>
                    {appt.deposit_required ? (
                      <span style={miniWarningStyle}>
                        Deposit: {appt.deposit_status ?? "required"}
                      </span>
                    ) : (
                      <span style={miniNeutralStyle}>No deposit required</span>
                    )}

                    {(client?.noShowCount ?? 0) > 0 ? (
                      <span style={miniDangerStyle}>
                        {client?.noShowCount} no-show{client?.noShowCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>

                  {appt.notes ? (
                    <div style={notesPreviewStyle}>
                      {appt.notes.length > 120 ? `${appt.notes.slice(0, 120)}…` : appt.notes}
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}
    </main>
  );
}

const mainStyle: CSSProperties = {
  padding: 40,
  maxWidth: 1200,
  margin: "0 auto",
  fontFamily: "Arial, sans-serif",
};

const headerRowStyle: CSSProperties = {
  marginBottom: 24,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const backLinkStyle: CSSProperties = {
  textDecoration: "none",
  fontWeight: 700,
  color: "#111",
};

const titleStyle: CSSProperties = {
  margin: "12px 0 8px 0",
  fontSize: "2.1rem",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: "#666",
};

const filterCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  display: "grid",
  gap: 16,
  marginBottom: 22,
};

const filterGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 16,
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontWeight: 700,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  boxSizing: "border-box",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const primaryButtonStyle: CSSProperties = {
  display: "inline-block",
  textDecoration: "none",
  background: "#111",
  color: "#fff",
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  fontWeight: 700,
};

const primarySubmitStyle: CSSProperties = {
  background: "#111",
  color: "#fff",
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  display: "inline-block",
  textDecoration: "none",
  background: "#fff",
  color: "#111",
  padding: "12px 16px",
  borderRadius: 10,
  border: "1px solid #ccc",
  fontWeight: 700,
};

const calendarToolbarStyle: CSSProperties = {
  background: "#fafafa",
  border: "1px solid #e8e8e8",
  borderRadius: 14,
  padding: "14px 16px",
  marginBottom: 20,
};

const viewToggleRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 10,
  marginBottom: 12,
};

const toolbarLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#374151",
  marginRight: 4,
};

const viewPillStyle: CSSProperties = {
  display: "inline-block",
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#374151",
  fontWeight: 700,
  fontSize: 13,
  textDecoration: "none",
};

const viewPillActiveStyle: CSSProperties = {
  ...viewPillStyle,
  background: "#111",
  color: "#fff",
  border: "1px solid #111",
};

const navRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
  alignItems: "center",
  marginBottom: 10,
};

const navLinkStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#0b57d0",
  textDecoration: "none",
};

const calendarHintStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.5,
};

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 14,
  marginBottom: 22,
};

const statCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
};

const statLabelStyle: CSSProperties = {
  color: "#666",
  fontWeight: 700,
  marginBottom: 8,
  fontSize: 13,
};

const statValueStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: "#111",
};

const emptyCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
};

const listWrapStyle: CSSProperties = {
  display: "grid",
  gap: 16,
};

const cardLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "inherit",
};

const appointmentCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: 16,
  padding: 18,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  display: "grid",
  gap: 14,
};

const appointmentTopRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const appointmentTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#111",
};

const metaTextStyle: CSSProperties = {
  color: "#666",
  marginTop: 4,
};

const statusBadgeStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #ddd",
  fontWeight: 700,
  fontSize: 12,
  textTransform: "capitalize",
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
};

const smallLabelStyle: CSSProperties = {
  fontSize: 12,
  color: "#666",
  marginBottom: 4,
  fontWeight: 700,
};

const inlineBadgeStyle: CSSProperties = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid #ddd",
  fontWeight: 700,
  fontSize: 12,
  textTransform: "capitalize",
};

const footerRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const miniWarningStyle: CSSProperties = {
  display: "inline-block",
  background: "#fff7ed",
  color: "#c2410c",
  border: "1px solid #fdba74",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 700,
};

const miniDangerStyle: CSSProperties = {
  display: "inline-block",
  background: "#fef2f2",
  color: "#b91c1c",
  border: "1px solid #fca5a5",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 700,
};

const miniNeutralStyle: CSSProperties = {
  display: "inline-block",
  background: "#f9fafb",
  color: "#374151",
  border: "1px solid #d1d5db",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 700,
};

const notesPreviewStyle: CSSProperties = {
  color: "#555",
  fontSize: 14,
  lineHeight: 1.5,
};

const errorBoxStyle: CSSProperties = {
  background: "#ffe5e5",
  color: "#900",
  padding: 16,
  borderRadius: 12,
};