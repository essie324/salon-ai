"use client";

import type { CSSProperties } from "react";
import { updateAppointmentStatus } from "@/app/actions/appointmentStatus";

const col: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  alignItems: "stretch",
};

export default function AppointmentActions({
  id,
  returnTo,
}: {
  id: string;
  /** Safe redirect after update (e.g. `/appointments` or `/appointments?stylist=…`). */
  returnTo: string;
}) {
  return (
    <div style={col}>
      <form action={updateAppointmentStatus} style={{ display: "block" }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="newStatus" value="completed" />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: "8px 10px",
            cursor: "pointer",
            fontWeight: 700,
            background: "#ebfff0",
            color: "#137333",
            width: "100%",
          }}
        >
          Complete
        </button>
      </form>

      <form action={updateAppointmentStatus} style={{ display: "block" }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="newStatus" value="cancelled" />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: "8px 10px",
            cursor: "pointer",
            fontWeight: 700,
            background: "#fff1f1",
            color: "#b42318",
            width: "100%",
          }}
        >
          Cancel
        </button>
      </form>

      <form action={updateAppointmentStatus} style={{ display: "block" }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="newStatus" value="no_show" />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: "8px 10px",
            cursor: "pointer",
            fontWeight: 700,
            background: "#f5f5f5",
            color: "#555",
            width: "100%",
          }}
        >
          No-show
        </button>
      </form>
    </div>
  );
}
