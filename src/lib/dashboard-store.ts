import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuotationRow, QuotationStatus } from "./parse-quotations";
import type { EiRow } from "./parse-ei-report";

export interface Filters {
  salesmen: string[];
  statuses: QuotationStatus[];
  probabilities: number[]; // exact values 0..1 (e.g. 0, 0.25, 0.5, 0.75, 0.9, 1)
  businessAreas: string[];
  brands: string[];
  workTypes: string[];
  dateFrom: string | null; // ISO date string
  dateTo: string | null;
}

export interface LinkedSource {
  fileName: string;
  lastModified: number;
  lastRefreshedAt: number;
  autoRefresh: boolean;
  linked: boolean;
}

export interface MergeSummary {
  added: number;
  updated: number;
  unchanged: number;
  total: number;
}

interface StoreState {
  quotations: QuotationRow[];
  quotationsMeta: { fileName: string; year: number; sheet: string } | null;
  ei: EiRow[];
  eiMeta: { fileName: string; sheet: string } | null;
  filters: Filters;
  salesTarget: number;
  sources: { quotations: LinkedSource | null; ei: LinkedSource | null };
  setQuotations: (rows: QuotationRow[], meta: { fileName: string; year: number; sheet: string }) => void;
  setEi: (rows: EiRow[], meta: { fileName: string; sheet: string }) => void;
  mergeQuotations: (rows: QuotationRow[], meta: { fileName: string; year: number; sheet: string }) => MergeSummary;
  mergeEi: (rows: EiRow[], meta: { fileName: string; sheet: string }) => MergeSummary;
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  setSalesTarget: (n: number) => void;
  setSource: (kind: "quotations" | "ei", source: LinkedSource | null) => void;
  clearAll: () => void;
}

export function quotationKey(r: QuotationRow): string {
  if (r.reference && r.reference.trim()) return `ref:${r.reference.trim().toUpperCase()}`;
  const d = r.quotationDate ? r.quotationDate.toISOString().slice(0, 10) : "nodate";
  return `q:${d}|${r.customer}|${r.idr}`;
}

export function eiKey(r: EiRow): string {
  if (r.invoiceRef && r.invoiceRef.trim()) return `inv:${r.invoiceRef.trim().toUpperCase()}`;
  if (r.jobNumber && r.jobNumber.trim()) return `job:${r.jobNumber.trim().toUpperCase()}`;
  // For rows without a unique invoice/job number, include the external doc no
  // and the source row id (which encodes the original sheet row index) so that
  // multiple line items sharing the same PO + date + customer do not collide.
  const d = r.orderDate ? r.orderDate.toISOString().slice(0, 10) : "nodate";
  const ext = r.externalDocNo ? r.externalDocNo.trim().toUpperCase() : "noext";
  return `ei:${r.customerPo}|${d}|${r.customer}|${ext}|${r.id}`;
}

function mergeRows<T>(existing: T[], incoming: T[], keyOf: (r: T) => string): { rows: T[]; summary: MergeSummary } {
  const map = new Map<string, T>();
  for (const r of existing) map.set(keyOf(r), r);
  let added = 0, updated = 0, unchanged = 0;
  for (const r of incoming) {
    const k = keyOf(r);
    if (!map.has(k)) {
      map.set(k, r);
      added++;
    } else {
      const prev = map.get(k)!;
      if (JSON.stringify(prev) === JSON.stringify(r)) unchanged++;
      else { map.set(k, r); updated++; }
    }
  }
  return { rows: Array.from(map.values()), summary: { added, updated, unchanged, total: map.size } };
}

const defaultFilters: Filters = {
  salesmen: [],
  statuses: [],
  probabilities: [],
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

// Detect if running inside Electron with IPC file access
function getElectronFs(): any | null {
  if (typeof window === "undefined") return null;
  return (window as any).electronFs ?? null;
}

// Debounce helper for file writes
let writeTimer: ReturnType<typeof setTimeout> | null = null;

export const useDashboardStore = create<StoreState>()(
  persist(
    (set, get) => ({
      quotations: [],
      quotationsMeta: null,
      ei: [],
      eiMeta: null,
      filters: defaultFilters,
      salesTarget: 0,
      sources: { quotations: null, ei: null },
      setQuotations: (rows, meta) => set({ quotations: rows, quotationsMeta: meta }),
      setEi: (rows, meta) => set({ ei: rows, eiMeta: meta }),
      mergeQuotations: (rows, meta) => {
        const { rows: merged, summary } = mergeRows(get().quotations, rows, quotationKey);
        set({ quotations: merged, quotationsMeta: meta });
        return summary;
      },
      mergeEi: (rows, meta) => {
        const { rows: merged, summary } = mergeRows(get().ei, rows, eiKey);
        set({ ei: merged, eiMeta: meta });
        return summary;
      },
      setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
      resetFilters: () => set({ filters: defaultFilters }),
      setSalesTarget: (n) => set({ salesTarget: n }),
      setSource: (kind, source) =>
        set((s) => ({ sources: { ...s.sources, [kind]: source } })),
      clearAll: () =>
        set({
          quotations: [],
          quotationsMeta: null,
          ei: [],
          eiMeta: null,
          filters: defaultFilters,
          sources: { quotations: null, ei: null },
        }),
    }),
    {
      name: "sales-dashboard-v1",
      storage: {
        getItem: (name) => {
          const efs = getElectronFs();
          if (efs) {
            // Electron: read from JSON file (sync wrapper around async IPC)
            // zustand persist expects a synchronous return, so we use a
            // lazy-init pattern: return null on first call, then hydrate
            // asynchronously via rehydrate().
            return null;
          }
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
          const efs = getElectronFs();
          if (efs) {
            // Debounce writes to avoid excessive I/O
            if (writeTimer) clearTimeout(writeTimer);
            writeTimer = setTimeout(() => {
              efs.writeJson(value).catch(() => {});
            }, 500);
            return;
          }
          if (typeof window === "undefined") return;
          try {
            window.localStorage.setItem(name, JSON.stringify(value));
          } catch {
            // quota exceeded — ignore
          }
        },
        removeItem: (name) => {
          const efs = getElectronFs();
          if (efs) {
            // Write empty state to clear
            efs.writeJson({ state: {}, version: 0 }).catch(() => {});
            return;
          }
          if (typeof window === "undefined") return;
          window.localStorage.removeItem(name);
        },
      },
    }
  )
);

// Async hydration for Electron: load from JSON file then set state
export async function hydrateFromElectron(): Promise<boolean> {
  const efs = getElectronFs();
  if (!efs) return false;
  try {
    const data = await efs.readJson();
    if (!data) return false;
    const revived = JSON.parse(JSON.stringify(data), dateReviver);
    if (revived?.state) {
      useDashboardStore.setState(revived.state);
    }
    return true;
  } catch {
    return false;
  }
}

export function filterQuotations(rows: QuotationRow[], f: Filters): QuotationRow[] {
  const from = f.dateFrom ? new Date(f.dateFrom).getTime() : null;
  const to = f.dateTo ? new Date(f.dateTo).getTime() + 86400000 : null;
  return rows.filter((r) => {
    if (f.salesmen.length && !f.salesmen.includes(r.salesman)) return false;
    if (f.statuses.length && !f.statuses.includes(r.status)) return false;
    if (f.probabilities.length && !f.probabilities.includes(r.probability)) return false;
    if (f.businessAreas.length && !f.businessAreas.includes(r.businessArea)) return false;
    if (f.brands.length && !f.brands.includes(r.brand)) return false;
    if (f.workTypes.length && !f.workTypes.includes(r.workType)) return false;
    if (from != null && (!r.quotationDate || r.quotationDate.getTime() < from)) return false;
    if (to != null && (!r.quotationDate || r.quotationDate.getTime() >= to)) return false;
    return true;
  });
}
