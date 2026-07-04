// @ts-nocheck
import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ComposedChart,
  Line,
} from "recharts";
import type { QuotationRow } from "@/lib/parse-quotations";
import { fmtIdrCompact, fmtInt, fmtIdr, fmtMonth, monthKey, keyToDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  Won: "var(--chart-2)",
  Active: "var(--chart-4)",
  Lost: "var(--chart-5)",
  Unknown: "var(--muted-foreground)",
};

const CHART_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function ChartCard({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 flex flex-col", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {right}
      </div>
      <div className="mt-3 flex-1 min-h-[240px]">{children}</div>
    </div>
  );
}

function tooltipStyle() {
  return {
    contentStyle: {
      background: "var(--popover)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      color: "var(--popover-foreground)",
      fontSize: 12,
    },
    labelStyle: { color: "var(--muted-foreground)", fontSize: 11 },
  };
}

export function StatusDonut({ rows }: { rows: QuotationRow[] }) {
  const [mode, setMode] = useState<"count" | "value">("count");
  const data = useMemo(() => {
    const g: Record<string, { count: number; value: number }> = {};
    for (const r of rows) {
      const k = r.status;
      g[k] ??= { count: 0, value: 0 };
      g[k].count += 1;
      g[k].value += r.idr;
    }
    return Object.entries(g).map(([name, v]) => ({
      name,
      count: v.count,
      value: v.value,
    }));
  }, [rows]);

  const total = data.reduce((a, d) => a + (mode === "count" ? d.count : d.value), 0);

  return (
    <ChartCard
      title="Quotations by status"
      subtitle={mode === "count" ? "By count" : "By IDR value"}
      right={
        <div className="flex overflow-hidden rounded-md border">
          <Button
            size="sm"
            variant={mode === "count" ? "default" : "ghost"}
            className="h-7 rounded-none px-2 text-xs"
            onClick={() => setMode("count")}
          >
            Count
          </Button>
          <Button
            size="sm"
            variant={mode === "value" ? "default" : "ghost"}
            className="h-7 rounded-none px-2 text-xs"
            onClick={() => setMode("value")}
          >
            Value
          </Button>
        </div>
      }
    >
      <div className="relative h-full">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              dataKey={mode}
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
            >
              {data.map((d, i) => (
                <Cell
                  key={d.name}
                  fill={STATUS_COLORS[d.name] ?? CHART_PALETTE[i % CHART_PALETTE.length]}
                />
              ))}
            </Pie>
            <Tooltip
              {...tooltipStyle()}
              formatter={(val: number, _n, p) => [
                mode === "value" ? fmtIdr(val) : fmtInt(val),
                p.payload.name,
              ]}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {mode === "count" ? "Total" : "Total IDR"}
          </span>
          <span className="text-lg font-semibold tabular-nums">
            {mode === "count" ? fmtInt(total) : fmtIdrCompact(total)}
          </span>
        </div>
      </div>
    </ChartCard>
  );
}

export function SalesmanBar({ rows }: { rows: QuotationRow[] }) {
  const [mode, setMode] = useState<"count" | "value">("value");
  const { data, statuses } = useMemo(() => {
    const statusSet = new Set<string>();
    for (const r of rows) statusSet.add(r.status || "Unknown");
    const statuses = Array.from(statusSet).sort();
    const g: Record<string, Record<string, number> & { total: number }> = {};
    for (const r of rows) {
      const key = r.salesman || "(none)";
      if (!g[key]) {
        g[key] = { total: 0 } as Record<string, number> & { total: number };
        for (const s of statuses) g[key][s] = 0;
      }
      const inc = mode === "count" ? 1 : r.idr;
      g[key][r.status || "Unknown"] += inc;
      g[key].total += inc;
    }
    const data = Object.entries(g)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => (b.total as number) - (a.total as number));
    return { data, statuses };
  }, [rows, mode]);

  return (
    <ChartCard
      title="Quotations by salesman"
      subtitle="Stacked by status"
      right={
        <div className="flex overflow-hidden rounded-md border">
          <Button
            size="sm"
            variant={mode === "count" ? "default" : "ghost"}
            className="h-7 rounded-none px-2 text-xs"
            onClick={() => setMode("count")}
          >
            Count
          </Button>
          <Button
            size="sm"
            variant={mode === "value" ? "default" : "ghost"}
            className="h-7 rounded-none px-2 text-xs"
            onClick={() => setMode("value")}
          >
            Value
          </Button>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v) => (mode === "value" ? fmtIdrCompact(v) : fmtInt(v))}
            width={70}
          />
          <Tooltip
            {...tooltipStyle()}
            formatter={(val: number) => (mode === "value" ? fmtIdr(val) : fmtInt(val))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {statuses.map((s, i) => (
            <Bar
              key={s}
              dataKey={s}
              stackId="s"
              fill={STATUS_COLORS[s] ?? CHART_PALETTE[i % CHART_PALETTE.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ProbabilityBar({ rows }: { rows: QuotationRow[] }) {
  // (removed buggy draft)


  // recompute correctly (bug above ignored) — rebuild
  const data2 = useMemo(() => {
    const buckets = [
      { name: "0–25%", raw: 0, weighted: 0, count: 0 },
      { name: "25–50%", raw: 0, weighted: 0, count: 0 },
      { name: "50–75%", raw: 0, weighted: 0, count: 0 },
      { name: "75–100%", raw: 0, weighted: 0, count: 0 },
    ];
    for (const r of rows) {
      if (r.status !== "Active") continue;
      const i =
        r.probability < 0.25 ? 0 : r.probability < 0.5 ? 1 : r.probability < 0.75 ? 2 : 3;
      buckets[i].raw += r.idr;
      buckets[i].weighted += r.idr * r.probability;
      buckets[i].count += 1;
    }
    return buckets;
  }, [rows]);

  return (
    <ChartCard
      title="Active pipeline by probability"
      subtitle="Raw vs weighted IDR value"
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data2} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v) => fmtIdrCompact(v)}
            width={70}
          />
          <Tooltip {...tooltipStyle()} formatter={(v: number) => fmtIdr(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="raw" name="Raw pipeline" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
          <Bar
            dataKey="weighted"
            name="Weighted forecast"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TopCustomers({ rows }: { rows: QuotationRow[] }) {
  const data = useMemo(() => {
    const g: Record<string, number> = {};
    for (const r of rows) {
      if (!r.customer) continue;
      g[r.customer] = (g[r.customer] ?? 0) + r.idr;
    }
    return Object.entries(g)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .reverse();
  }, [rows]);

  return (
    <ChartCard title="Top 10 customers" subtitle="By quoted IDR value">
      <ResponsiveContainer width="100%" height={Math.max(260, data.length * 26)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 5, bottom: 0 }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v) => fmtIdrCompact(v)}
          />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            width={150}
          />
          <Tooltip {...tooltipStyle()} formatter={(v: number) => fmtIdr(v)} />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function BusinessAreaDonut({ rows }: { rows: QuotationRow[] }) {
  const data = useMemo(() => {
    const g: Record<string, number> = {};
    for (const r of rows) {
      const k = r.businessArea || "(none)";
      g[k] = (g[k] ?? 0) + r.idr;
    }
    return Object.entries(g)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  return (
    <ChartCard title="Business area" subtitle="Quoted IDR share">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle()} formatter={(v: number) => fmtIdr(v)} />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function BookingForecastChart({ rows }: { rows: QuotationRow[] }) {
  const data = useMemo(() => {
    // build 12 months around current year of quotations (based on data year if present)
    const anchorYear =
      rows.find((r) => r.estPoMonth)?.estPoMonth?.getUTCFullYear() ??
      new Date().getUTCFullYear();
    const months: Record<string, { key: string; label: string; raw: number; weighted: number; won: number }> = {};
    for (let m = 0; m < 12; m++) {
      const d = new Date(Date.UTC(anchorYear, m, 1));
      const k = monthKey(d);
      months[k] = { key: k, label: fmtMonth(d), raw: 0, weighted: 0, won: 0 };
    }
    for (const r of rows) {
      if (r.status === "Active" && r.estPoMonth) {
        const k = monthKey(r.estPoMonth);
        if (months[k]) {
          months[k].raw += r.idr;
          months[k].weighted += r.idr * r.probability;
        }
      }
      if (r.status === "Won" && r.poReceivedDate) {
        const d = new Date(
          Date.UTC(r.poReceivedDate.getUTCFullYear(), r.poReceivedDate.getUTCMonth(), 1)
        );
        const k = monthKey(d);
        if (months[k]) {
          months[k].won += r.actualIdr || r.idr;
        }
      }
    }
    return Object.values(months);
  }, [rows]);

  return (
    <ChartCard
      title="Booking forecast by month"
      subtitle="Active pipeline weighted by probability + Won bookings"
    >
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v) => fmtIdrCompact(v)}
            width={70}
          />
          <Tooltip {...tooltipStyle()} formatter={(v: number) => fmtIdr(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="won" name="Won (booked)" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
          <Bar
            dataKey="weighted"
            name="Weighted forecast"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="raw"
            name="Raw pipeline"
            stroke="var(--chart-4)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function RevenueForecastChart({
  rows,
}: {
  rows: import("@/lib/parse-ei-report").EiRow[];
}) {
  const data = useMemo(() => {
    const idr = rows.filter((r) => r.currency.toUpperCase() === "IDR");
    // Build month buckets from min to max
    const dates: Date[] = [];
    for (const r of idr) {
      if (r.invoiceDate) dates.push(r.invoiceDate);
      if (r.edd) dates.push(new Date(r.edd.getTime() + 10 * 86400000));
    }
    if (dates.length === 0) return { data: [], todayLabel: null as string | null };
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    const start = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), 1));
    const end = new Date(Date.UTC(max.getUTCFullYear(), max.getUTCMonth(), 1));

    const months: Record<string, { key: string; label: string; actual: number; forecast: number }> = {};
    for (
      let d = new Date(start);
      d.getTime() <= end.getTime();
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
    ) {
      const k = monthKey(d);
      months[k] = { key: k, label: fmtMonth(d), actual: 0, forecast: 0 };
    }

    for (const r of idr) {
      if (r.invoiceDate && r.billedExcl > 0) {
        const d = new Date(
          Date.UTC(r.invoiceDate.getUTCFullYear(), r.invoiceDate.getUTCMonth(), 1)
        );
        const k = monthKey(d);
        if (months[k]) months[k].actual += r.billedExcl;
      } else if (!r.invoiceDate && r.edd && r.orderIntakeExcl > 0) {
        const promised = new Date(r.edd.getTime() + 10 * 86400000);
        const d = new Date(
          Date.UTC(promised.getUTCFullYear(), promised.getUTCMonth(), 1)
        );
        const k = monthKey(d);
        if (months[k]) months[k].forecast += r.orderIntakeExcl;
      }
    }

    const now = new Date();
    const nowMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const todayLabel = months[monthKey(nowMonth)]?.label ?? null;

    return { data: Object.values(months), todayLabel };
  }, [rows]);

  return (
    <ChartCard
      title="Revenue by month + forecast"
      subtitle="Actual = Invoice date · Forecast = Promised date (EDD) + 10 days · IDR excl. tax"
      className="xl:col-span-2"
    >
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v) => fmtIdrCompact(v)}
            width={70}
          />
          <Tooltip {...tooltipStyle()} formatter={(v: number) => fmtIdr(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="actual"
            name="Actual (billed)"
            stackId="rev"
            fill="var(--chart-2)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="forecast"
            name="Forecast (EDD+10d)"
            stackId="rev"
            fill="var(--chart-1)"
            fillOpacity={0.55}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      {data.todayLabel && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Current month: <span className="font-medium text-foreground">{data.todayLabel}</span>
        </p>
      )}
    </ChartCard>
  );
}

// Suppress unused import warning
void keyToDate;
