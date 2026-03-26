"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

type Props = {
  message: string;
};

export function CopyMessageButton({ message }: Props) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = message;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        return;
      }
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }, [message]);

  return (
    <button type="button" onClick={onClick} style={copied ? buttonStyleCopied : buttonStyle}>
      {copied ? "Copied" : "Copy Message"}
    </button>
  );
}

const buttonStyle: CSSProperties = {
  cursor: "pointer",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 600,
};

const buttonStyleCopied: CSSProperties = {
  ...buttonStyle,
  border: "1px solid #86efac",
  background: "#f0fdf4",
  color: "#166534",
};
