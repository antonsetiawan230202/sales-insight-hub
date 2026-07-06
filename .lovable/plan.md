## Management Reports — expansion plan

Add a new **Reports** section to the dashboard with 7 tabbed report views, on top of the existing quotation + EI data already parsed and filtered. Everything reuses the current Zustand store, filter bar, and `xlsx` parsers — no new data source is required. All reports respect the global filter bar (salesman, status, probability, business area, brand, work type, date range).

### 1. Navigation change
- Add a **Tabs** control at the top of `src/routes/index.tsx`:
  - **Overview** (current KPI + charts view, unchanged)
  - **Reports** (new)
- Inside **Reports**, a secondary Tabs list with 7 report tabs (Executive, Pipeline, Performance, Customer, Product, Loss, Trend).
- Each report tab is a self-contained component under `src/components/reports/`.

### 2. New components

```text
src/components/reports/
  ReportsSection.tsx            → tab shell + shared header / export button
  ExecutiveSummary.tsx          → Report 1
  PipelineAnalysis.tsx          → Report 2 (status / probability / quarter / aging)
  PerformanceReport.tsx         → Report 3 (salesman + dep code tables)
  CustomerMarketReport.tsx      → Report 4 (top customers, business area, repeat)
  ProductBrandReport.tsx        → Report 5 (top brands / descriptions / work type)
  LossAnalysisReport.tsx        → Report 6 (lost list, reason buckets, competitor)
  TrendReport.tsx               → Report 7 (monthly trends)
  shared/ReportTable.tsx        → sortable table w/ CSV export
  shared/SectionCard.tsx        → titled card wrapper
```

### 3. Report-by-report content

**1. Executive Summary** — one-page KPI grid:
- Total pipeline value (Active + Won) in IDR and USD (sum of `usd` column already parsed)
- Total quote count · Win rate · Won value · Active value · Lost value
- **Pipeline coverage**: active pipeline ÷ editable sales target (target stored in Zustand, persisted)
- **Key opportunity**: single largest Active quote (customer, value, salesman)
- **Key risk**: largest Lost quote in last 90 days OR largest Active with probability ≤ 25%
- Mini status donut + top-5 customers strip

**2. Pipeline Analysis**
- *By status*: table + stacked bar (value & count)
- *By probability bucket* (0–25 / 25–50 / 50–75 / 75–100): raw vs weighted IDR
- *By quarter*: value grouped by `estPoMonth` → quarter (bar chart)
- *Aging*: for Active rows, days since `quotationDate` bucketed (<30, 30–60, 60–90, 90+); highlight 90+ as stale

**3. Performance Report**
- Two grouped tables (salesman, then `depCode`) with columns:
  - Quotes issued (count), Value issued (IDR), Won value, Win rate %, Avg margin % (on Won)
- Sortable, CSV export per table
- Bar chart: Won value by salesman

**4. Customer & Market**
- Top 10 customers by Active value AND by Won value (side-by-side)
- Business area donut + table (count, value, win rate)
- Repeat-customer table: customers with ≥ 2 quotes OR remarks containing "repeat" — flag with a badge

**5. Product & Brand**
- Top 10 brands by Won value (bar)
- Top 10 descriptions by Won value (table)
- Win rate by Work Type (bar + table with counts)

**6. Competitive & Loss Analysis**
- Table of all Lost quotes (customer, value, salesman, remarks)
- **Reason buckets** — parse `remarks` with keyword rules: `no budget`, `budgetary`, `obsolete`, `lost to <name>`, `price`, `delivery`, else `Other`. Show as bar + table.
- **Loss by competitor** — extract text after "lost to" / "to " in remarks; aggregate value by competitor name.

**7. Monthly/Quarterly Trend**
- Line/bar combo: quotes created per month (by `quotationDate`) vs won per month (by `poReceivedDate`) — count + value toggle
- Active pipeline trend: cumulative Active value by `quotationDate` month
- Won value trend by `poReceivedDate` month
- Quarter toggle (M / Q)

### 4. Store additions (`src/lib/dashboard-store.ts`)
- Add `salesTarget: number` (IDR, default 0) + `setSalesTarget` — persisted.
- No other schema changes; all reports derive from existing `quotations` + `ei` arrays.

### 5. Shared helpers (`src/lib/report-utils.ts` — new)
- `groupBy`, `sumBy`, `winRate`, `avgMargin`
- `bucketProbability`, `bucketAging`, `quarterOf`
- `parseLossReason(remarks)`, `parseCompetitor(remarks)`
- `exportCsv(rows, filename)` (already partially exists in QuotationsTable — extract & reuse)

### 6. Charts
Reuse Recharts patterns from existing `Charts.tsx` (BarChart, ComposedChart, PieChart) and shadcn `chart.tsx` wrapper. All colors from `--chart-1..5` tokens.

### 7. Out of scope for this pass
- USD/SGD/EUR forecasting (only Executive shows USD total)
- Editable per-salesman targets (single global target only)
- Persisting reports as PDF (CSV export is provided per table)
- Re-generating the Windows .exe / installers — that's a separate packaging step you can request once you've validated the new reports in the web preview.

### Technical notes
- All computations are pure functions over the filtered quotation set, memoised with `useMemo`.
- Reports render only when data exists; otherwise show the same empty state as the current dashboard.
- No backend calls; everything stays client-side (consistent with the existing app).
