// @ts-nocheck
import { useMemo } from "react";
import type { EiRow } from "@/lib/parse-ei-report";
import { fmtIdr, fmtIdrCompact, fmtInt } from "@/lib/format";
import { SectionCard } from "@/components/reports/shared/SectionCard";
import { ReportTable } from "@/components/reports/shared/ReportTable";
import { idrOnly, monthlyIntakeBilling, sumBy } from "@/lib/financial-utils";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const tt = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 } };

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function OrderIntakeBillingReport({ ei }: { ei: EiRow[] }) {
  const rows = useMemo(() => idrOnly(ei), [ei]);
  const monthly = useMemo(() => monthlyIntakeBilling(rows), [rows]);

  const stats = useMemo(() => {
    const intake = sumBy(rows, (r) => r.orderIntakeExcl);
    const billing = sumBy(rows, (r) => r.billedExcl);
    const b2b = billing > 0 ? intake / billing : 0;
    return { intake, billing, b2b, orders: rows.filter((r) => r.orderDate).length, invoices: rows.filter((r) => r.invoiceDate).length };
  }, [rows]);

  const withRatio = monthly.map((m) => ({ ...m, ratio: m.billing > 0 ? m.intake / m.billing : 0 }));

  return (
    <div className="space-y-3">
      <SectionCard title="Order Intake & Billing" subtitle="YTD top-line performance (IDR-only)">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Metric label="YTD Order Intake" value={fmtIdrCompact(stats.intake)} sub={`${fmtInt(stats.orders)} orders`} />
          <Metric label="YTD Billing" value={fmtIdrCompact(stats.billing)} sub={`${fmtInt(stats.invoices)} invoices`} />
          <Metric label="Book-to-Bill" value={stats.b2b > 0 ? `${stats.b2b.toFixed(2)}x` : "—"} sub={stats.b2b > 1 ? "Backlog growing" : stats.b2b > 0 ? "Backlog shrinking" : "No billing yet"} />
          <Metric label="Net backlog delta" value={fmtIdrCompact(stats.intake - stats.billing)} />
        </div>
      </SectionCard>

      <SectionCard title="Monthly intake vs billing" subtitle="Bars: intake & billing; Line: book-to-bill ratio">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={withRatio} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis yAxisId="v" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => fmtIdrCompact(v)} width={70} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={40} tickFormatter={(v) => `${v.toFixed(1)}x`} />
            <Tooltip {...tt} formatter={(v: number, n: string) => n === "B2B" ? `${v.toFixed(2)}x` : fmtIdr(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="v" dataKey="intake" name="Order Intake" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="v" dataKey="billing" name="Billing" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            <Line yAxisId="r" type="monotone" dataKey="ratio" name="B2B" stroke="var(--chart-5)" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Monthly breakdown">
        <ReportTable
          rows={withRatio}
          csvFilename="order-intake-billing.csv"
          columns={[
            { key: "label", label: "Month" },
            { key: "intake", label: "Intake", align: "right", render: (r) => fmtIdrCompact(r.intake), csv: (r) => r.intake },
            { key: "billing", label: "Billing", align: "right", render: (r) => fmtIdrCompact(r.billing), csv: (r) => r.billing },
            { key: "ratio", label: "B2B", align: "right", render: (r) => r.billing > 0 ? `${r.ratio.toFixed(2)}x` : "—", csv: (r) => r.ratio },
          ]}
        />
      </SectionCard>
    </div>
  );
}
