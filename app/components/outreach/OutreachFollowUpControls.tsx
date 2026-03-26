"use client";

import { useFormStatus } from "react-dom";
import { useMemo, type CSSProperties } from "react";
import {
  clearOutreachSchedule,
  dismissOutreachFollowUp,
  scheduleOutreachFollowUp,
} from "@/app/dashboard/outreach-actions";
import { formatScheduledForLabel } from "@/app/lib/outreach/followUp";

function SubmitButton({
  label,
  variant,
}: {
  label: string;
  variant: "primary" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();
  const style =
    variant === "primary"
      ? outreachSchedulePrimaryBtnStyle
      : variant === "danger"
        ? outreachScheduleDangerBtnStyle
        : outreachScheduleGhostBtnStyle;
  return (
    <button type="submit" disabled={pending} style={style}>
      {pending ? "…" : label}
    </button>
  );
}

export type OutreachFollowUpControlsProps = {
  outreachKey: string;
  outreachType: string;
  clientId: string;
  appointmentId?: string | null;
  /** `active` = needs action now; `scheduled` = future follow-up bucket */
  mode: "active" | "scheduled";
  scheduledForIso?: string | null;
};

export function OutreachFollowUpControls(props: OutreachFollowUpControlsProps) {
  const { outreachKey, outreachType, clientId, appointmentId, mode, scheduledForIso } = props;

  const minDate = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const hidden = (
    <>
      <input type="hidden" name="outreachKey" value={outreachKey} />
      <input type="hidden" name="outreachType" value={outreachType} />
      <input type="hidden" name="clientId" value={clientId} />
      {appointmentId ? <input type="hidden" name="appointmentId" value={appointmentId} /> : null}
    </>
  );

  if (mode === "scheduled") {
    return (
      <div style={outreachFollowUpWrapStyle}>
        <span style={outreachScheduledPillStyle}>
          Follow-up: {formatScheduledForLabel(scheduledForIso ?? null)}
        </span>
        <form action={clearOutreachSchedule} style={inlineFormStyle}>
          {hidden}
          <SubmitButton label="Back to queue" variant="ghost" />
        </form>
        <form action={dismissOutreachFollowUp} style={inlineFormStyle}>
          {hidden}
          <SubmitButton label="Dismiss" variant="danger" />
        </form>
      </div>
    );
  }

  return (
    <div style={outreachFollowUpWrapStyle}>
      <form action={scheduleOutreachFollowUp} style={scheduleFormStyle}>
        {hidden}
        <label style={dateLabelStyle}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Remind on</span>
          <input
            type="date"
            name="scheduledDate"
            min={minDate}
            required
            style={dateInputStyle}
            aria-label="Schedule follow-up date"
          />
        </label>
        <SubmitButton label="Schedule for later" variant="primary" />
      </form>
      <form action={dismissOutreachFollowUp} style={inlineFormStyle}>
        {hidden}
        <SubmitButton label="Dismiss" variant="ghost" />
      </form>
    </div>
  );
}

const inlineFormStyle: React.CSSProperties = { display: "inline", margin: 0 };

const scheduleFormStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: 8,
  margin: 0,
};

const outreachFollowUpWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
  marginTop: 10,
};

const dateLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const dateInputStyle: CSSProperties = {
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: 13,
  fontFamily: "inherit",
};

const outreachSchedulePrimaryBtnStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const outreachScheduleGhostBtnStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const outreachScheduleDangerBtnStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #fecaca",
  background: "#fff",
  color: "#b91c1c",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const outreachScheduledPillStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#0369a1",
  background: "#e0f2fe",
  border: "1px solid #bae6fd",
  padding: "6px 10px",
  borderRadius: 999,
};
