import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useDashboardStore, filterQuotations } from "@/lib/dashboard-store";
import { FileUploadCard } from "@/components/dashboard/FileUploadCard";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { KpiCards } from "@/components/dashboard/KpiCards";
import {
  StatusDonut,
  SalesmanBar,
  ProbabilityBar,
  TopCustomers,
  BusinessAreaDonut,
  BookingForecastChart,
  RevenueForecastChart,
} from "@/components/dashboard/Charts";
import { QuotationsTable } from "@/components/dashboard/QuotationsTable";
import { ReportsSection } from "@/components/reports/ReportsSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sales & Prospects Dashboard" },
      {
        name: "description",
        content:
          "Interactive sales dashboard for quotations, bookings and revenue forecasting from Excel reports.",
      },
      { property: "og:title", content: "Sales & Prospects Dashboard" },
      {
        property: "og:description",
        content:
          "Filterable KPIs, weighted booking forecast and revenue projection from your Excel quotation and EI reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

export function DashboardPage() {
  const { quotations, ei, filters, quotationsMeta, eiMeta } = useDashboardStore();

  const filteredQuotes = useMemo(
    () => filterQuotations(quotations, filters),
    [quotations, filters]
  );

  // Only IDR-relevant quotes for charts
  const idrQuotes = useMemo(
    () => filteredQuotes.filter((q) => q.idr > 0 || q.actualIdr > 0),
    [filteredQuotes]
  );

  const excludedNonIdrQuotes = useMemo(
    () => filteredQuotes.length - idrQuotes.length,
    [filteredQuotes, idrQuotes]
  );

  const excludedNonIdrEi = useMemo(
    () => ei.filter((r) => r.currency && r.currency.toUpperCase() !== "IDR").length,
    [ei]
  );

  const hasData = quotations.length > 0 || ei.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
              Sales & Prospects Dashboard
            </h1>
            <p className="text-xs text-muted-foreground">
              IDR quotations, weighted booking forecast, and revenue projection
            </p>
          </div>
          <div className="ml-auto hidden text-right text-[11px] text-muted-foreground sm:block">
            {quotationsMeta && (
              <div>
                Quotations: <span className="font-medium text-foreground">{quotationsMeta.sheet}</span>{" "}
                · {quotations.length} rows
              </div>
            )}
            {eiMeta && (
              <div>
                EI report: <span className="font-medium text-foreground">{eiMeta.sheet}</span> ·{" "}
                {ei.length} rows
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 sm:px-6">
        <FileUploadCard />

        {!hasData && (
          <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center">
            <h2 className="text-base font-semibold">Upload your two Excel files to get started</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Drop the <code className="rounded bg-muted px-1 py-0.5 text-xs">Quotation Reference No & Status</code>{" "}
              file and the <code className="rounded bg-muted px-1 py-0.5 text-xs">EI Additional Report</code>{" "}
              above. Everything is parsed locally in your browser.
            </p>
          </div>
        )}

        {quotations.length > 0 && <FilterBar />}

        {(excludedNonIdrQuotes > 0 || excludedNonIdrEi > 0) && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            IDR-only view.{" "}
            {excludedNonIdrQuotes > 0 && (
              <>Excluded {excludedNonIdrQuotes} non-IDR quotation row{excludedNonIdrQuotes === 1 ? "" : "s"}. </>
            )}
            {excludedNonIdrEi > 0 && (
              <>Excluded {excludedNonIdrEi} non-IDR order row{excludedNonIdrEi === 1 ? "" : "s"}.</>
            )}
          </div>
        )}

        {hasData && <KpiCards quotations={filteredQuotes} ei={ei} />}

        {quotations.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <StatusDonut rows={idrQuotes} />
              <SalesmanBar rows={idrQuotes} />
              <ProbabilityBar rows={idrQuotes} />
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <TopCustomers rows={idrQuotes} />
              </div>
              <BusinessAreaDonut rows={idrQuotes} />
            </div>
            <BookingForecastChart rows={idrQuotes} />
          </>
        )}

        {ei.length > 0 && (
          <div className="grid grid-cols-1 gap-3">
            <RevenueForecastChart rows={ei} />
          </div>
        )}

        {quotations.length > 0 && <QuotationsTable rows={filteredQuotes} />}

        <footer className="pt-4 text-center text-[11px] text-muted-foreground">
          Files are parsed locally in your browser. No data is uploaded.
        </footer>
      </main>
    </div>
  );
}
