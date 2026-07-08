import type { EiRow } from "@/lib/parse-ei-report";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderIntakeBillingReport } from "./OrderIntakeBillingReport";
import { BacklogForecastReport } from "./BacklogForecastReport";
import { ArAgingReport } from "./ArAgingReport";
import { CustomerSegmentRevenueReport } from "./CustomerSegmentRevenueReport";
import { VendorPerformanceReport } from "./VendorPerformanceReport";
import { JobStatusReport } from "./JobStatusReport";
import { ProfitabilityMarginReport } from "./ProfitabilityMarginReport";
import { FinancialTrendReport } from "./FinancialTrendReport";

export function FinancialReportsSection({ ei }: { ei: EiRow[] }) {
  if (!ei.length) {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center">
        <h3 className="text-base font-semibold">Upload the EI Additional Report to see Financial Reports</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Order intake, billing, backlog, aging, vendor and margin analytics are derived from the EI Additional Report Excel file.
        </p>
      </div>
    );
  }
  return (
    <Tabs defaultValue="intake" className="w-full">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
        <TabsTrigger value="intake">Intake & Billing</TabsTrigger>
        <TabsTrigger value="backlog">Backlog & Forecast</TabsTrigger>
        <TabsTrigger value="ar">A/R Aging</TabsTrigger>
        <TabsTrigger value="customer">Customer & Segment</TabsTrigger>
        <TabsTrigger value="vendor">Vendor</TabsTrigger>
        <TabsTrigger value="job">Job Status</TabsTrigger>
        <TabsTrigger value="margin">Profitability</TabsTrigger>
        <TabsTrigger value="trend">Trend</TabsTrigger>
      </TabsList>
      <TabsContent value="intake" className="mt-3"><OrderIntakeBillingReport ei={ei} /></TabsContent>
      <TabsContent value="backlog" className="mt-3"><BacklogForecastReport ei={ei} /></TabsContent>
      <TabsContent value="ar" className="mt-3"><ArAgingReport ei={ei} /></TabsContent>
      <TabsContent value="customer" className="mt-3"><CustomerSegmentRevenueReport ei={ei} /></TabsContent>
      <TabsContent value="vendor" className="mt-3"><VendorPerformanceReport ei={ei} /></TabsContent>
      <TabsContent value="job" className="mt-3"><JobStatusReport ei={ei} /></TabsContent>
      <TabsContent value="margin" className="mt-3"><ProfitabilityMarginReport ei={ei} /></TabsContent>
      <TabsContent value="trend" className="mt-3"><FinancialTrendReport ei={ei} /></TabsContent>
    </Tabs>
  );
}
