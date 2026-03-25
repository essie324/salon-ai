"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type SlotStatus = "idle" | "checking" | "available" | "conflict" | "unavailable";

const wrapStyle: CSSProperties = {
  marginTop: 8,
  padding: "10px 12px",
  borderRadius: 10,
  fontSize: 13,
  lineHeight: 1.45,
};

const idleStyle: CSSProperties = { ...wrapStyle, background: "transparent", color: "#64748b" };

const availableStyle: CSSProperties = {
  ...wrapStyle,
  background: "#ecfdf5",
  border: "1px solid #a7f3d0",
  color: "#065f46",
};

const conflictStyle: CSSProperties = {
  ...wrapStyle,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
};

const unavailableStyle: CSSProperties = {
  ...wrapStyle,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
};

const checkingStyle: CSSProperties = {
  ...wrapStyle,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
};

type Props = {
  formId: string;
  /** When editing, exclude this appointment from overlap checks */
  excludeAppointmentId?: string;
};

/**
 * Live validation while changing date/time/stylist/service: calls GET /api/booking/validate-slot.
 */
export function BookingSlotValidationClient({ formId, excludeAppointmentId }: Props) {
  const [status, setStatus] = useState<SlotStatus>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runCheck = useCallback(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const fd = new FormData(form);
    const stylistId = String(fd.get("stylist_id") || "").trim();
    const serviceId = String(fd.get("service_id") || "").trim();
    const date = String(fd.get("appointment_date") || "").trim();
    const time = String(fd.get("appointment_time") || "").trim();

    if (!stylistId || !serviceId || !date || !time) {
      setStatus("idle");
      setDetail(null);
      return;
    }

    setStatus("checking");
    setDetail(null);

    const q = new URLSearchParams({
      stylistId,
      serviceId,
      date,
      time,
    });
    if (excludeAppointmentId) {
      q.set("excludeAppointmentId", excludeAppointmentId);
    }

    fetch(`/api/booking/validate-slot?${q.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((body: { ok?: boolean; status?: string; message?: string }) => {
        if (body.ok) {
          setStatus("available");
          setDetail("This time works for the selected stylist.");
          return;
        }
        if (body.status === "conflict") {
          setStatus("conflict");
          setDetail(
            body.message ?? "This time is not available for the selected stylist.",
          );
          return;
        }
        setStatus("unavailable");
        setDetail(
          body.message ?? "This time is not available for the selected stylist.",
        );
      })
      .catch(() => {
        setStatus("idle");
        setDetail(null);
      });
  }, [formId, excludeAppointmentId]);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => runCheck(), 320);
    };

    form.addEventListener("change", schedule);
    form.addEventListener("input", schedule);
    runCheck();

    return () => {
      form.removeEventListener("change", schedule);
      form.removeEventListener("input", schedule);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [formId, runCheck]);

  if (status === "idle") {
    return <p style={idleStyle}>Pick service, stylist, date, and time to check availability.</p>;
  }

  if (status === "checking") {
    return <p style={checkingStyle}>Checking availability…</p>;
  }

  if (status === "available") {
    return <p style={availableStyle}>{detail}</p>;
  }

  if (status === "conflict") {
    return <p style={conflictStyle}>{detail}</p>;
  }

  return <p style={unavailableStyle}>{detail}</p>;
}
