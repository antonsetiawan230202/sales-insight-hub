// @ts-nocheck
import { useMemo } from "react";
import type { QuotationRow } from "@/lib/parse-quotations";
import { fmtIdrCompact, fmtIdr, fmtInt, fmtPct } from "@/lib/format";
import { sumBy, winRate } from "@/lib/report-utils";
import { SectionCard } from "./shared/SectionCard";
import { Input } from "@/components/ui/input";
import { useDashboardStore } from "@/lib/dashboard-store";
import { TrendingUp, AlertTriangle, Target } from "lucide-react";

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function ExecutiveSummary({ quotations }: { quotations: QuotationRow[] }) {
  const salesTarget = useDashboardStore((s) => s.salesTarget);
  const setSalesTarget = useDashboardStore((s) => s.setSalesTarget);

  const stats = useMemo(() => {
    const won = quotations.filter((r) => r.status === "Won");
    const active = quotations.filter((r) => r.status === "Active");
    const lost = quotations.filter((r) => r.status === "Lost");
    const totalIdr = sumBy(quotations, (r) => r.idr);
    const totalUsd = sumBy(quotations, (r) => r.usd);
    const wonIdr = sumBy(won, (r) => r.actualIdr || r.idr);
    const activeIdr = sumBy(active, (r) => r.idr);
    const lostIdr = sumBy(lost, (r) => r.idr);
    const pipeline = wonIdr + activeIdr;
    const coverage = salesTarget > 0 ? activeIdr / salesTarget : 0;

    const largestOpp = active.slice().sort((a, b) => b.idr - a.idr)[0];
    const recentLost = lost
      .filter((r) => r.quotationDate && Date.now() - r.quotationDate.getTime() < 90 * 86400000)
      .sort((a, b) => b.idr - a.idr)[0];
    const stalledActive = active
      .filter((r) => r.probability <= 0.25)
      .sort((a, b) => b.idr - a.idr)[0];
    const risk = recentLost || stalledActive;

    return {
      won,
      active,
      lost,
      totalIdr,
      totalUsd,
      wonIdr,
      activeIdr,
      lostIdr,
      pipeline,
      coverage,
      largestOpp,
      risk,
      winRate: winRate(quotations),
    };
  }, [quotations, salesTarget]);

  return (
    <div className="space-y-3">
      <SectionCard
        title="Executive summary"
        subtitle="Top-level snapshot of pipeline health"
      >
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Metric label="Total pipeline (Active+Won)" value={fmtIdrCompact(stats.pipeline)} sub={`USD ${usdFmt.format(stats.totalUsd)}`} />
          <Metric label="Total quotes" value={fmtInt(quotations.length)} />
          <Metric label="Win rate" value={fmtPct(stats.winRate, 0)} sub={`${stats.won.length} won / ${stats.won.length + stats.lost.length} closed`} />
          <Metric label="Won value" value={fmtIdrCompact(stats.wonIdr)} sub={`${stats.won.length} deals`} />
          <Metric label="Active value" value={fmtIdrCompact(stats.activeIdr)} sub={`${stats.active.length} deals`} />
          <Metric label="Lost value" value={fmtIdrCompact(stats.lostIdr)} sub={`${stats.lost.length} deals`} />
          <Metric label="Total quoted (IDR)" value={fmtIdrCompact(stats.totalIdr)} />
          <Metric label="Pipeline coverage" value={salesTarget > 0 ? fmtPct(stats.coverage, 0) : "—"} sub={salesTarget > 0 ? `Active ÷ target` : "Set a target →"} />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SectionCard title="Sales target" subtitle="Used for pipeline coverage">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <Input
              type="number"
              min={0}
              value={salesTarget || ""}
              placeholder="e.g. 50000000000"
              onChange={(e) => setSalesTarget(Number(e.target.value) || 0)}
              className="h-9"
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {salesTarget > 0 ? fmtIdr(salesTarget) : "No target set"}
          </p>
        </SectionCard>

        <SectionCard title="Key opportunity" subtitle="Largest active quote">
          {stats.largestOpp ? (
            <div className="flex gap-3">
              <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" title={stats.largestOpp.customer}>{stats.largestOpp.customer}</p>
                <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {fmtIdrCompact(stats.largestOpp.idr)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {stats.largestOpp.salesman || "—"} · {fmtPct(stats.largestOpp.probability, 0)} · {stats.largestOpp.brand || "—"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No active quotes.</p>
          )}
        </SectionCard>

        <SectionCard title="Key risk" subtitle="Largest recent loss / stalled deal">
          {stats.risk ? (
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" title={stats.risk.customer}>{stats.risk.customer}</p>
                <p className="text-lg font-semibold tabular-nums text-red-600 dark:text-red-400">
                  {fmtIdrCompact(stats.risk.idr)}
                </p>
                <p className="truncate text-[11px] text-muted-foreground" title={stats.risk.remarks}>
                  {stats.risk.status} · {stats.risk.salesman || "—"} · {stats.risk.remarks || "no remarks"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No notable risk detected.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
