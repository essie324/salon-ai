"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabaseBrowser";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d4d4d8",
  fontSize: 14,
  boxSizing: "border-box",
};

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = searchParams.get("redirect") || "/dashboard";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || null,
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message || "Unable to sign up. Please try again.");
      return;
    }

    // If Supabase returns a session, treat as signed in; otherwise
    // rely on email confirmation then sign-in.
    if (data.session) {
      router.push(redirectTo);
      return;
    }

    router.push("/login");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f4f5",
        padding: 24,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#ffffff",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
          border: "1px solid #e5e7eb",
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0, marginBottom: 6 }}>Sign up</h1>
        <p style={{ margin: 0, marginBottom: 16, fontSize: 13, color: "#6b7280" }}>
          Create an account for your salon.
        </p>

        {error && (
          <div
            style={{
              marginBottom: 12,
              padding: "8px 10px",
              borderRadius: 10,
              background: "#fef2f2",
              color: "#b91c1c",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label
            htmlFor="full_name"
            style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}
          >
            Full name (optional)
          </label>
          <input
            id="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label
            htmlFor="email"
            style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="password"
            style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            style={inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: 999,
            border: "none",
            background: "#111827",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: 14,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.85 : 1,
          }}
        >
          {loading ? "Signing up..." : "Sign up"}
        </button>

        <p style={{ marginTop: 12, fontSize: 13, color: "#6b7280" }}>
          Already have an account? <a href="/login">Sign in</a>.
        </p>
      </form>
    </main>
  );
}
