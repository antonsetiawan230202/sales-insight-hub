// @ts-nocheck
import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { QuotationRow } from "@/lib/parse-quotations";
import { fmtIdr, fmtIdrCompact, fmtInt, fmtPct } from "@/lib/format";
import { sumBy, winRate } from "@/lib/report-utils";
import { SectionCard } from "./shared/SectionCard";
import { ReportTable } from "./shared/ReportTable";
import { Badge } from "@/components/ui/badge";

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const tooltip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 },
};

function topCustomers(quotations: QuotationRow[], status: string) {
  const g: Record<string, { name: string; value: number; count: number }> = {};
  for (const r of quotations) {
    if (r.status !== status || !r.customer) continue;
    g[r.customer] ||= { name: r.customer, value: 0, count: 0 };
    g[r.customer].value += status === "Won" ? r.actualIdr || r.idr : r.idr;
    g[r.customer].count++;
  }
  return Object.values(g).sort((a, b) => b.value - a.value).slice(0, 10);
}

export function CustomerMarketReport({ quotations }: { quotations: QuotationRow[] }) {
  const activeTop = useMemo(() => topCustomers(quotations, "Active"), [quotations]);
  const wonTop = useMemo(() => topCustomers(quotations, "Won"), [quotations]);

  const byArea = useMemo(() => {
    const g: Record<string, QuotationRow[]> = {};
    for (const r of quotations) {
      const k = r.businessArea || "(none)";
      (g[k] ||= []).push(r);
    }
    return Object.entries(g)
      .map(([name, rs]) => ({
        name,
        count: rs.length,
        value: sumBy(rs, (r) => r.idr),
        winRate: winRate(rs),
      }))
      .sort((a, b) => b.value - a.value);
  }, [quotations]);

  const repeat = useMemo(() => {
    const g: Record<string, QuotationRow[]> = {};
    for (const r of quotations) {
      if (!r.customer) continue;
      (g[r.customer] ||= []).push(r);
    }
    return Object.entries(g)
      .filter(([, rs]) => rs.length >= 2 || rs.some((r) => /repeat/i.test(r.remarks)))
      .map(([name, rs]) => ({
        name,
        quotes: rs.length,
        totalValue: sumBy(rs, (r) => r.idr),
        wonValue: sumBy(rs.filter((r) => r.status === "Won"), (r) => r.actualIdr || r.idr),
        flagged: rs.some((r) => /repeat/i.test(r.remarks)),
      }))
      .sort((a, b) => b.quotes - a.quotes || b.totalValue - a.totalValue);
  }, [quotations]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SectionCard title="Top 10 customers — Active" subtitle="Ongoing pipeline">
          <ReportTable
            rows={activeTop}
            columns={[
              { key: "name", label: "Customer" },
              { key: "count", label: "Quotes", align: "right", render: (r) => fmtInt(r.count), csv: (r) => r.count },
              { key: "value", label: "IDR", align: "right", render: (r) => fmtIdrCompact(r.value), csv: (r) => r.value },
            ]}
          />
        </SectionCard>
        <SectionCard title="Top 10 customers — Won" subtitle="Secured revenue">
          <ReportTable
            rows={wonTop}
            columns={[
              { key: "name", label: "Customer" },
              { key: "count", label: "Deals", align: "right", render: (r) => fmtInt(r.count), csv: (r) => r.count },
              { key: "value", label: "IDR", align: "right", render: (r) => fmtIdrCompact(r.value), csv: (r) => r.value },
            ]}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <SectionCard title="By business area" subtitle="Share of quoted value" className="lg:col-span-1">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byArea.slice(0, 8)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={90} paddingAngle={2}>
                {byArea.slice(0, 8).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip {...tooltip} formatter={(v: number) => fmtIdr(v)} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
        <SectionCard title="Business area detail" subtitle="Count, value, win rate" className="lg:col-span-2">
          <ReportTable
            rows={byArea}
            csvFilename="business-area.csv"
            columns={[
              { key: "name", label: "Business area" },
              { key: "count", label: "Quotes", align: "right", render: (r) => fmtInt(r.count), csv: (r) => r.count },
              { key: "value", label: "Value (IDR)", align: "right", render: (r) => fmtIdrCompact(r.value), csv: (r) => r.value },
              { key: "winRate", label: "Win rate", align: "right", render: (r) => fmtPct(r.winRate, 0), csv: (r) => r.winRate },
            ]}
          />
        </SectionCard>
      </div>

      <SectionCard title="Repeat customers" subtitle="≥ 2 quotes or flagged as repeat order">
        <ReportTable
          rows={repeat}
          csvFilename="repeat-customers.csv"
          columns={[
            {
              key: "name", label: "Customer",
              render: (r) => (
                <span className="inline-flex items-center gap-1.5">
                  {r.name}
                  {r.flagged && <Badge className="border-0 bg-emerald-500/15 text-[10px] text-emerald-700 dark:text-emerald-400">Repeat</Badge>}
                </span>
              ),
              csv: (r) => r.name,
            },
            { key: "quotes", label: "Quotes", align: "right", render: (r) => fmtInt(r.quotes), csv: (r) => r.quotes },
            { key: "totalValue", label: "Total (IDR)", align: "right", render: (r) => fmtIdrCompact(r.totalValue), csv: (r) => r.totalValue },
            { key: "wonValue", label: "Won (IDR)", align: "right", render: (r) => fmtIdrCompact(r.wonValue), csv: (r) => r.wonValue },
          ]}
        />
      </SectionCard>
    </div>
  );
}
