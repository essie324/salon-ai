import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { getActiveRole } from "@/app/lib/roleCookies";
import RoleGate from "@/app/dashboard/_components/RoleGate";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type WorkingHourRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working: boolean;
};

type BlockedTimeRow = {
  id: string;
  block_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
};

async function saveWorkingHours(stylistId: string, formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();

  const { data: existingRows } = await supabase
    .from("stylist_working_hours")
    .select("id, day_of_week, start_time, end_time, is_working")
    .eq("stylist_id", stylistId);

  const byDay = new Map<number, WorkingHourRow>();
  for (const row of (existingRows ?? []) as WorkingHourRow[]) {
    byDay.set(row.day_of_week, row);
  }

  for (let day = 0; day <= 6; day++) {
    const isWorking = formData.get(`is_working_${day}`) === "on";
    const start = String(formData.get(`start_time_${day}`) || "").trim();
    const end = String(formData.get(`end_time_${day}`) || "").trim();
    const existing = byDay.get(day);

    if (!isWorking) {
      if (existing) {
        await supabase
          .from("stylist_working_hours")
          .update({ is_working: false })
          .eq("id", existing.id);
      }
      continue;
    }

    if (!start || !end) {
      continue;
    }

    if (existing) {
      await supabase
        .from("stylist_working_hours")
        .update({
          start_time: start,
          end_time: end,
          is_working: true,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("stylist_working_hours").insert({
        stylist_id: stylistId,
        day_of_week: day,
        start_time: start,
        end_time: end,
        is_working: true,
      });
    }
  }

  redirect(`/dashboard/stylists/${stylistId}/availability`);
}

async function createBlockedTime(stylistId: string, formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();

  const block_date = String(formData.get("new_block_date") || "").trim();
  const start_time = String(formData.get("new_start_time") || "").trim();
  const end_time = String(formData.get("new_end_time") || "").trim();
  const reason = String(formData.get("new_reason") || "").trim() || null;

  if (!block_date || !start_time || !end_time) {
    redirect(`/dashboard/stylists/${stylistId}/availability`);
  }

  await supabase.from("stylist_blocked_time").insert({
    stylist_id: stylistId,
    block_date,
    start_time,
    end_time,
    reason,
  });

  redirect(`/dashboard/stylists/${stylistId}/availability`);
}

async function updateBlockedTime(stylistId: string, blockId: string, formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();

  const block_date = String(formData.get(`block_date_${blockId}`) || "").trim();
  const start_time = String(formData.get(`start_time_${blockId}`) || "").trim();
  const end_time = String(formData.get(`end_time_${blockId}`) || "").trim();
  const reason = String(formData.get(`reason_${blockId}`) || "").trim() || null;

  if (!block_date || !start_time || !end_time) {
    redirect(`/dashboard/stylists/${stylistId}/availability`);
  }

  await supabase
    .from("stylist_blocked_time")
    .update({
      block_date,
      start_time,
      end_time,
      reason,
    })
    .eq("id", blockId);

  redirect(`/dashboard/stylists/${stylistId}/availability`);
}

async function deleteBlockedTime(stylistId: string, blockId: string) {
  "use server";
  const supabase = await createSupabaseServerClient();
  await supabase.from("stylist_blocked_time").delete().eq("id", blockId);
  redirect(`/dashboard/stylists/${stylistId}/availability`);
}

export default async function DashboardStylistAvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const role = await getActiveRole();
  const supabase = await createSupabaseServerClient();
  const { id: stylistId } = await params;

  const [{ data: stylist, error: stylistError }, { data: workingRows }, { data: blockedRows }] =
    await Promise.all([
      supabase
        .from("stylists")
        .select("id, first_name, last_name")
        .eq("id", stylistId)
        .maybeSingle(),
      supabase
        .from("stylist_working_hours")
        .select("id, day_of_week, start_time, end_time, is_working")
        .eq("stylist_id", stylistId),
      supabase
        .from("stylist_blocked_time")
        .select("id, block_date, start_time, end_time, reason")
        .eq("stylist_id", stylistId)
        .order("block_date", { ascending: true })
        .order("start_time", { ascending: true }),
    ]);

  if (stylistError || !stylist) {
    return (
      <RoleGate role={role} allowed={["manager", "admin"]}>
        <main
          style={{
            padding: 40,
            fontFamily: "Arial, sans-serif",
            maxWidth: 800,
            margin: "0 auto",
          }}
        >
          <Link
            href="/dashboard/stylists"
            style={{
              textDecoration: "none",
              fontWeight: 700,
              color: "#111",
              display: "inline-block",
              marginBottom: 10,
            }}
          >
            ← Back to Stylists
          </Link>
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e5e5",
              borderRadius: 18,
              padding: 24,
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            }}
          >
            <h1 style={{ marginTop: 0 }}>Stylist not found</h1>
          </div>
        </main>
      </RoleGate>
    );
  }

  const workingByDay = new Map<number, WorkingHourRow>();
  for (const row of (workingRows ?? []) as WorkingHourRow[]) {
    workingByDay.set(row.day_of_week, {
      id: row.id,
      day_of_week: row.day_of_week,
      start_time: String(row.start_time),
      end_time: String(row.end_time),
      is_working: !!row.is_working,
    });
  }

  const stylistName =
    `${stylist.first_name ?? ""} ${stylist.last_name ?? ""}`.trim() || "Unnamed Stylist";

  const saveWorkingHoursAction = saveWorkingHours.bind(null, stylistId);
  const createBlockedTimeAction = createBlockedTime.bind(null, stylistId);

  const mainStyle: React.CSSProperties = {
    padding: 40,
    fontFamily: "Arial, sans-serif",
    maxWidth: 900,
    margin: "0 auto",
  };
  const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  };

  return (
    <RoleGate role={role} allowed={["manager", "admin"]}>
      <main style={mainStyle}>
        <div style={{ marginBottom: 24 }}>
          <Link
            href={`/dashboard/stylists/${stylistId}`}
            style={{
              textDecoration: "none",
              fontWeight: 700,
              color: "#111",
              display: "inline-block",
              marginBottom: 10,
            }}
          >
            ← Back to {stylistName}
          </Link>
          <h1 style={{ fontSize: "2rem", margin: "0 0 8px 0" }}>
            Manage availability for {stylistName}
          </h1>
          <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
            Update weekly working hours and one-off blocked time. Booking and availability checks
            will use these settings automatically.
          </p>
        </div>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: "1.25rem", margin: "0 0 12px 0" }}>Weekly working hours</h2>
          <p style={{ margin: "0 0 14px 0", color: "#555", fontSize: 14 }}>
            Set typical hours for each day of the week. Uncheck days when this stylist is off.
          </p>

          <form action={saveWorkingHoursAction} style={cardStyle}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "140px 90px 90px",
                columnGap: 16,
                rowGap: 8,
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              <span>Day</span>
              <span>Start</span>
              <span>End</span>
            </div>

            <div style={{ display: "grid", rowGap: 6 }}>
              {DAY_LABELS.map((label, idx) => {
                const row = workingByDay.get(idx);
                const startValue = row ? String(row.start_time).slice(0, 5) : "";
                const endValue = row ? String(row.end_time).slice(0, 5) : "";
                const checked = row ? row.is_working : false;

                return (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "140px 90px 90px",
                      columnGap: 16,
                      alignItems: "center",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 14,
                      }}
                    >
                      <input
                        type="checkbox"
                        name={`is_working_${idx}`}
                        defaultChecked={checked}
                        style={{ width: 16, height: 16 }}
                      />
                      <span>{label}</span>
                    </label>
                    <input
                      type="time"
                      name={`start_time_${idx}`}
                      defaultValue={startValue}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid #d8d8d8",
                        fontSize: 13,
                      }}
                    />
                    <input
                      type="time"
                      name={`end_time_${idx}`}
                      defaultValue={endValue}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid #d8d8d8",
                        fontSize: 13,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 18, display: "flex", gap: 12 }}>
              <button
                type="submit"
                style={{
                  padding: "10px 18px",
                  borderRadius: 12,
                  border: "none",
                  background: "#0b57d0",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Save weekly hours
              </button>
            </div>
          </form>
        </section>

        <section>
          <h2 style={{ fontSize: "1.25rem", margin: "0 0 12px 0" }}>Blocked time</h2>
          <p style={{ margin: "0 0 14px 0", color: "#555", fontSize: 14 }}>
            Use blocked time for lunches, meetings, or any one-off time when this stylist is not
            bookable.
          </p>

          <div style={{ display: "grid", gap: 18 }}>
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: 15 }}>Existing blocked time</h3>
              {(blockedRows ?? []).length === 0 ? (
                <p style={{ margin: 0, color: "#555", fontSize: 14 }}>No blocked time yet.</p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    fontSize: 13,
                  }}
                >
                  {(blockedRows ?? []).map((row) => {
                    const b = row as BlockedTimeRow;
                    const action = updateBlockedTime.bind(null, stylistId, b.id);
                    const deleteAction = deleteBlockedTime.bind(null, stylistId, b.id);
                    return (
                      <form
                        key={b.id}
                        action={action}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "130px 90px 90px 1fr auto",
                          columnGap: 8,
                          rowGap: 4,
                          alignItems: "center",
                        }}
                      >
                        <input
                          type="date"
                          name={`block_date_${b.id}`}
                          defaultValue={b.block_date}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "1px solid #d8d8d8",
                            fontSize: 13,
                          }}
                        />
                        <input
                          type="time"
                          name={`start_time_${b.id}`}
                          defaultValue={String(b.start_time).slice(0, 5)}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "1px solid #d8d8d8",
                            fontSize: 13,
                          }}
                        />
                        <input
                          type="time"
                          name={`end_time_${b.id}`}
                          defaultValue={String(b.end_time).slice(0, 5)}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "1px solid #d8d8d8",
                            fontSize: 13,
                          }}
                        />
                        <input
                          type="text"
                          name={`reason_${b.id}`}
                          defaultValue={b.reason ?? ""}
                          placeholder="Reason (optional)"
                          style={{
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "1px solid #d8d8d8",
                            fontSize: 13,
                          }}
                        />
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            alignItems: "flex-end",
                          }}
                        >
                          <button
                            type="submit"
                            style={{
                              padding: "6px 10px",
                              borderRadius: 999,
                              border: "none",
                              background: "#0b57d0",
                              color: "#fff",
                              fontWeight: 600,
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                          <form action={deleteAction}>
                            <button
                              type="submit"
                              style={{
                                padding: "4px 10px",
                                borderRadius: 999,
                                border: "1px solid #f97373",
                                background: "#fff5f5",
                                color: "#b91c1c",
                                fontWeight: 600,
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </form>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: 15 }}>Add blocked time</h3>
              <form
                action={createBlockedTimeAction}
                style={{
                  display: "grid",
                  gridTemplateColumns: "130px 90px 90px 1fr auto",
                  columnGap: 8,
                  rowGap: 10,
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <input
                  type="date"
                  name="new_block_date"
                  style={{
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid #d8d8d8",
                    fontSize: 13,
                  }}
                />
                <input
                  type="time"
                  name="new_start_time"
                  style={{
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid #d8d8d8",
                    fontSize: 13,
                  }}
                />
                <input
                  type="time"
                  name="new_end_time"
                  style={{
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid #d8d8d8",
                    fontSize: 13,
                  }}
                />
                <input
                  type="text"
                  name="new_reason"
                  placeholder="Reason (optional)"
                  style={{
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid #d8d8d8",
                    fontSize: 13,
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "none",
                    background: "#0b57d0",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Add
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </RoleGate>
  );
}

