import * as XLSX from "xlsx";

export interface EiRow {
  id: string;
  customer: string;
  currency: string;
  orderIntakeExcl: number;
  orderIntakeIncl: number;
  orderDate: Date | null;
  edd: Date | null; // promised date to customer
  customerPo: string;
  qcReportingMonth: Date | null;
  billedExcl: number;
  billedIncl: number;
  invoiceDate: Date | null;
  invoiceRef: string;
  jobNumber: string;
  externalDocNo: string;
  vendorName: string;
  country: string;
  jobStatus: string;
  revenueNet: number;
  marginNet: number;
  categories: string;
}

function excelDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
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

function num(v: unknown): number {
  if (v == null || v === "" || v === "-") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[, ]/g, ""));
  return isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

export function parseEiWorkbook(data: ArrayBuffer): {
  rows: EiRow[];
  sheetName: string;
} {
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  // Prefer sheet name containing "Order Booking" and current-ish year.
  const preferred =
    wb.SheetNames.find((n) => /order booking.*billing/i.test(n)) ??
    wb.SheetNames.find((n) => /order booking/i.test(n)) ??
    wb.SheetNames[0];

  const ws = wb.Sheets[preferred];
  // Header row is row index 2 (0-based) in this workbook, but robust: find the row that has "Customer Name".
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
  let headerIdx = aoa.findIndex((r) => r.some((c) => typeof c === "string" && /customer name/i.test(c)));
  if (headerIdx < 0) headerIdx = 2;
  const headers = (aoa[headerIdx] as unknown[]).map((h) => String(h ?? "").replace(/\s+/g, " ").trim());

  const findCol = (regex: RegExp) => headers.findIndex((h) => regex.test(h));
  const cols = {
    customer: findCol(/customer name/i),
    currency: findCol(/^currency$/i),
    intakeExcl: findCol(/order intake.*excluding tax/i),
    intakeIncl: findCol(/order intake.*including/i),
    orderDate: findCol(/^order date$/i),
    edd: findCol(/edd/i),
    customerPo: findCol(/customer po/i),
    qcMonth: findCol(/qc reporting month/i),
    billedExcl: findCol(/billed orders.*excluding tax/i),
    billedIncl: findCol(/billed orders.*including/i),
    invoiceDate: findCol(/invoice date/i),
    invoiceRef: findCol(/invoice reference/i),
    jobNumber: findCol(/job\s*number/i),
    externalDoc: findCol(/external.*document/i),
    vendorName: findCol(/^vendor\s*name$/i) >= 0 ? findCol(/^vendor\s*name$/i) : findCol(/^vendor$/i),
    country: findCol(/^country$/i),
    jobStatus: findCol(/job status/i),
    revenueNet: findCol(/revenue.*net net/i),
    marginNet: findCol(/margin.*net net/i),
    categories: findCol(/categories/i),
  };

  const rows: EiRow[] = [];
  // Aggregate / summary row patterns that appear inline in the sheet and must be excluded
  // from real order data (they have huge values but no currency/PO/order date):
  //   "Backlog 31 May", "Grand total (IDR)", "Total", "YTD Order Booking", "Month (2026)", etc.
  const isAggregateLabel = (s: string) =>
    /^(backlog\b|grand\s*total\b|sub\s*total\b|^total\b|ytd\b|month\b|forecast\b|pivot\b|sum\b|opening\b|closing\b|net\b)/i.test(s.trim());

  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const r = aoa[i] as unknown[];
    if (!r) continue;
    const customer = str(r[cols.customer]);
    const po = str(r[cols.customerPo]);
    const orderDate = excelDate(r[cols.orderDate]);
    const invoiceDate = excelDate(r[cols.invoiceDate]);
    const currency = str(r[cols.currency]);

    // Skip empty rows
    if (!customer && !po && !orderDate && !invoiceDate) continue;
    // Skip aggregate/summary rows (e.g. "Backlog 31 May", "Grand total (IDR)")
    if (isAggregateLabel(customer)) continue;
    // A real order row must have either a currency OR an order/invoice date + a PO/customer.
    // Rows with no currency AND no dates are pivot leftovers.
    if (!currency && !orderDate && !invoiceDate) continue;


    rows.push({
      id: `${po || customer || "row"}-${i}`,
      customer,
      currency: str(r[cols.currency]),
      orderIntakeExcl: num(r[cols.intakeExcl]),
      orderIntakeIncl: num(r[cols.intakeIncl]),
      orderDate,
      edd: excelDate(r[cols.edd]),
      customerPo: po,
      qcReportingMonth: excelDate(r[cols.qcMonth]),
      billedExcl: num(r[cols.billedExcl]),
      billedIncl: num(r[cols.billedIncl]),
      invoiceDate: excelDate(r[cols.invoiceDate]),
      invoiceRef: str(r[cols.invoiceRef]),
      jobNumber: str(r[cols.jobNumber]),
      externalDocNo: str(r[cols.externalDoc]),
      vendorName: str(r[cols.vendorName]),
      country: str(r[cols.country]),
      jobStatus: str(r[cols.jobStatus]),
      revenueNet: num(r[cols.revenueNet]),
      marginNet: num(r[cols.marginNet]),
      categories: str(r[cols.categories]),
    });
  }

  return { rows, sheetName: preferred };
}
