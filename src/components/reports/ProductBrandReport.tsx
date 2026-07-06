import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { QuotationRow } from "@/lib/parse-quotations";
import { fmtIdr, fmtIdrCompact, fmtInt, fmtPct } from "@/lib/format";
import { sumBy, winRate } from "@/lib/report-utils";
import { SectionCard } from "./shared/SectionCard";
import { ReportTable } from "./shared/ReportTable";

const tooltip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 },
};

function topBy(quotations: QuotationRow[], key: (r: QuotationRow) => string, wonOnly = true) {
  const g: Record<string, { name: string; count: number; value: number }> = {};
  for (const r of quotations) {
    if (wonOnly && r.status !== "Won") continue;
    const k = key(r) || "(none)";
    g[k] ||= { name: k, count: 0, value: 0 };
    g[k].count++;
    g[k].value += r.actualIdr || r.idr;
  }
  return Object.values(g).sort((a, b) => b.value - a.value).slice(0, 10);
}

export function ProductBrandReport({ quotations }: { quotations: QuotationRow[] }) {
  const topBrands = useMemo(() => topBy(quotations, (r) => r.brand), [quotations]);
  const topDescriptions = useMemo(() => topBy(quotations, (r) => r.description), [quotations]);

  const byWorkType = useMemo(() => {
    const g: Record<string, QuotationRow[]> = {};
    for (const r of quotations) {
      const k = r.workType || "(none)";
      (g[k] ||= []).push(r);
    }
    return Object.entries(g)
      .map(([name, rs]) => ({
        name,
        count: rs.length,
        won: rs.filter((r) => r.status === "Won").length,
        winRate: winRate(rs),
        value: sumBy(rs, (r) => r.idr),
      }))
      .sort((a, b) => b.value - a.value);
  }, [quotations]);

  return (
    <div className="space-y-3">
      <SectionCard title="Top 10 brands by Won value" subtitle="Successful revenue by brand">
        <ResponsiveContainer width="100%" height={Math.max(240, topBrands.length * 28)}>
          <BarChart data={topBrands.slice().reverse()} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => fmtIdrCompact(v)} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={150} />
            <Tooltip {...tooltip} formatter={(v: number) => fmtIdr(v)} />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Top 10 products / descriptions" subtitle="By Won value">
        <ReportTable
          rows={topDescriptions}
          csvFilename="top-products.csv"
          columns={[
            { key: "name", label: "Description" },
            { key: "count", label: "Deals", align: "right", render: (r) => fmtInt(r.count), csv: (r) => r.count },
            { key: "value", label: "Won (IDR)", align: "right", render: (r) => fmtIdrCompact(r.value), csv: (r) => r.value },
          ]}
        />
      </SectionCard>

      <SectionCard title="Win rate by work type" subtitle="Effectiveness across MRO / Project / etc.">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={byWorkType} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis yAxisId="l" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `${Math.round(v * 100)}%`} domain={[0, 1]} width={50} />
            <Tooltip {...tooltip} formatter={(v: number) => fmtPct(v, 0)} />
            <Bar yAxisId="l" dataKey="winRate" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3">
          <ReportTable
            rows={byWorkType}
            csvFilename="work-type.csv"
            columns={[
              { key: "name", label: "Work type" },
              { key: "count", label: "Quotes", align: "right", render: (r) => fmtInt(r.count), csv: (r) => r.count },
              { key: "won", label: "Won", align: "right", render: (r) => fmtInt(r.won), csv: (r) => r.won },
              { key: "winRate", label: "Win rate", align: "right", render: (r) => fmtPct(r.winRate, 0), csv: (r) => r.winRate },
              { key: "value", label: "Value (IDR)", align: "right", render: (r) => fmtIdrCompact(r.value), csv: (r) => r.value },
            ]}
          />
        </div>
      </SectionCard>
    </div>
  );
}
