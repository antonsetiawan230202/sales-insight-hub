// @ts-nocheck
import { useMemo, useState } from "react";
import type { EiRow } from "@/lib/parse-ei-report";
import { fmtIdr, fmtIdrCompact } from "@/lib/format";
import { SectionCard } from "@/components/reports/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { idrOnly, monthlyIntakeBilling, groupSum, topN } from "@/lib/financial-utils";
import { ComposedChart, Line, Bar, BarChart, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const tt = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 } };
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function classify(status: string): "Open" | "Closed" {
  return /close|complete|invoiced|billed|done/i.test(status || "") ? "Closed" : "Open";
}

export function FinancialTrendReport({ ei }: { ei: EiRow[] }) {
  const [gran, setGran] = useState<"M" | "Q">("M");
  const rows = useMemo(() => idrOnly(ei), [ei]);

  const monthly = useMemo(() => monthlyIntakeBilling(rows), [rows]);

  const grouped = useMemo(() => {
    if (gran === "M") {
      let running = 0;
      return monthly.map((m) => {
        running += (m.intake - m.billing);
        return { label: m.label, intake: m.intake, billing: m.billing, backlog: running };
      });
    }
    const map = new Map<string, { label: string; intake: number; billing: number; date: Date }>();
    for (const m of monthly) {
      const q = Math.floor(m.date.getUTCMonth() / 3) + 1;
      const key = `${m.date.getUTCFullYear()}-Q${q}`;
      let b = map.get(key);
      if (!b) { b = { label: `Q${q} ${m.date.getUTCFullYear()}`, intake: 0, billing: 0, date: m.date }; map.set(key, b); }
      b.intake += m.intake; b.billing += m.billing;
    }
    const list = Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    let running = 0;
    return list.map((m) => { running += (m.intake - m.billing); return { label: m.label, intake: m.intake, billing: m.billing, backlog: running }; });
  }, [monthly, gran]);

  const openClosed = useMemo(() => groupSum(rows, (r) => classify(r.jobStatus), (r) => r.orderIntakeExcl), [rows]);
  const topCustomers = useMemo(() => topN(groupSum(rows, (r) => r.customer || "—", (r) => r.billedExcl), (r) => r.value, 10), [rows]);

  return (
    <div className="space-y-3">
      <SectionCard
        title="Intake / Billing / Backlog"
        subtitle="Trend over time"
        right={
          <div className="flex overflow-hidden rounded-md border">
            <Button size="sm" variant={gran === "M" ? "default" : "ghost"} className="h-7 rounded-none px-2 text-xs" onClick={() => setGran("M")}>Monthly</Button>
            <Button size="sm" variant={gran === "Q" ? "default" : "ghost"} className="h-7 rounded-none px-2 text-xs" onClick={() => setGran("Q")}>Quarterly</Button>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={grouped} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => fmtIdrCompact(v)} width={70} />
            <Tooltip {...tt} formatter={(v: number) => fmtIdr(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="intake" name="Order Intake" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="billing" name="Billing" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="backlog" name="Backlog" stroke="var(--chart-5)" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </SectionCard>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SectionCard title="Open vs Closed jobs (by value)">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={openClosed} dataKey="value" nameKey="key" outerRadius={90} label={(e: any) => e.key}>
                {openClosed.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...tt} formatter={(v: number) => fmtIdr(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Top 10 customers by revenue">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topCustomers} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => fmtIdrCompact(v)} />
              <YAxis type="category" dataKey="key" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} width={140} />
              <Tooltip {...tt} formatter={(v: number) => fmtIdr(v)} />
              <Bar dataKey="value" name="Revenue" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
    </div>
  );
}
