// @ts-nocheck
import { useMemo } from "react";
import type { EiRow } from "@/lib/parse-ei-report";
import { fmtIdr, fmtIdrCompact, fmtInt, fmtMonth, monthFloorUtc, monthKey } from "@/lib/format";
import { SectionCard } from "@/components/reports/shared/SectionCard";
import { ReportTable } from "@/components/reports/shared/ReportTable";
import { idrOnly, groupSum, topN } from "@/lib/financial-utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const tt = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 } };

export function CustomerSegmentRevenueReport({ ei }: { ei: EiRow[] }) {
  const rows = useMemo(() => idrOnly(ei), [ei]);

  const byCustomer = useMemo(() => groupSum(rows, (r) => r.customer || "—", (r) => r.billedExcl), [rows]);
  const byCountry = useMemo(() => groupSum(rows, (r) => r.country || "—", (r) => r.billedExcl), [rows]);
  const byCategory = useMemo(() => groupSum(rows, (r) => r.categories || "—", (r) => r.billedExcl), [rows]);

  const top10 = topN(byCustomer, (r) => r.value, 10);

  // Customer × month pivot
  const pivot = useMemo(() => {
    const custMap = new Map<string, Record<string, number> & { customer: string; total: number }>();
    const monthSet = new Set<string>();
    for (const r of rows) {
      if (!r.invoiceDate) continue;
      const mk = monthKey(monthFloorUtc(r.invoiceDate));
      monthSet.add(mk);
      const cust = r.customer || "—";
      let row = custMap.get(cust);
      if (!row) { row = { customer: cust, total: 0 } as any; custMap.set(cust, row); }
      row[mk] = (row[mk] || 0) + (r.billedExcl || 0);
      row.total += r.billedExcl || 0;
    }
    const months = Array.from(monthSet).sort();
    const list = Array.from(custMap.values()).sort((a, b) => b.total - a.total).slice(0, 15);
    return { months, list };
  }, [rows]);

  return (
    <div className="space-y-3">
      <SectionCard title="Top 10 customers by billed revenue">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={top10} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => fmtIdrCompact(v)} />
            <YAxis type="category" dataKey="key" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={160} />
            <Tooltip {...tt} formatter={(v: number) => fmtIdr(v)} />
            <Bar dataKey="value" name="Revenue" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SectionCard title="Revenue by country">
          <ReportTable
            rows={byCountry}
            csvFilename="revenue-country.csv"
            columns={[
              { key: "key", label: "Country" },
              { key: "count", label: "Orders", align: "right", render: (r) => fmtInt(r.count) },
              { key: "value", label: "Billed", align: "right", render: (r) => fmtIdrCompact(r.value), csv: (r) => r.value },
            ]}
          />
        </SectionCard>
        <SectionCard title="Revenue by category">
          <ReportTable
            rows={byCategory}
            csvFilename="revenue-category.csv"
            columns={[
              { key: "key", label: "Category" },
              { key: "count", label: "Orders", align: "right", render: (r) => fmtInt(r.count) },
              { key: "value", label: "Billed", align: "right", render: (r) => fmtIdrCompact(r.value), csv: (r) => r.value },
            ]}
          />
        </SectionCard>
      </div>

      <SectionCard title="Customer × month pivot" subtitle="Top 15 customers by total billed">
        <div className="overflow-auto rounded-lg border bg-background" style={{ maxHeight: 480 }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Customer</th>
                {pivot.months.map((m) => (
                  <th key={m} className="px-3 py-2 text-right font-medium whitespace-nowrap">{fmtMonth(new Date(m + "-01T00:00:00Z"))}</th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {pivot.list.map((r) => (
                <tr key={r.customer} className="border-b last:border-b-0 hover:bg-muted/40">
                  <td className="px-3 py-2">{r.customer}</td>
                  {pivot.months.map((m) => (
                    <td key={m} className="px-3 py-2 text-right tabular-nums">{r[m] ? fmtIdrCompact(r[m]) : "—"}</td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtIdrCompact(r.total)}</td>
                </tr>
              ))}
              {pivot.list.length === 0 && (
                <tr><td colSpan={pivot.months.length + 2} className="px-3 py-8 text-center text-muted-foreground">No billed data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
