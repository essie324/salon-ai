import type { CSSProperties } from "react";
import { Suspense } from "react";
import SignupForm from "./SignupForm";

const mainShellStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f4f4f5",
  padding: 24,
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main style={mainShellStyle}>
          <p style={{ color: "#6b7280", fontSize: 14 }}>Loading…</p>
        </main>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
