import { schedulerStatusStyle } from "@/app/lib/calendar/statusColors";

/** Appointments with no stylist_id use a neutral slate rail/fill. */
export const UNASSIGNED_APPOINTMENT_BLOCK_COLOR = "#cbd5e1";

/** Soft, professional palette when `calendar_color` is unset (distinct per stylist via hash). */
export const STYLIST_CALENDAR_FALLBACK_PALETTE = [
  "#6b8cae", // dusty blue
  "#8a9a8e", // sage
  "#b89a7a", // warm sand
  "#9b8bb8", // soft violet
  "#c17f7f", // muted rose
  "#7a9e9c", // sea glass
  "#a8907f", // taupe
  "#8a9bb5", // periwinkle
] as const;

export function parseCalendarColorForDb(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return normalizeHex(t);
}

function normalizeHex(input: string): string | null {
  const s = input.trim();
  if (!s.startsWith("#")) return null;
  const hex = s.slice(1);
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const [r, g, b] = hex.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

function hashStringToIndex(s: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % modulo;
}

/**
 * Resolves the accent hex for a stylist: DB `calendar_color` if valid, else a stable fallback from id.
 */
export function resolveStylistCalendarColor(
  stylistId: string,
  calendarColor: string | null | undefined,
): string {
  const normalized = calendarColor ? normalizeHex(calendarColor) : null;
  if (normalized) return normalized;
  const i = hashStringToIndex(stylistId, STYLIST_CALENDAR_FALLBACK_PALETTE.length);
  return STYLIST_CALENDAR_FALLBACK_PALETTE[i];
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const n = normalizeHex(hex) ?? "#94a3b8";
  const h = n.slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function mixHex(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  const r = Math.round(A.r + (B.r - A.r) * t);
  const g = Math.round(A.g + (B.g - A.g) * t);
  const bl = Math.round(A.b + (B.b - A.b) * t);
  const to = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(bl)}`;
}

export type AppointmentBlockChrome = {
  background: string;
  /** Stylist identity — left rail */
  borderLeft: string;
  /** Status cue — subtle top strip */
  borderTop: string;
  opacity?: number;
};

/**
 * Stylist color as soft fill + left rail; status as a thin top border so cancelled/completed/no-show stay readable.
 */
export function appointmentBlockChrome(
  stylistHex: string,
  status: string | null | undefined,
): AppointmentBlockChrome {
  const statusStyle = schedulerStatusStyle(status);
  const st = (status ?? "scheduled").toLowerCase();
  const softFill = mixHex("#ffffff", stylistHex, 0.14);

  if (st === "cancelled") {
    return {
      background: mixHex(softFill, "#f3f4f6", 0.45),
      borderLeft: `4px solid ${mixHex(stylistHex, "#9ca3af", 0.35)}`,
      borderTop: `2px solid ${statusStyle.border}`,
      opacity: 0.95,
    };
  }
  if (st === "no_show") {
    return {
      background: mixHex(softFill, "#fef2f2", 0.4),
      borderLeft: `4px solid ${mixHex(stylistHex, "#dc2626", 0.25)}`,
      borderTop: `2px solid ${statusStyle.border}`,
    };
  }
  if (st === "completed") {
    return {
      background: mixHex(softFill, "#ecfdf5", 0.35),
      borderLeft: `4px solid ${stylistHex}`,
      borderTop: `2px solid ${statusStyle.border}`,
    };
  }

  return {
    background: softFill,
    borderLeft: `4px solid ${stylistHex}`,
    borderTop: `2px solid ${statusStyle.border}`,
  };
}
