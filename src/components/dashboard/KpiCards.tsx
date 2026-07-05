import { fmtIdrCompact, fmtInt, fmtPct } from "@/lib/format";
import type { QuotationRow } from "@/lib/parse-quotations";
import type { EiRow } from "@/lib/parse-ei-report";
import { TrendingUp, Trophy, Timer, XCircle, Coins, LineChart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400 bg-amber-500/10"
        : tone === "danger"
          ? "text-red-600 dark:text-red-400 bg-red-500/10"
          : "text-primary bg-primary/10";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-xs text-muted-foreground truncate">{sub}</p>
          )}
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toneClass)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  );
}

export function KpiCards({
  quotations,
  ei,
}: {
  quotations: QuotationRow[];
  ei: EiRow[];
}) {
  // Only IDR quotations (rows with idr > 0)
  const idrQuotes = quotations.filter((q) => q.idr > 0 || q.actualIdr > 0);
  const total = idrQuotes.length;
  const won = idrQuotes.filter((q) => q.status === "Won");
  const active = idrQuotes.filter((q) => q.status === "Active");
  const lost = idrQuotes.filter((q) => q.status === "Lost");
  const sum = (rs: QuotationRow[], key: "idr" | "actualIdr" = "idr") =>
    rs.reduce((a, r) => a + (r[key] || 0), 0);
  const winRate = won.length + lost.length > 0 ? won.length / (won.length + lost.length) : 0;
  const weightedPipeline = active.reduce((a, r) => a + r.idr * r.probability, 0);

  // EI: IDR only
  const idrEi = ei.filter((r) => r.currency.toUpperCase() === "IDR");
  const nowDate = new Date();
  const now = nowDate.getTime();
  const in90 = now + 90 * 86400000;
  const monthEnd = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth() + 1,
    1
  );
  const ytdBilled = idrEi
    .filter((r) => r.invoiceDate)
    .reduce((a, r) => a + r.billedExcl, 0);
  // Unbilled orders with a promised date (EDD + 10d).
  // Any promised date in the past is carried forward — it is still owed —
  // and included in both the current-month and 90-day forecast.
  const unbilled = idrEi.filter((r) => !r.invoiceDate && r.edd);
  const fc90 = unbilled
    .filter((r) => r.edd!.getTime() + 10 * 86400000 <= in90)
    .reduce((a, r) => a + r.orderIntakeExcl, 0);
  const fcMonth = unbilled
    .filter((r) => r.edd!.getTime() + 10 * 86400000 < monthEnd)
    .reduce((a, r) => a + r.orderIntakeExcl, 0);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi
        label="Total quotes"
        value={fmtInt(total)}
        sub={fmtIdrCompact(sum(idrQuotes))}
        icon={TrendingUp}
      />
      <Kpi
        label="Won"
        value={fmtInt(won.length)}
        sub={fmtIdrCompact(sum(won, "actualIdr") || sum(won))}
        icon={Trophy}
        tone="success"
      />
      <Kpi
        label="Active"
        value={fmtInt(active.length)}
        sub={fmtIdrCompact(sum(active))}
        icon={Timer}
        tone="warning"
      />
      <Kpi
        label="Lost"
        value={fmtInt(lost.length)}
        sub={fmtIdrCompact(sum(lost))}
        icon={XCircle}
        tone="danger"
      />
      <Kpi
        label="Win rate"
        value={fmtPct(winRate, 0)}
        sub={`${won.length} won / ${won.length + lost.length} closed`}
        icon={TrendingUp}
      />
      <Kpi
        label="Weighted pipeline"
        value={fmtIdrCompact(weightedPipeline)}
        sub="Active × Probability"
        icon={Coins}
      />
      <Kpi
        label="YTD billed (IDR)"
        value={fmtIdrCompact(ytdBilled)}
        sub="From EI report, excl. tax"
        icon={LineChart}
        tone="success"
      />
      <Kpi
        label="Forecast this month"
        value={fmtIdrCompact(fcMonth)}
        sub="Unbilled, promised by month-end (incl. overdue)"
        icon={Timer}
        tone="warning"
      />
      <Kpi
        label="Forecast 90d"
        value={fmtIdrCompact(fc90)}
        sub="EDD + 10 days, unbilled (overdue carried forward)"
        icon={Timer}
      />
