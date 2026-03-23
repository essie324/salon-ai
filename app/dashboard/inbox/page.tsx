import Link from "next/link";
import type { CSSProperties } from "react";
import { FEATURE_INBOX_AND_INTAKE_DB } from "@/app/lib/featureFlags";

/**
 * Inbox / AI conversation UI is gated behind `FEATURE_INBOX_AND_INTAKE_DB`.
 * Full implementation (intake_sessions, chat engine, booking from inbox) lives in git history
 * — re-enable the flag and restore the previous page when DB migrations are applied.
 */
export default function InboxPage() {
  return (
    <main style={pageStyle}>
      <Link href="/dashboard" style={backLinkStyle}>
        ← Back to Dashboard
      </Link>
      <h1 style={titleStyle}>Inbox</h1>
      <p style={subtitleStyle}>
        The inbox and AI receptionist conversation flow are temporarily unavailable until intake
        database tables are enabled.
      </p>
      <div style={cardStyle}>
        <p style={{ margin: 0, fontSize: 14, color: "#444", lineHeight: 1.5 }}>
          <strong>Status:</strong>{" "}
          {FEATURE_INBOX_AND_INTAKE_DB
            ? "Feature flag is on — if you still see this stub, restore the full inbox page from version control."
            : "Disabled (`FEATURE_INBOX_AND_INTAKE_DB` is false). Apply migrations, set the flag to true in `app/lib/featureFlags.ts`, and restore the full inbox route from git."}
        </p>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  padding: 40,
  maxWidth: 640,
  margin: "0 auto",
  fontFamily: "system-ui, sans-serif",
};

const backLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "#111",
  fontWeight: 700,
  fontSize: 14,
};

const titleStyle: CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 800,
  margin: "12px 0 8px 0",
};

const subtitleStyle: CSSProperties = {
  margin: "0 0 20px 0",
  color: "#666",
  fontSize: 14,
};

const cardStyle: CSSProperties = {
  background: "#f8f8f8",
  border: "1px solid #e5e5e5",
  borderRadius: 14,
  padding: 18,
};
