import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuotationRow, QuotationStatus } from "./parse-quotations";
import type { EiRow } from "./parse-ei-report";

export interface Filters {
  salesmen: string[];
  statuses: QuotationStatus[];
  probMin: number; // 0..1
  probMax: number; // 0..1
  businessAreas: string[];
  brands: string[];
  workTypes: string[];
  dateFrom: string | null; // ISO date string
  dateTo: string | null;
}

interface StoreState {
  quotations: QuotationRow[];
  quotationsMeta: { fileName: string; year: number; sheet: string } | null;
  ei: EiRow[];
  eiMeta: { fileName: string; sheet: string } | null;
  filters: Filters;
  setQuotations: (rows: QuotationRow[], meta: { fileName: string; year: number; sheet: string }) => void;
  setEi: (rows: EiRow[], meta: { fileName: string; sheet: string }) => void;
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  clearAll: () => void;
}

const defaultFilters: Filters = {
  salesmen: [],
  statuses: [],
  probMin: 0,
  probMax: 1,
  businessAreas: [],
  brands: [],
  workTypes: [],
  dateFrom: null,
  dateTo: null,
};

// Custom storage that revives Date objects
const dateReviver = (_key: string, value: unknown) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return value;
};

export const useDashboardStore = create<StoreState>()(
  persist(
    (set) => ({
      quotations: [],
      quotationsMeta: null,
      ei: [],
      eiMeta: null,
      filters: defaultFilters,
      setQuotations: (rows, meta) => set({ quotations: rows, quotationsMeta: meta }),
      setEi: (rows, meta) => set({ ei: rows, eiMeta: meta }),
      setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
      resetFilters: () => set({ filters: defaultFilters }),
      clearAll: () =>
        set({
          quotations: [],
          quotationsMeta: null,
          ei: [],
          eiMeta: null,
          filters: defaultFilters,
        }),
    }),
    {
      name: "sales-dashboard-v1",
      storage: {
        getItem: (name) => {
          if (typeof window === "undefined") return null;
          const s = window.localStorage.getItem(name);
          if (!s) return null;
          try {
            return JSON.parse(s, dateReviver);
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          if (typeof window === "undefined") return;
          try {
            window.localStorage.setItem(name, JSON.stringify(value));
          } catch {
            // quota exceeded — ignore
          }
        },
        removeItem: (name) => {
          if (typeof window === "undefined") return;
          window.localStorage.removeItem(name);
        },
      },
    }
  )
);

export function filterQuotations(rows: QuotationRow[], f: Filters): QuotationRow[] {
  const from = f.dateFrom ? new Date(f.dateFrom).getTime() : null;
  const to = f.dateTo ? new Date(f.dateTo).getTime() + 86400000 : null;
  return rows.filter((r) => {
    if (f.salesmen.length && !f.salesmen.includes(r.salesman)) return false;
    if (f.statuses.length && !f.statuses.includes(r.status)) return false;
    if (r.probability < f.probMin || r.probability > f.probMax) return false;
    if (f.businessAreas.length && !f.businessAreas.includes(r.businessArea)) return false;
    if (f.brands.length && !f.brands.includes(r.brand)) return false;
    if (f.workTypes.length && !f.workTypes.includes(r.workType)) return false;
    if (from != null && (!r.quotationDate || r.quotationDate.getTime() < from)) return false;
    if (to != null && (!r.quotationDate || r.quotationDate.getTime() >= to)) return false;
    return true;
  });
}
