import { useMemo, useState } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart } from "recharts";
import type { QuotationRow } from "@/lib/parse-quotations";
import { fmtIdr, fmtIdrCompact, fmtInt, fmtMonth, monthKey } from "@/lib/format";
import { SectionCard } from "./shared/SectionCard";
import { Button } from "@/components/ui/button";

const tooltip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 },
};

function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function TrendReport({ quotations }: { quotations: QuotationRow[] }) {
  const [mode, setMode] = useState<"value" | "count">("value");

  const monthly = useMemo(() => {
    const map: Record<string, { key: string; label: string; createdCount: number; createdValue: number; wonCount: number; wonValue: number; activeValue: number }> = {};
    const ensure = (d: Date) => {
      const k = monthKey(d);
      map[k] ||= { key: k, label: fmtMonth(d), createdCount: 0, createdValue: 0, wonCount: 0, wonValue: 0, activeValue: 0 };
      return map[k];
    };
    for (const r of quotations) {
      if (r.quotationDate) {
        const m = ensure(monthStart(r.quotationDate));
        m.createdCount++;
        m.createdValue += r.idr;
        if (r.status === "Active") m.activeValue += r.idr;
      }
      if (r.status === "Won" && r.poReceivedDate) {
        const m = ensure(monthStart(r.poReceivedDate));
        m.wonCount++;
        m.wonValue += r.actualIdr || r.idr;
      }
    }
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [quotations]);

  const cumulative = useMemo(() => {
    let cWon = 0, cActive = 0;
    return monthly.map((m) => {
      cWon += m.wonValue;
      cActive += m.activeValue;
      return { label: m.label, cumWon: cWon, cumActive: cActive };
    });
  }, [monthly]);

  return (
    <div className="space-y-3">
      <SectionCard
        title="Quotations created vs won"
        subtitle="Monthly volume / value"
        right={
          <div className="flex overflow-hidden rounded-md border">
            <Button size="sm" variant={mode === "value" ? "default" : "ghost"} className="h-7 rounded-none px-2 text-xs" onClick={() => setMode("value")}>Value</Button>
            <Button size="sm" variant={mode === "count" ? "default" : "ghost"} className="h-7 rounded-none px-2 text-xs" onClick={() => setMode("count")}>Count</Button>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => mode === "value" ? fmtIdrCompact(v) : fmtInt(v)} width={70} />
            <Tooltip {...tooltip} formatter={(v: number) => mode === "value" ? fmtIdr(v) : fmtInt(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey={mode === "value" ? "createdValue" : "createdCount"} name="Created" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            <Bar dataKey={mode === "value" ? "wonValue" : "wonCount"} name="Won" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Cumulative trend" subtitle="Won bookings and active pipeline growth (YTD)">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={cumulative} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => fmtIdrCompact(v)} width={70} />
            <Tooltip {...tooltip} formatter={(v: number) => fmtIdr(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="cumWon" name="Cumulative Won" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="cumActive" name="Cumulative Active" stroke="var(--chart-4)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}
