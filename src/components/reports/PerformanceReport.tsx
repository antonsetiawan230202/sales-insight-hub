import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { QuotationRow } from "@/lib/parse-quotations";
import { fmtIdr, fmtIdrCompact, fmtInt, fmtPct } from "@/lib/format";
import { avgMargin, sumBy, winRate } from "@/lib/report-utils";
import { SectionCard } from "./shared/SectionCard";
import { ReportTable } from "./shared/ReportTable";

interface PerfRow {
  name: string;
  count: number;
  issued: number;
  wonValue: number;
  winRate: number;
  avgMargin: number;
}

function build(quotations: QuotationRow[], key: (r: QuotationRow) => string): PerfRow[] {
  const g: Record<string, QuotationRow[]> = {};
  for (const r of quotations) {
    const k = key(r) || "(none)";
    (g[k] ||= []).push(r);
  }
  return Object.entries(g)
    .map(([name, rs]) => ({
      name,
      count: rs.length,
      issued: sumBy(rs, (r) => r.idr),
      wonValue: sumBy(rs.filter((r) => r.status === "Won"), (r) => r.actualIdr || r.idr),
      winRate: winRate(rs),
      avgMargin: avgMargin(rs),
    }))
    .sort((a, b) => b.wonValue - a.wonValue || b.issued - a.issued);
}

function PerfTable({ rows, name, csv }: { rows: PerfRow[]; name: string; csv: string }) {
  return (
    <ReportTable
      rows={rows}
      csvFilename={csv}
      columns={[
        { key: "name", label: name },
        { key: "count", label: "Quotes", align: "right", render: (r) => fmtInt(r.count), csv: (r) => r.count },
        { key: "issued", label: "Issued (IDR)", align: "right", render: (r) => fmtIdrCompact(r.issued), csv: (r) => r.issued },
        { key: "wonValue", label: "Won (IDR)", align: "right", render: (r) => fmtIdrCompact(r.wonValue), csv: (r) => r.wonValue },
        { key: "winRate", label: "Win rate", align: "right", render: (r) => fmtPct(r.winRate, 0), csv: (r) => r.winRate },
        { key: "avgMargin", label: "Avg margin", align: "right", render: (r) => r.avgMargin ? fmtPct(r.avgMargin, 1) : "—", csv: (r) => r.avgMargin },
      ]}
    />
  );
}

const tooltip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 },
};

export function PerformanceReport({ quotations }: { quotations: QuotationRow[] }) {
  const bySalesman = useMemo(() => build(quotations, (r) => r.salesman), [quotations]);
  const byDept = useMemo(() => build(quotations, (r) => r.depCode), [quotations]);
  const chartData = useMemo(() => bySalesman.slice(0, 10).map((r) => ({ name: r.name, won: r.wonValue })), [bySalesman]);

  return (
    <div className="space-y-3">
      <SectionCard title="Won value by salesman" subtitle="Top 10">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => fmtIdrCompact(v)} width={70} />
            <Tooltip {...tooltip} formatter={(v: number) => fmtIdr(v)} />
            <Bar dataKey="won" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="By salesman" subtitle="Volume, value, win rate, margin">
        <PerfTable rows={bySalesman} name="Salesman" csv="performance-salesman.csv" />
      </SectionCard>

      <SectionCard title="By department" subtitle="Grouped by DEP CODE">
        <PerfTable rows={byDept} name="Department" csv="performance-department.csv" />
      </SectionCard>
    </div>
  );
}
