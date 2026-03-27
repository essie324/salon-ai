"use client";

import { useFormStatus } from "react-dom";
import { useMemo, type CSSProperties } from "react";
import {
  clearOutreachSchedule,
  dismissOutreachFollowUp,
  markOutreachReady,
  scheduleOutreachFollowUp,
  sendOutreachNow,
} from "@/app/dashboard/outreach-actions";
import { formatScheduledForLabel } from "@/app/lib/outreach/followUp";
import type { OutreachActionState } from "@/app/lib/outreach/queue";

function SubmitButton({
  label,
  variant,
}: {
  label: string;
  variant: "primary" | "ghost" | "danger" | "accent";
}) {
  const { pending } = useFormStatus();
  const style =
    variant === "primary"
      ? outreachSchedulePrimaryBtnStyle
      : variant === "danger"
        ? outreachScheduleDangerBtnStyle
        : variant === "accent"
          ? outreachScheduleAccentBtnStyle
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
  /** Current template preview — passed to send simulation as snapshot text */
  messagePreview: string;
  actionState?: OutreachActionState | null;
};

export function OutreachFollowUpControls(props: OutreachFollowUpControlsProps) {
  const {
    outreachKey,
    outreachType,
    clientId,
    appointmentId,
    mode,
    scheduledForIso,
    messagePreview,
    actionState,
  } = props;

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
      <input type="hidden" name="messagePreview" value={messagePreview} />
    </>
  );

  const isReady = actionState === "ready_to_send";

  if (mode === "scheduled") {
    return (
      <div style={outreachFollowUpWrapStyle}>
        <span style={outreachScheduledPillStyle}>
          Follow-up: {formatScheduledForLabel(scheduledForIso ?? null)}
        </span>
        <form action={markOutreachReady} style={inlineFormStyle}>
          {hidden}
          <SubmitButton label="Mark ready" variant="accent" />
        </form>
        <form action={sendOutreachNow} style={inlineFormStyle}>
          {hidden}
          <SubmitButton label="Send now" variant="primary" />
        </form>
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

  const scheduleForm = (
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
      <SubmitButton label="Schedule" variant="primary" />
    </form>
  );

  const markReadyForm = (
    <form action={markOutreachReady} style={inlineFormStyle}>
      {hidden}
      <SubmitButton label="Mark ready" variant="accent" />
    </form>
  );

  const sendNowForm = (
    <form action={sendOutreachNow} style={inlineFormStyle}>
      {hidden}
      <SubmitButton label="Send now" variant={isReady ? "primary" : "ghost"} />
    </form>
  );

  const dismissForm = (
    <form action={dismissOutreachFollowUp} style={inlineFormStyle}>
      {hidden}
      <SubmitButton label="Dismiss" variant="danger" />
    </form>
  );

  return (
    <div style={outreachFollowUpWrapStyle}>
      {isReady ? (
        <>
          <span style={outreachReadyPillStyle}>Ready to send</span>
          {sendNowForm}
          {scheduleForm}
          {dismissForm}
        </>
      ) : (
        <>
          {scheduleForm}
          {markReadyForm}
          {sendNowForm}
          {dismissForm}
        </>
      )}
    </div>
  );
}

const inlineFormStyle: CSSProperties = { display: "inline", margin: 0 };

const scheduleFormStyle: CSSProperties = {
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

const outreachScheduleAccentBtnStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #0284c7",
  background: "#e0f2fe",
  color: "#0369a1",
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

const outreachReadyPillStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#0c4a6e",
  background: "#bae6fd",
  border: "1px solid #38bdf8",
  padding: "6px 10px",
  borderRadius: 999,
};
