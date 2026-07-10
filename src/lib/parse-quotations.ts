import * as XLSX from "xlsx";

// Free-form status label preserved from the source file (title-cased).
// Common values are "Won", "Active", "Lost", but any distinct status
// found in the sheet (e.g. "Cancelled", "Pending") is kept as-is.
export type QuotationStatus = string;

export function isWon(s: string) {
  return s.trim().toLowerCase().startsWith("won");
}
export function isActive(s: string) {
  return s.trim().toLowerCase().startsWith("active");
}
export function isLost(s: string) {
  return s.trim().toLowerCase().startsWith("lost");
}

export interface QuotationRow {
  id: string;
  no: number | null;
  quotationDate: Date | null;
  depCode: string;
  reference: string;
  customer: string;
  businessArea: string;
  brand: string;
  description: string;
  workType: string;
  idr: number;
  usd: number;
  sgd: number;
  eur: number;
  sgdEst: number;
  margin: number;
  status: QuotationStatus;
  probability: number; // 0..1
  estPoDate: string; // raw text (Q1/Jan/etc or ISO)
  estPoMonth: Date | null; // resolved month
  poReceivedDate: Date | null;
  poNumber: string;
  actualIdr: number;
  salesman: string;
  remarks: string;
}

const QUARTER_TO_MONTH: Record<string, number> = { Q1: 1, Q2: 4, Q3: 7, Q4: 10 };
const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

function excelDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function resolveEstPoMonth(raw: unknown, year: number): Date | null {
  const d = excelDate(raw);
  if (d) return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  if (typeof raw === "string") {
    const s = raw.trim();
    if (/^Q[1-4]$/i.test(s)) {
      return new Date(Date.UTC(year, QUARTER_TO_MONTH[s.toUpperCase()] - 1, 1));
    }
    const key = s.slice(0, 4).toLowerCase().replace(/[^a-z]/g, "");
    if (MONTH_NAMES[key] !== undefined) {
      return new Date(Date.UTC(year, MONTH_NAMES[key], 1));
    }
  }
  return null;
}

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[, ]/g, ""));
  return isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function normStatus(v: unknown): QuotationStatus {
  const raw = str(v);
  if (!raw) return "Unknown";
  const lower = raw.toLowerCase();
  if (lower.startsWith("won")) return "Won";
  if (lower.startsWith("active")) return "Active";
  if (lower.startsWith("lost")) return "Lost";
  // Preserve any other status label (e.g. "Cancelled", "Pending", "On Hold")
  // with light title-casing so the UI shows a consistent form.
  return raw
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function normProb(v: unknown): number {
  const n = num(v);
  if (n > 1) return n / 100;
  return n;
}

export function parseQuotationsWorkbook(data: ArrayBuffer): {
  rows: QuotationRow[];
  year: number;
  sheetName: string;
} {
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  // Find sheet that looks like a year (e.g., "2026") or fallback to first non-Dashboard sheet
  const yearSheet =
    wb.SheetNames.find((n) => /^20\d{2}$/.test(n.trim())) ??
    wb.SheetNames.find((n) => !/dashboard|support/i.test(n)) ??
    wb.SheetNames[0];
  const year = /^20\d{2}$/.test(yearSheet.trim())
    ? parseInt(yearSheet.trim(), 10)
    : new Date().getFullYear();

  const ws = wb.Sheets[yearSheet];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: true,
  });

  // Build a case-insensitive, whitespace/newline-insensitive key lookup so
  // headers like "DESCRIPTION\n" or "WORK TYPE \n" match regardless of
  // trailing spaces or embedded line breaks in the Excel cell.
  const headerMap = new Map<string, string>();
  if (json.length > 0) {
    for (const key of Object.keys(json[0])) {
      const norm = key.trim().toLowerCase().replace(/\s+/g, " ");
      if (!headerMap.has(norm)) headerMap.set(norm, key);
    }
  }
  const pick = (...names: string[]): string => {
    for (const n of names) {
      const found = headerMap.get(n.trim().toLowerCase().replace(/\s+/g, " "));
      if (found) return found;
    }
    return names[0];
  };

  const H = {
    no: pick("No"),
    quotationDate: pick("QUOTATION DATE"),
    depCode: pick("DEP CODE"),
    reference: pick("QUOTATION REFERENCE NO"),
    customer: pick("CUSTOMER"),
    businessArea: pick("Customer Bisnis Area"),
    brand: pick("BRAND"),
    description: pick("DESCRIPTION", "DESCRIPTION\n"),
    workType: pick("WORK TYPE", "WORK TYPE \n", "WORK TYPE\n"),
    idr: pick("(IDR)"),
    usd: pick("(USD)"),
    sgd: pick("(SGD)"),
    eur: pick("(EUR)"),
    sgdEst: pick("SGD Est"),
    margin: pick("Margin"),
    status: pick("QUOTATION STATUS", "QUOTATION STATUS "),
    probability: pick("PROBABILITY"),
    estPoDate: pick("EST PO DATE"),
    poReceivedDate: pick("PO RECEIVED DATE"),
    poNumber: pick("PO NUMBER"),
    actualIdr: pick("(IDR)2", "(IDR) 2"),
    salesman: pick("SALESMAN"),
    remarks: pick("REMARKS"),
  };

  const rows: QuotationRow[] = [];
  for (const r of json) {
    // Skip empty
    const ref = str(r[H.reference]);
    const customer = str(r[H.customer]);
    if (!ref && !customer) continue;

    rows.push({
      id: ref || `${customer}-${rows.length}`,
      no: r[H.no] != null && r[H.no] !== "" ? num(r[H.no]) : null,
      quotationDate: excelDate(r[H.quotationDate]),
      depCode: str(r[H.depCode]),
      reference: ref,
      customer,
      businessArea: str(r[H.businessArea]),
      brand: str(r[H.brand]),
      description: str(r[H.description]),
      workType: str(r[H.workType]),
      idr: num(r[H.idr]),
      usd: num(r[H.usd]),
      sgd: num(r[H.sgd]),
      eur: num(r[H.eur]),
      sgdEst: num(r[H.sgdEst]),
      margin: num(r[H.margin]),
      status: normStatus(r[H.status]),
      probability: normProb(r[H.probability]),
      estPoDate: str(r[H.estPoDate]),
      estPoMonth: resolveEstPoMonth(r[H.estPoDate], year),
      poReceivedDate: excelDate(r[H.poReceivedDate]),
      poNumber: str(r[H.poNumber]),
      actualIdr: num(r[H.actualIdr]),
      salesman: str(r[H.salesman]),
      remarks: str(r[H.remarks]),
    });
  }

  return { rows, year, sheetName: yearSheet };
}
