import type { QuotationRow } from "./parse-quotations";
import type { EiRow } from "./parse-ei-report";

export interface LinkedEiRow extends EiRow {
  quotation?: QuotationRow;
}

function norm(s: string): string {
  return (s || "").trim().toUpperCase().replace(/\s+/g, " ");
}

export function linkEiToQuotations(ei: EiRow[], quotations: QuotationRow[]): LinkedEiRow[] {
  const byPo = new Map<string, QuotationRow>();
  const byRef = new Map<string, QuotationRow>();
  for (const q of quotations) {
    if (q.customerPo) byPo.set(norm(q.customerPo), q);
    if (q.reference) byRef.set(norm(q.reference), q);
  }

  return ei.map((r) => {
    let quotation: QuotationRow | undefined;
    if (r.customerPo) quotation = byPo.get(norm(r.customerPo));
    if (!quotation && r.externalDocNo) quotation = byRef.get(norm(r.externalDocNo));
    if (!quotation && r.invoiceRef) quotation = byRef.get(norm(r.invoiceRef));
    return quotation ? { ...r, quotation } : { ...r };
  });
}
