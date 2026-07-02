export const idrFull = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function fmtIdr(n: number): string {
  return idrFull.format(Math.round(n));
}

export function fmtIdrCompact(n: number): string {
  if (!isFinite(n)) return "-";
  return "Rp " + compactFormatter.format(n);
}

export function fmtInt(n: number): string {
  return new Intl.NumberFormat("id-ID").format(Math.round(n));
}

export function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtMonth(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function keyToDate(k: string): Date {
  const [y, m] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}

export function monthFloorUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
