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
  const s = str(v).toLowerCase();
  if (s.startsWith("won")) return "Won";
  if (s.startsWith("active")) return "Active";
  if (s.startsWith("lost")) return "Lost";
  return "Unknown";
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

  const rows: QuotationRow[] = [];
  for (const r of json) {
    // Skip empty
    const ref = str(r["QUOTATION REFERENCE NO"]);
    const customer = str(r["CUSTOMER"]);
    if (!ref && !customer) continue;

    rows.push({
      id: ref || `${customer}-${rows.length}`,
      no: r["No"] != null && r["No"] !== "" ? num(r["No"]) : null,
      quotationDate: excelDate(r["QUOTATION DATE"]),
      depCode: str(r["DEP CODE"]),
      reference: ref,
      customer,
      businessArea: str(r["Customer Bisnis Area"]),
      brand: str(r["BRAND"]),
      description: str(r["DESCRIPTION\n"] ?? r["DESCRIPTION"]),
      workType: str(r["WORK TYPE \n"] ?? r["WORK TYPE"]),
      idr: num(r["(IDR)"]),
      usd: num(r["(USD)"]),
      sgd: num(r["(SGD)"]),
      eur: num(r["(EUR)"]),
      sgdEst: num(r["SGD Est"]),
      margin: num(r["Margin"]),
      status: normStatus(r["QUOTATION STATUS "] ?? r["QUOTATION STATUS"]),
      probability: normProb(r["PROBABILITY"]),
      estPoDate: str(r["EST PO DATE"]),
      estPoMonth: resolveEstPoMonth(r["EST PO DATE"], year),
      poReceivedDate: excelDate(r["PO RECEIVED DATE"]),
      poNumber: str(r["PO NUMBER"]),
      actualIdr: num(r["(IDR)2"]),
      salesman: str(r["SALESMAN"]),
      remarks: str(r["REMARKS"]),
    });
  }

  return { rows, year, sheetName: yearSheet };
}
