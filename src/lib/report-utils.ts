import type { QuotationRow } from "./parse-quotations";

export function sumBy<T>(rows: T[], fn: (r: T) => number): number {
  let s = 0;
  for (const r of rows) s += fn(r) || 0;
  return s;
}

export function groupBy<T, K extends string>(
  rows: T[],
  key: (r: T) => K
): Record<K, T[]> {
  const g = {} as Record<K, T[]>;
  for (const r of rows) {
    const k = key(r);
    (g[k] ||= []).push(r);
  }
  return g;
}

export function winRate(rows: QuotationRow[]): number {
  const won = rows.filter((r) => r.status === "Won").length;
  const lost = rows.filter((r) => r.status === "Lost").length;
  return won + lost > 0 ? won / (won + lost) : 0;
}

export function avgMargin(rows: QuotationRow[]): number {
  const won = rows.filter((r) => r.status === "Won" && r.margin);
  if (!won.length) return 0;
  return sumBy(won, (r) => (r.margin > 1 ? r.margin / 100 : r.margin)) / won.length;
}

export function bucketProbability(p: number): string {
  if (p < 0.25) return "0–25%";
  if (p < 0.5) return "25–50%";
  if (p < 0.75) return "50–75%";
  return "75–100%";
}

export function bucketAging(days: number): string {
  if (days < 30) return "< 30 days";
  if (days < 60) return "30–60 days";
  if (days < 90) return "60–90 days";
  return "90+ days";
}

export function quarterOf(d: Date | null): string {
  if (!d) return "Unknown";
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${q} ${d.getUTCFullYear()}`;
}

const LOSS_KEYWORDS: [RegExp, string][] = [
  [/no\s*budget/i, "No budget"],
  [/budget/i, "Budgetary"],
  [/obsolete/i, "Obsolete item"],
  [/price|expensive|cheaper/i, "Price"],
  [/delivery|lead\s*time/i, "Delivery / lead time"],
  [/spec|specification/i, "Spec mismatch"],
  [/cancel/i, "Cancelled"],
  [/lost\s*to/i, "Lost to competitor"],
];

export function parseLossReason(remarks: string): string {
  if (!remarks) return "Unknown";
  for (const [re, label] of LOSS_KEYWORDS) {
    if (re.test(remarks)) return label;
  }
  return "Other";
}

export function parseCompetitor(remarks: string): string | null {
  if (!remarks) return null;
  const m = remarks.match(/lost\s*to\s*[:\-]?\s*([A-Za-z0-9&\.\- ]{2,40})/i);
  if (!m) return null;
  return m[1]
    .replace(/[\.,;].*$/, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ");
}

export function exportCsv(
  filename: string,
  header: string[],
  rows: (string | number)[][]
): void {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.map(esc).join(",")];
  for (const r of rows) lines.push(r.map(esc).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
