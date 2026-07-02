## Sales & Prospects Dashboard

A single-page dashboard where you drag & drop the two Excel files and immediately see filterable charts, KPIs, booking forecasts, and revenue forecasts. All parsing runs in the browser — nothing is uploaded to a server.

### 1. File upload & parsing
- Two drop zones on top: **Quotations** (`QUOTATION_REFERENCE_NO_AND_STATUS_...xlsx`) and **EI Report** (`EI-_Additional_Report-YTD_...xlsx`).
- Parse with `xlsx` (SheetJS) client-side.
- Quotations: read the year sheet (e.g. `2026`); normalise columns (Quotation Date, Salesman, Status, Probability, IDR amount, Est PO Date, PO Received Date, Customer, Business Area, Brand, Work Type).
- EI Report: read `Order Booking > Billing 2026`; normalise Customer, Currency, Order Intake (excl tax), Billed Orders (excl tax), Order Date, EDD (promised date to customer), Invoice Date, Job Status, Country.
- **Currency filter: IDR only** — rows with other currencies are ignored in totals (still counted in row counts with a small "excluded: N rows" note).
- Persist last-parsed data in `localStorage` so a refresh doesn't lose it.

### 2. Global filter bar
Filters apply to all charts/KPIs on the page:
- Salesman (multi-select)
- Quotation Status (Won / Active / Lost)
- Probability range (slider 0–100%)
- Business Area, Brand, Work Type (multi-select)
- Date range (Quotation Date)
- Reset button

### 3. KPI cards
- Total Quotations · Won · Active · Lost (counts + IDR value)
- Win rate %
- Weighted pipeline value (Σ Active IDR × Probability)
- YTD Billed Revenue (IDR, excl tax)
- Forecast revenue next 90 days

### 4. Prospect / Quotation charts
- **Status donut** (Won/Active/Lost by count and by IDR value — toggle).
- **Quotations by Salesman** — stacked bar (Won/Active/Lost) with value + count toggle.
- **Pipeline by Probability bucket** — bar chart: 0–25 / 25–50 / 50–75 / 75–100%, showing raw & weighted IDR.
- **Top 10 Customers** by quoted value — horizontal bar.
- **Business Area breakdown** — donut.
- **Quotations table** — sortable, searchable, with all normalised fields; CSV export.

### 5. Booking forecast (from Quotations)
- Bucket **Active** quotations by month using **Est PO Date** (parsing quarters `Q1..Q4` → mid-quarter month, and `Jan`/`Feb`/etc. → that month of current year).
- For each month show:
  - Raw pipeline IDR (sum of Active)
  - **Weighted booking forecast IDR** = Σ (Active IDR × Probability)
  - Won IDR already booked in that month (from PO Received Date)
- Grouped bar + line chart (Recharts ComposedChart).

### 6. Revenue by month + forecast (from EI Report)
- **Actual revenue** = sum of `Billed Orders (excluding tax)` grouped by **Invoice Date** month.
- **Forecast revenue** for rows still unbilled (no Invoice Date, or Job Status ≠ "Closed (Billed)") = `Order Intake (excl tax)`, bucketed by **EDD + 10 days** month.
- Combined chart: solid bars for Actual, hatched/lighter bars for Forecast, 12-month rolling view with a vertical "today" marker.
- Second view: line chart of cumulative YTD actual vs. YTD target (target editable inline).

### 7. Technical layout
```text
src/routes/index.tsx           → Dashboard page
src/lib/parse-quotations.ts    → SheetJS parser + row normaliser
src/lib/parse-ei-report.ts     → SheetJS parser + row normaliser
src/lib/dashboard-store.ts     → Zustand store (parsed rows, filters, persistence)
src/components/dashboard/
  FileUploadCard.tsx
  FilterBar.tsx
  KpiCards.tsx
  StatusDonut.tsx
  SalesmanBar.tsx
  ProbabilityBar.tsx
  TopCustomers.tsx
  BusinessAreaDonut.tsx
  QuotationsTable.tsx
  BookingForecastChart.tsx    (weighted by probability, monthly)
  RevenueForecastChart.tsx    (billed actual + EDD+10 forecast)
```
- Charts: **Recharts** (already common in shadcn stack).
- Excel parsing: **xlsx** (SheetJS) via `bun add xlsx`.
- State: **zustand** with `persist` middleware.
- Number formatting: `Intl.NumberFormat('id-ID')` for IDR (compact `1,2 Mrd` in charts, full in tooltips).
- All UI uses existing shadcn components + design tokens; no hardcoded colors.

### Visual direction
Clean analytics look: card-based grid, generous whitespace, subtle borders, semantic color tokens (primary for actual, muted for forecast, chart-1..5 for categories). Fully responsive; charts collapse to single column on mobile.

### Out of scope (can be added later)
- Multi-currency conversion
- Server-side persistence / multi-user
- Historical trend beyond files uploaded
- Auth / user roles
