import type { QuotationRow } from "@/lib/parse-quotations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { PipelineAnalysis } from "./PipelineAnalysis";
import { PerformanceReport } from "./PerformanceReport";
import { CustomerMarketReport } from "./CustomerMarketReport";
import { ProductBrandReport } from "./ProductBrandReport";
import { LossAnalysisReport } from "./LossAnalysisReport";
import { TrendReport } from "./TrendReport";

export function ReportsSection({ quotations }: { quotations: QuotationRow[] }) {
  return (
    <Tabs defaultValue="executive" className="w-full">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
        <TabsTrigger value="executive">Executive</TabsTrigger>
        <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        <TabsTrigger value="performance">Performance</TabsTrigger>
        <TabsTrigger value="customer">Customer & Market</TabsTrigger>
        <TabsTrigger value="product">Product & Brand</TabsTrigger>
        <TabsTrigger value="loss">Loss Analysis</TabsTrigger>
        <TabsTrigger value="trend">Trend</TabsTrigger>
      </TabsList>
      <TabsContent value="executive" className="mt-3"><ExecutiveSummary quotations={quotations} /></TabsContent>
      <TabsContent value="pipeline" className="mt-3"><PipelineAnalysis quotations={quotations} /></TabsContent>
      <TabsContent value="performance" className="mt-3"><PerformanceReport quotations={quotations} /></TabsContent>
      <TabsContent value="customer" className="mt-3"><CustomerMarketReport quotations={quotations} /></TabsContent>
      <TabsContent value="product" className="mt-3"><ProductBrandReport quotations={quotations} /></TabsContent>
      <TabsContent value="loss" className="mt-3"><LossAnalysisReport quotations={quotations} /></TabsContent>
      <TabsContent value="trend" className="mt-3"><TrendReport quotations={quotations} /></TabsContent>
    </Tabs>
  );
}
