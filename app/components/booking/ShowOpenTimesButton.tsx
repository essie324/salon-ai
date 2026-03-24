"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";

const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const wrapStyle: CSSProperties = {
  marginTop: 4,
};

/**
 * Reads the new-appointment form and navigates with `clientId`, `serviceId`, `date`
 * (and optional `stylistId`, `time`) so the server can render availability.
 * Preserves intake / rebook query params from the current URL.
 */
export function ShowOpenTimesButton() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onClick() {
    const form = document.getElementById("new-appointment-form") as HTMLFormElement | null;
    if (!form) return;

    const fd = new FormData(form);
    const clientId = String(fd.get("client_id") || "").trim();
    const serviceId = String(fd.get("service_id") || "").trim();
    const date = String(fd.get("appointment_date") || "").trim();
    const stylistId = String(fd.get("stylist_id") || "").trim();
    const time = String(fd.get("appointment_time") || "").trim();

    if (!serviceId || !date) {
      window.alert("Select a service and date first, then load open times.");
      return;
    }

    const q = new URLSearchParams();
    if (clientId) q.set("clientId", clientId);
    q.set("serviceId", serviceId);
    q.set("date", date);
    if (stylistId) q.set("stylistId", stylistId);
    if (time) q.set("time", time);

    const passThrough = [
      "intakeSessionId",
      "consultationHint",
      "intakeDecision",
      "rebook",
      "message",
      "error",
    ] as const;
    for (const key of passThrough) {
      const v = searchParams.get(key);
      if (v) q.set(key, v);
    }

    router.push(`${pathname}?${q.toString()}`);
  }

  return (
    <div style={wrapStyle}>
      <button type="button" onClick={onClick} style={buttonStyle}>
        Show open times
      </button>
      <span style={{ fontSize: 13, color: "#64748b", marginLeft: 8 }}>
        Uses your current client, service, date, and stylist (optional) in the URL so availability can load.
      </span>
    </div>
  );
}
