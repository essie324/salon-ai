import Link from "next/link";

export default function ProfileSetupPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily: "Arial, sans-serif",
        background: "#f7f7f7",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          background: "#fff",
          border: "1px solid #e5e5e5",
          borderRadius: 18,
          padding: 28,
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 12 }}>We’re setting up your account</h1>

        <p style={{ color: "#555", lineHeight: 1.6 }}>
          Your login worked, but your salon profile is incomplete or missing.
          This usually resolves quickly after account creation.
        </p>

        <p style={{ color: "#555", lineHeight: 1.6 }}>
          If this keeps happening, you can sign out and try again, or have an
          admin verify that your profile and role were created correctly.
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          <Link
            href="/dashboard"
            style={{
              textDecoration: "none",
              padding: "12px 16px",
              borderRadius: 12,
              background: "#111",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            Retry Dashboard
          </Link>

          <Link
            href="/login"
            style={{
              textDecoration: "none",
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              color: "#111",
              fontWeight: 700,
            }}
          >
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}