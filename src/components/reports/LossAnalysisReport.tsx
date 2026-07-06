import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { QuotationRow } from "@/lib/parse-quotations";
import { fmtIdr, fmtIdrCompact, fmtInt } from "@/lib/format";
import { parseCompetitor, parseLossReason, sumBy } from "@/lib/report-utils";
import { SectionCard } from "./shared/SectionCard";
import { ReportTable } from "./shared/ReportTable";

const tooltip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 },
};

export function LossAnalysisReport({ quotations }: { quotations: QuotationRow[] }) {
  const lost = useMemo(() => quotations.filter((r) => r.status === "Lost"), [quotations]);

  const byReason = useMemo(() => {
    const g: Record<string, { name: string; count: number; value: number }> = {};
    for (const r of lost) {
      const k = parseLossReason(r.remarks);
      g[k] ||= { name: k, count: 0, value: 0 };
      g[k].count++;
      g[k].value += r.idr;
    }
    return Object.values(g).sort((a, b) => b.value - a.value);
  }, [lost]);

  const byCompetitor = useMemo(() => {
    const g: Record<string, { name: string; count: number; value: number }> = {};
    for (const r of lost) {
      const c = parseCompetitor(r.remarks);
      if (!c) continue;
      g[c] ||= { name: c, count: 0, value: 0 };
      g[c].count++;
      g[c].value += r.idr;
    }
    return Object.values(g).sort((a, b) => b.value - a.value);
  }, [lost]);

  return (
    <div className="space-y-3">
      <SectionCard title="Lost overview" subtitle={`${lost.length} lost quotes, ${fmtIdrCompact(sumBy(lost, (r) => r.idr))}`}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={byReason} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => fmtIdrCompact(v)} width={70} />
            <Tooltip {...tooltip} formatter={(v: number) => fmtIdr(v)} />
            <Bar dataKey="value" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SectionCard title="Reasons for loss" subtitle="Extracted from REMARKS">
          <ReportTable
            rows={byReason}
            csvFilename="loss-reasons.csv"
            columns={[
              { key: "name", label: "Reason" },
              { key: "count", label: "Count", align: "right", render: (r) => fmtInt(r.count), csv: (r) => r.count },
              { key: "value", label: "Value (IDR)", align: "right", render: (r) => fmtIdrCompact(r.value), csv: (r) => r.value },
            ]}
          />
        </SectionCard>
        <SectionCard title="Loss by competitor" subtitle="Detected 'lost to X' in remarks">
          <ReportTable
            rows={byCompetitor}
            csvFilename="loss-competitors.csv"
            emptyText="No competitor mentions found in remarks."
            columns={[
              { key: "name", label: "Competitor" },
              { key: "count", label: "Count", align: "right", render: (r) => fmtInt(r.count), csv: (r) => r.count },
              { key: "value", label: "Value (IDR)", align: "right", render: (r) => fmtIdrCompact(r.value), csv: (r) => r.value },
            ]}
          />
        </SectionCard>
      </div>

      <SectionCard title="Lost quotes" subtitle="Full list with remarks">
        <ReportTable
          rows={lost.slice().sort((a, b) => b.idr - a.idr)}
          csvFilename="lost-quotes.csv"
          columns={[
            { key: "quotationDate", label: "Date", render: (r) => r.quotationDate?.toISOString().slice(0, 10) ?? "—", csv: (r) => r.quotationDate?.toISOString().slice(0, 10) ?? "" },
            { key: "customer", label: "Customer" },
            { key: "salesman", label: "Salesman" },
            { key: "idr", label: "IDR", align: "right", render: (r) => fmtIdrCompact(r.idr), csv: (r) => r.idr },
            { key: "reason", label: "Reason", render: (r) => parseLossReason(r.remarks), csv: (r) => parseLossReason(r.remarks) },
            { key: "remarks", label: "Remarks", render: (r) => <span className="text-muted-foreground" title={r.remarks}>{r.remarks.slice(0, 60)}{r.remarks.length > 60 ? "…" : ""}</span>, csv: (r) => r.remarks },
          ]}
          maxHeight={500}
        />
      </SectionCard>
    </div>
  );
}
