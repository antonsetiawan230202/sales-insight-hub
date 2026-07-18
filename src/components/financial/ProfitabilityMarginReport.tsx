// @ts-nocheck
import { useMemo } from "react";
import type { EiRow } from "@/lib/parse-ei-report";
import type { QuotationRow } from "@/lib/parse-quotations";
import { fmtIdrCompact, fmtInt, fmtPct } from "@/lib/format";
import { SectionCard } from "@/components/reports/shared/SectionCard";
import { ReportTable } from "@/components/reports/shared/ReportTable";
import { idrOnly, groupSum, sumBy } from "@/lib/financial-utils";

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function ProfitabilityMarginReport({ ei, quotations: _quotations }: { ei: EiRow[]; quotations: QuotationRow[] }) {
  const rows = useMemo(() => idrOnly(ei), [ei]);

  const totals = useMemo(() => {
    const rev = sumBy(rows, (r) => r.revenueNet);
    const mgn = sumBy(rows, (r) => r.marginNet);
    return { rev, mgn, pct: rev > 0 ? mgn / rev : 0 };
  }, [rows]);

  const byCustomer = useMemo(() => {
    const map = new Map<string, { key: string; revenue: number; margin: number; orders: number }>();
    for (const r of rows) {
      const k = r.customer || "—";
      const cur = map.get(k) || { key: k, revenue: 0, margin: 0, orders: 0 };
      cur.revenue += r.revenueNet || 0; cur.margin += r.marginNet || 0; cur.orders++;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.margin - a.margin);
  }, [rows]);

  const byCategory = useMemo(() => groupSum(rows, (r) => r.categories || "—", (r) => r.marginNet), [rows]);
  const revByCategory = useMemo(() => groupSum(rows, (r) => r.categories || "—", (r) => r.revenueNet), [rows]);
  const catCombined = useMemo(() => revByCategory.map((r) => {
    const m = byCategory.find((x) => x.key === r.key)?.value || 0;
    return { key: r.key, revenue: r.value, margin: m, pct: r.value > 0 ? m / r.value : 0, orders: r.count };
  }), [revByCategory, byCategory]);

  return (
    <div className="space-y-3">
      <SectionCard title="Profitability overview" subtitle="Margin = Revenue net − Purchase (from EI report)">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Metric label="Total revenue (net)" value={fmtIdrCompact(totals.rev)} />
          <Metric label="Total margin" value={fmtIdrCompact(totals.mgn)} />
          <Metric label="Overall margin %" value={totals.rev > 0 ? fmtPct(totals.pct, 1) : "—"} />
          <Metric label="Rows with margin" value={fmtInt(rows.filter((r) => r.marginNet).length)} />
        </div>
        <p className="mt-3 rounded-md border border-muted bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          Note: The internal PT EXSRI / EXION ASIA profit-sharing split lives on a separate sheet not yet parsed by the app.
        </p>
      </SectionCard>

      <SectionCard title="Top customers by margin">
        <ReportTable
          rows={byCustomer.slice(0, 25)}
          csvFilename="customer-margin.csv"
          columns={[
            { key: "key", label: "Customer" },
            { key: "orders", label: "Orders", align: "right", render: (r) => fmtInt(r.orders) },
            { key: "revenue", label: "Revenue net", align: "right", render: (r) => fmtIdrCompact(r.revenue), csv: (r) => r.revenue },
            { key: "margin", label: "Margin", align: "right", render: (r) => fmtIdrCompact(r.margin), csv: (r) => r.margin },
            { key: "pct", label: "Margin %", align: "right", render: (r) => r.revenue > 0 ? fmtPct(r.margin / r.revenue, 1) : "—", csv: (r) => r.revenue > 0 ? r.margin / r.revenue : 0 },
          ]}
        />
      </SectionCard>

      <SectionCard title="Margin by category">
        <ReportTable
          rows={catCombined}
          csvFilename="category-margin.csv"
          columns={[
            { key: "key", label: "Category" },
            { key: "orders", label: "Orders", align: "right", render: (r) => fmtInt(r.orders) },
            { key: "revenue", label: "Revenue net", align: "right", render: (r) => fmtIdrCompact(r.revenue), csv: (r) => r.revenue },
            { key: "margin", label: "Margin", align: "right", render: (r) => fmtIdrCompact(r.margin), csv: (r) => r.margin },
            { key: "pct", label: "Margin %", align: "right", render: (r) => r.revenue > 0 ? fmtPct(r.pct, 1) : "—", csv: (r) => r.pct },
          ]}
        />
      </SectionCard>
    </div>
  );
}
