"use client";

import type React from "react";
import {
  canConfirm,
  canCheckIn,
  canComplete,
  canCancel,
  canMarkNoShow,
} from "@/app/lib/appointmentStatus";
import { updateAppointmentStatus } from "@/app/actions/appointmentStatus";
import { archiveAppointment } from "@/app/actions/archiveAppointment";

type Props = {
  id: string;
  status: string;
  isArchived: boolean;
  primaryButtonStyle: React.CSSProperties;
  actionButtonBase: React.CSSProperties;
  actionButtonStyleConfirm: React.CSSProperties;
  actionButtonStyleCheckIn: React.CSSProperties;
  actionButtonStyleComplete: React.CSSProperties;
  actionButtonStyleCancel: React.CSSProperties;
  actionButtonStyleNoShow: React.CSSProperties;
  cancelNoteInputStyle: React.CSSProperties;
};

export function StatusActions({
  id,
  status,
  isArchived,
  primaryButtonStyle,
  actionButtonBase,
  actionButtonStyleConfirm,
  actionButtonStyleCheckIn,
  actionButtonStyleComplete,
  actionButtonStyleCancel,
  actionButtonStyleNoShow,
  cancelNoteInputStyle,
}: Props) {
  const onConfirmCancel = (e: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm("Cancel this appointment? This will keep it in history with a cancelled status.")) {
      e.preventDefault();
    }
  };

  const onConfirmNoShow = (e: React.FormEvent<HTMLFormElement>) => {
    if (
      !window.confirm(
        "Mark this appointment as a no-show? This will update the client's no-show history."
      )
    ) {
      e.preventDefault();
    }
  };

  return (
    <>
      <a
        href={`/dashboard/appointments/${id}/edit`}
        style={primaryButtonStyle}
      >
        Edit Appointment
      </a>

      {canConfirm(status) && (
        <form action={updateAppointmentStatus} style={{ display: "inline" }}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="newStatus" value="confirmed" />
          <button
            type="submit"
            style={actionButtonStyleConfirm}
            aria-label="Confirm appointment"
          >
            Confirm
          </button>
        </form>
      )}

      {canCheckIn(status) && (
        <form action={updateAppointmentStatus} style={{ display: "inline" }}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="newStatus" value="checked_in" />
          <button
            type="submit"
            style={actionButtonStyleCheckIn}
            aria-label="Check in client"
          >
            Check In
          </button>
        </form>
      )}

      {canComplete(status) && (
        <form action={updateAppointmentStatus} style={{ display: "inline" }}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="newStatus" value="completed" />
          <button
            type="submit"
            style={actionButtonStyleComplete}
            aria-label="Mark as completed"
          >
            Complete
          </button>
        </form>
      )}

      {canCancel(status) && (
        <form
          action={updateAppointmentStatus}
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
          }}
          onSubmit={onConfirmCancel}
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="newStatus" value="cancelled" />
          <input
            type="text"
            name="cancellation_note"
            placeholder="Reason (optional)"
            style={cancelNoteInputStyle}
            aria-label="Cancellation reason (optional)"
          />
          <button
            type="submit"
            style={actionButtonStyleCancel}
            aria-label="Cancel appointment"
          >
            Cancel
          </button>
        </form>
      )}

      {canMarkNoShow(status) && (
        <form
          action={updateAppointmentStatus}
          style={{ display: "inline" }}
          onSubmit={onConfirmNoShow}
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="newStatus" value="no_show" />
          <button
            type="submit"
            style={actionButtonStyleNoShow}
            aria-label="Mark as no-show"
          >
            Mark No Show
          </button>
        </form>
      )}

      {!isArchived && (
        <form action={archiveAppointment} style={{ display: "inline" }}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            style={{
              ...actionButtonBase,
              borderColor: "#d4d4d4",
              background: "#f9fafb",
              color: "#374151",
            }}
            aria-label="Archive appointment"
          >
            Archive
          </button>
        </form>
      )}
    </>
  );
}

