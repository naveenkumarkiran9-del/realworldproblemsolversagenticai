/** Money display. Missing or non-numeric values render as "—" instead of crashing the page. */
export const usd = (v: number | null | undefined, digits = 2) =>
  typeof v !== "number" || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const signedUsd = (v: number, digits = 2) =>
  Number.isFinite(v) ? `${v >= 0 ? "+" : "−"}${usd(Math.abs(v), digits)}` : "—";

export const pct = (v: number, digits = 2) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}%`;

export const compact = (v: number) =>
  v.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
