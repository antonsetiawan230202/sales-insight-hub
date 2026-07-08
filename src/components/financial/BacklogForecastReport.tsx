// @ts-nocheck
import { useMemo } from "react";
import type { EiRow } from "@/lib/parse-ei-report";
import { fmtIdr, fmtIdrCompact, fmtInt, fmtMonth, monthFloorUtc, monthKey } from "@/lib/format";
import { SectionCard } from "@/components/reports/shared/SectionCard";
import { ReportTable } from "@/components/reports/shared/ReportTable";
import { idrOnly, backlogValue, sumBy } from "@/lib/financial-utils";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

export function BacklogForecastReport({ ei }: { ei: EiRow[] }) {
  const rows = useMemo(() => idrOnly(ei), [ei]);

  const stats = useMemo(() => {
    const totalBacklog = sumBy(rows, backlogValue);
    const openRows = rows.filter((r) => backlogValue(r) > 0);
    const totalBilling = sumBy(rows, (r) => r.billedExcl);
    const invMonths = new Set(rows.filter((r) => r.invoiceDate).map((r) => monthKey(monthFloorUtc(r.invoiceDate!)))).size;
    const avgMonthlyBilling = invMonths > 0 ? totalBilling / invMonths : 0;
    const coverage = avgMonthlyBilling > 0 ? totalBacklog / avgMonthlyBilling : 0;
    return { totalBacklog, openCount: openRows.length, avgMonthlyBilling, coverage };
  }, [rows]);

  // Backlog trend: opening/closing per month, derived from cumulative intake - cumulative billing.
  const trend = useMemo(() => {
    const bucket = new Map<string, { key: string; label: string; date: Date; intake: number; billing: number }>();
    const ensure = (d: Date) => {
      const md = monthFloorUtc(d);
      const k = monthKey(md);
      let b = bucket.get(k);
      if (!b) { b = { key: k, label: fmtMonth(md), date: md, intake: 0, billing: 0 }; bucket.set(k, b); }
      return b;
    };
    for (const r of rows) {
      if (r.orderDate) ensure(r.orderDate).intake += r.orderIntakeExcl || 0;
      if (r.invoiceDate) ensure(r.invoiceDate).billing += r.billedExcl || 0;
    }
    const list = Array.from(bucket.values()).sort((a, b) => a.key.localeCompare(b.key));
    let running = 0;
    return list.map((m) => {
      const opening = running;
      running += m.intake - m.billing;
      return { label: m.label, opening, closing: running, intake: m.intake, billing: m.billing };
    });
  }, [rows]);

  // Revenue forecast: backlog grouped by EDD month.
  const forecast = useMemo(() => {
    const map = new Map<string, { key: string; label: string; date: Date; value: number; count: number }>();
    for (const r of rows) {
      const bl = backlogValue(r);
      if (bl <= 0 || !r.edd) continue;
      const md = monthFloorUtc(r.edd);
      const k = monthKey(md);
      let b = map.get(k);
      if (!b) { b = { key: k, label: fmtMonth(md), date: md, value: 0, count: 0 }; map.set(k, b); }
      b.value += bl;
      b.count++;
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [rows]);

  return (
    <div className="space-y-3">
      <SectionCard title="Backlog & Forecast" subtitle="Un-billed orders and future revenue view">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Metric label="Current backlog" value={fmtIdrCompact(stats.totalBacklog)} sub={`${fmtInt(stats.openCount)} open orders`} />
          <Metric label="Avg monthly billing" value={fmtIdrCompact(stats.avgMonthlyBilling)} />
          <Metric label="Backlog coverage" value={stats.coverage > 0 ? `${stats.coverage.toFixed(1)} mo` : "—"} sub="Backlog ÷ avg billing" />
          <Metric label="With EDD scheduled" value={fmtInt(forecast.reduce((s, f) => s + f.count, 0))} sub={fmtIdrCompact(forecast.reduce((s, f) => s + f.value, 0))} />
        </div>
      </SectionCard>

      <SectionCard title="Backlog trend" subtitle="Opening & closing backlog per month">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => fmtIdrCompact(v)} width={70} />
            <Tooltip {...tt} formatter={(v: number) => fmtIdr(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="opening" name="Opening" stroke="var(--chart-4)" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="closing" name="Closing" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Revenue forecast" subtitle="Backlog by expected delivery month (EDD)">
        {forecast.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={forecast} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => fmtIdrCompact(v)} width={70} />
              <Tooltip {...tt} formatter={(v: number) => fmtIdr(v)} />
              <Bar dataKey="value" name="Forecast" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-foreground">No backlog with EDD dates.</p>
        )}
      </SectionCard>

      <SectionCard title="Backlog details">
        <ReportTable
          rows={rows.filter((r) => backlogValue(r) > 0).sort((a, b) => backlogValue(b) - backlogValue(a))}
          csvFilename="backlog.csv"
          columns={[
            { key: "customer", label: "Customer" },
            { key: "customerPo", label: "PO" },
            { key: "orderDate", label: "Order date", render: (r) => r.orderDate ? r.orderDate.toISOString().slice(0, 10) : "—", csv: (r) => r.orderDate ? r.orderDate.toISOString().slice(0, 10) : "" },
            { key: "edd", label: "EDD", render: (r) => r.edd ? r.edd.toISOString().slice(0, 10) : "—", csv: (r) => r.edd ? r.edd.toISOString().slice(0, 10) : "" },
            { key: "intake", label: "Intake", align: "right", render: (r) => fmtIdrCompact(r.orderIntakeExcl), csv: (r) => r.orderIntakeExcl },
            { key: "billed", label: "Billed", align: "right", render: (r) => fmtIdrCompact(r.billedExcl), csv: (r) => r.billedExcl },
            { key: "backlog", label: "Backlog", align: "right", render: (r) => fmtIdrCompact(backlogValue(r)), csv: (r) => backlogValue(r) },
            { key: "jobStatus", label: "Status" },
          ]}
        />
      </SectionCard>
    </div>
  );
}
