// @ts-nocheck
import { useMemo } from "react";
import type { EiRow } from "@/lib/parse-ei-report";
import { fmtIdr, fmtIdrCompact, fmtInt } from "@/lib/format";
import { SectionCard } from "@/components/reports/shared/SectionCard";
import { ReportTable } from "@/components/reports/shared/ReportTable";
import { idrOnly, agingBucket, daysBetween, sumBy } from "@/lib/financial-utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

export function ArAgingReport({ ei }: { ei: EiRow[] }) {
  const rows = useMemo(() => idrOnly(ei).filter((r) => r.invoiceDate && r.billedExcl > 0), [ei]);
  const now = new Date();

  const withAge = useMemo(() =>
    rows.map((r) => ({
      row: r,
      age: r.invoiceDate ? daysBetween(r.invoiceDate, now) : 0,
      bucket: r.invoiceDate ? agingBucket(daysBetween(r.invoiceDate, now)) : "—",
    })), [rows, now]
  );

  const buckets = useMemo(() => {
    const map = new Map<string, { key: string; value: number; count: number }>();
    const order = ["0–30 days", "31–60 days", "61–90 days", "90+ days"];
    for (const b of order) map.set(b, { key: b, value: 0, count: 0 });
    for (const w of withAge) {
      const b = map.get(w.bucket)!;
      b.value += w.row.billedIncl || w.row.billedExcl;
      b.count++;
    }
    return order.map((k) => map.get(k)!);
  }, [withAge]);

  const totalOutstanding = sumBy(withAge, (w) => w.row.billedIncl || w.row.billedExcl);
  const avgAge = withAge.length > 0 ? withAge.reduce((s, w) => s + w.age, 0) / withAge.length : 0;

  return (
    <div className="space-y-3">
      <SectionCard title="A/R & Invoice Aging" subtitle="Aging based on invoice date (approximate — no payment data)">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Metric label="Invoices" value={fmtInt(withAge.length)} />
          <Metric label="Total invoiced" value={fmtIdrCompact(totalOutstanding)} sub="Incl. tax" />
          <Metric label="Avg age" value={`${avgAge.toFixed(0)} days`} />
          <Metric label="Approx DSO" value={`${avgAge.toFixed(0)} days`} sub="Age proxy" />
        </div>
        <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
          Note: The source file does not include a payment-received date. Aging uses time since invoice date and does not reflect settled invoices.
        </p>
      </SectionCard>

      <SectionCard title="Aging buckets">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={buckets} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="key" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => fmtIdrCompact(v)} width={70} />
            <Tooltip {...tt} formatter={(v: number) => fmtIdr(v)} />
            <Bar dataKey="value" name="Value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Invoice list">
        <ReportTable
          rows={withAge.slice().sort((a, b) => b.age - a.age)}
          csvFilename="invoices-aging.csv"
          columns={[
            { key: "invoiceRef", label: "Invoice", render: (w) => w.row.invoiceRef || "—", csv: (w) => w.row.invoiceRef },
            { key: "customer", label: "Customer", render: (w) => w.row.customer, csv: (w) => w.row.customer },
            { key: "invoiceDate", label: "Date", render: (w) => w.row.invoiceDate?.toISOString().slice(0, 10) || "—", csv: (w) => w.row.invoiceDate?.toISOString().slice(0, 10) || "" },
            { key: "age", label: "Age (d)", align: "right", render: (w) => fmtInt(w.age), csv: (w) => w.age },
            { key: "bucket", label: "Bucket", render: (w) => w.bucket, csv: (w) => w.bucket },
            { key: "excl", label: "Net", align: "right", render: (w) => fmtIdrCompact(w.row.billedExcl), csv: (w) => w.row.billedExcl },
            { key: "incl", label: "Gross", align: "right", render: (w) => fmtIdrCompact(w.row.billedIncl), csv: (w) => w.row.billedIncl },
          ]}
        />
      </SectionCard>
    </div>
  );
}
