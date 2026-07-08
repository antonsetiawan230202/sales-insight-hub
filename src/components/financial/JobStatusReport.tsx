// @ts-nocheck
import { useMemo } from "react";
import type { EiRow } from "@/lib/parse-ei-report";
import { fmtIdr, fmtIdrCompact, fmtInt } from "@/lib/format";
import { SectionCard } from "@/components/reports/shared/SectionCard";
import { ReportTable } from "@/components/reports/shared/ReportTable";
import { idrOnly, groupSum, daysBetween } from "@/lib/financial-utils";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const tt = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 } };
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function classify(status: string): "Open" | "Closed" {
  return /close|complete|invoiced|billed|done/i.test(status || "") ? "Closed" : "Open";
}

export function JobStatusReport({ ei }: { ei: EiRow[] }) {
  const rows = useMemo(() => idrOnly(ei), [ei]);
  const now = new Date();

  const byStatus = useMemo(() => groupSum(rows, (r) => r.jobStatus || "—", (r) => r.orderIntakeExcl), [rows]);
  const openClosed = useMemo(() => groupSum(rows, (r) => classify(r.jobStatus), (r) => r.orderIntakeExcl), [rows]);

  const openAge = useMemo(() =>
    rows.filter((r) => classify(r.jobStatus) === "Open" && r.orderDate)
      .map((r) => ({ row: r, age: daysBetween(r.orderDate!, now) }))
      .sort((a, b) => b.age - a.age)
      .slice(0, 50)
  , [rows, now]);

  const eddVsActual = useMemo(() =>
    rows.filter((r) => r.edd && r.invoiceDate)
      .map((r) => ({ row: r, delta: daysBetween(r.edd!, r.invoiceDate!) }))
      .sort((a, b) => b.delta - a.delta)
  , [rows]);

  const onTime = eddVsActual.filter((x) => x.delta <= 0).length;
  const late = eddVsActual.filter((x) => x.delta > 0).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SectionCard title="Open vs Closed (by value)">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={openClosed} dataKey="value" nameKey="key" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.key}>
                {openClosed.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...tt} formatter={(v: number) => fmtIdr(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
        <SectionCard title="Status breakdown">
          <ReportTable
            rows={byStatus}
            csvFilename="job-status.csv"
            columns={[
              { key: "key", label: "Status" },
              { key: "count", label: "Orders", align: "right", render: (r) => fmtInt(r.count) },
              { key: "value", label: "Intake value", align: "right", render: (r) => fmtIdrCompact(r.value), csv: (r) => r.value },
            ]}
          />
        </SectionCard>
      </div>

      <SectionCard title="Delivery performance" subtitle={`On-time: ${onTime} · Late: ${late} (based on EDD vs invoice date)`}>
        <ReportTable
          rows={eddVsActual}
          csvFilename="edd-vs-actual.csv"
          columns={[
            { key: "customer", label: "Customer", render: (w) => w.row.customer, csv: (w) => w.row.customer },
            { key: "po", label: "PO", render: (w) => w.row.customerPo, csv: (w) => w.row.customerPo },
            { key: "edd", label: "EDD", render: (w) => w.row.edd?.toISOString().slice(0, 10) || "—", csv: (w) => w.row.edd?.toISOString().slice(0, 10) || "" },
            { key: "inv", label: "Invoiced", render: (w) => w.row.invoiceDate?.toISOString().slice(0, 10) || "—", csv: (w) => w.row.invoiceDate?.toISOString().slice(0, 10) || "" },
            { key: "delta", label: "Δ days", align: "right", render: (w) => (w.delta > 0 ? "+" : "") + w.delta, csv: (w) => w.delta },
            { key: "value", label: "Billed", align: "right", render: (w) => fmtIdrCompact(w.row.billedExcl), csv: (w) => w.row.billedExcl },
          ]}
        />
      </SectionCard>

      <SectionCard title="Aging of open orders" subtitle="Top 50 by days since order date">
        <ReportTable
          rows={openAge}
          csvFilename="open-order-aging.csv"
          columns={[
            { key: "customer", label: "Customer", render: (w) => w.row.customer, csv: (w) => w.row.customer },
            { key: "po", label: "PO", render: (w) => w.row.customerPo, csv: (w) => w.row.customerPo },
            { key: "orderDate", label: "Order date", render: (w) => w.row.orderDate?.toISOString().slice(0, 10) || "—", csv: (w) => w.row.orderDate?.toISOString().slice(0, 10) || "" },
            { key: "age", label: "Age (d)", align: "right", render: (w) => fmtInt(w.age), csv: (w) => w.age },
            { key: "status", label: "Status", render: (w) => w.row.jobStatus, csv: (w) => w.row.jobStatus },
            { key: "value", label: "Intake", align: "right", render: (w) => fmtIdrCompact(w.row.orderIntakeExcl), csv: (w) => w.row.orderIntakeExcl },
          ]}
        />
      </SectionCard>
    </div>
  );
}
