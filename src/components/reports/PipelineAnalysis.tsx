import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { QuotationRow } from "@/lib/parse-quotations";
import { fmtIdr, fmtIdrCompact, fmtInt, fmtPct } from "@/lib/format";
import { bucketAging, bucketProbability, quarterOf, sumBy } from "@/lib/report-utils";
import { SectionCard } from "./shared/SectionCard";
import { ReportTable } from "./shared/ReportTable";

const tooltip = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--popover-foreground)",
    fontSize: 12,
  },
};

export function PipelineAnalysis({ quotations }: { quotations: QuotationRow[] }) {
  const byStatus = useMemo(() => {
    const g: Record<string, { status: string; count: number; value: number }> = {};
    for (const r of quotations) {
      g[r.status] ||= { status: r.status, count: 0, value: 0 };
      g[r.status].count++;
      g[r.status].value += r.idr;
    }
    return Object.values(g).sort((a, b) => b.value - a.value);
  }, [quotations]);

  const byProb = useMemo(() => {
    const buckets = ["0–25%", "25–50%", "50–75%", "75–100%"].map((name) => ({
      name, raw: 0, weighted: 0, count: 0,
    }));
    for (const r of quotations) {
      if (r.status !== "Active") continue;
      const b = buckets.find((x) => x.name === bucketProbability(r.probability))!;
      b.raw += r.idr;
      b.weighted += r.idr * r.probability;
      b.count++;
    }
    return buckets;
  }, [quotations]);

  const byQuarter = useMemo(() => {
    const g: Record<string, { name: string; value: number; count: number }> = {};
    for (const r of quotations) {
      if (r.status !== "Active") continue;
      const q = quarterOf(r.estPoMonth);
      g[q] ||= { name: q, value: 0, count: 0 };
      g[q].value += r.idr;
      g[q].count++;
    }
    return Object.values(g).sort((a, b) => a.name.localeCompare(b.name));
  }, [quotations]);

  const aging = useMemo(() => {
    const now = Date.now();
    const buckets = ["< 30 days", "30–60 days", "60–90 days", "90+ days"].map((name) => ({
      name, value: 0, count: 0,
    }));
    const stale: QuotationRow[] = [];
    for (const r of quotations) {
      if (r.status !== "Active" || !r.quotationDate) continue;
      const days = Math.floor((now - r.quotationDate.getTime()) / 86400000);
      const b = buckets.find((x) => x.name === bucketAging(days))!;
      b.value += r.idr;
      b.count++;
      if (days >= 90) stale.push(r);
    }
    return { buckets, stale: stale.sort((a, b) => b.idr - a.idr) };
  }, [quotations]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SectionCard title="Opportunity by status" subtitle="Count and IDR value">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byStatus} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="status" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => fmtIdrCompact(v)} width={70} />
              <Tooltip {...tooltip} formatter={(v: number) => fmtIdr(v)} />
              <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <ReportTable
            rows={byStatus}
            columns={[
              { key: "status", label: "Status" },
              { key: "count", label: "Count", align: "right", render: (r) => fmtInt(r.count), csv: (r) => r.count },
              { key: "value", label: "Value (IDR)", align: "right", render: (r) => fmtIdrCompact(r.value), csv: (r) => r.value },
            ]}
            maxHeight={200}
          />
        </SectionCard>

        <SectionCard title="Opportunity by probability" subtitle="Raw vs weighted (Active)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byProb} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => fmtIdrCompact(v)} width={70} />
              <Tooltip {...tooltip} formatter={(v: number) => fmtIdr(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="raw" name="Raw" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="weighted" name="Weighted" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      <SectionCard title="Opportunity by quarter" subtitle="Active pipeline by Est PO quarter">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={byQuarter} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => fmtIdrCompact(v)} width={70} />
            <Tooltip {...tooltip} formatter={(v: number) => fmtIdr(v)} />
            <Bar dataKey="value" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Aging analysis" subtitle="How long active quotes have been open">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {aging.buckets.map((b) => (
            <div key={b.name} className="rounded-lg border bg-background p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{b.name}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{fmtIdrCompact(b.value)}</p>
              <p className="text-[11px] text-muted-foreground">{b.count} quotes</p>
            </div>
          ))}
        </div>
        {aging.stale.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium text-red-600 dark:text-red-400">
              Stale (90+ days) — {aging.stale.length} quotes, {fmtIdrCompact(sumBy(aging.stale, (r) => r.idr))}
            </p>
            <ReportTable
              rows={aging.stale.slice(0, 20)}
              csvFilename="stale-quotes.csv"
              columns={[
                { key: "customer", label: "Customer" },
                { key: "salesman", label: "Salesman" },
                { key: "quotationDate", label: "Quoted", render: (r) => r.quotationDate?.toISOString().slice(0, 10) ?? "—", csv: (r) => r.quotationDate?.toISOString().slice(0, 10) ?? "" },
                { key: "probability", label: "Prob.", align: "right", render: (r) => fmtPct(r.probability, 0), csv: (r) => r.probability },
                { key: "idr", label: "IDR", align: "right", render: (r) => fmtIdrCompact(r.idr), csv: (r) => r.idr },
              ]}
              maxHeight={280}
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
