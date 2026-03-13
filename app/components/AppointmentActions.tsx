"use client";

export default function AppointmentActions({ id }: { id: string }) {
  async function updateStatus(status: string) {
    await fetch("/api/appointments/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, status }),
    });

    window.location.reload();
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "stretch",
      }}
    >
      <button
        onClick={() => updateStatus("completed")}
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: "8px 10px",
          cursor: "pointer",
          fontWeight: 700,
          background: "#ebfff0",
          color: "#137333",
        }}
      >
        Complete
      </button>

      <button
        onClick={() => updateStatus("cancelled")}
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: "8px 10px",
          cursor: "pointer",
          fontWeight: 700,
          background: "#fff1f1",
          color: "#b42318",
        }}
      >
        Cancel
      </button>

      <button
        onClick={() => updateStatus("no_show")}
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: "8px 10px",
          cursor: "pointer",
          fontWeight: 700,
          background: "#f5f5f5",
          color: "#555",
        }}
      >
        No-show
      </button>
    </div>
  );
}