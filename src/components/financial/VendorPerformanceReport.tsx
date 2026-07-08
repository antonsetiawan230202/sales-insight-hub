// @ts-nocheck
import { useMemo } from "react";
import type { EiRow } from "@/lib/parse-ei-report";
import { fmtIdrCompact, fmtInt, fmtPct } from "@/lib/format";
import { SectionCard } from "@/components/reports/shared/SectionCard";
import { ReportTable } from "@/components/reports/shared/ReportTable";
import { idrOnly } from "@/lib/financial-utils";

function purchaseValue(r: EiRow): number {
  // revenueNet is the sell-side net; purchase ≈ revenueNet - marginNet
  const rev = r.revenueNet || r.billedExcl || 0;
  return Math.max(0, rev - (r.marginNet || 0));
}

interface VendorAgg {
  vendor: string;
  country: string;
  orders: number;
  billed: number;
  revenue: number;
  purchase: number;
  margin: number;
  marginPct: number;
}

export function VendorPerformanceReport({ ei }: { ei: EiRow[] }) {
  const rows = useMemo(() => idrOnly(ei), [ei]);

  const vendors: VendorAgg[] = useMemo(() => {
    const map = new Map<string, VendorAgg>();
    for (const r of rows) {
      const key = r.vendorName || "—";
      let v = map.get(key);
      if (!v) { v = { vendor: key, country: r.country || "—", orders: 0, billed: 0, revenue: 0, purchase: 0, margin: 0, marginPct: 0 }; map.set(key, v); }
      v.orders++;
      v.billed += r.billedExcl || 0;
      v.revenue += r.revenueNet || 0;
      v.purchase += purchaseValue(r);
      v.margin += r.marginNet || 0;
      if (r.country && v.country === "—") v.country = r.country;
    }
    return Array.from(map.values()).map((v) => ({ ...v, marginPct: v.revenue > 0 ? v.margin / v.revenue : 0 })).sort((a, b) => b.revenue - a.revenue);
  }, [rows]);

  const byCountry = useMemo(() => {
    const m = new Map<string, { country: string; revenue: number; margin: number; orders: number }>();
    for (const v of vendors) {
      const c = v.country || "—";
      const cur = m.get(c) || { country: c, revenue: 0, margin: 0, orders: 0 };
      cur.revenue += v.revenue; cur.margin += v.margin; cur.orders += v.orders;
      m.set(c, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue);
  }, [vendors]);

  return (
    <div className="space-y-3">
      <SectionCard title="Vendor / Principal performance" subtitle="Spend, revenue & margin by supplier">
        <ReportTable
          rows={vendors}
          csvFilename="vendor-performance.csv"
          columns={[
            { key: "vendor", label: "Vendor" },
            { key: "country", label: "Country" },
            { key: "orders", label: "Orders", align: "right", render: (r) => fmtInt(r.orders) },
            { key: "purchase", label: "Purchase", align: "right", render: (r) => fmtIdrCompact(r.purchase), csv: (r) => r.purchase },
            { key: "revenue", label: "Revenue net", align: "right", render: (r) => fmtIdrCompact(r.revenue), csv: (r) => r.revenue },
            { key: "billed", label: "Billed", align: "right", render: (r) => fmtIdrCompact(r.billed), csv: (r) => r.billed },
            { key: "margin", label: "Margin", align: "right", render: (r) => fmtIdrCompact(r.margin), csv: (r) => r.margin },
            { key: "marginPct", label: "Margin %", align: "right", render: (r) => r.revenue > 0 ? fmtPct(r.marginPct, 1) : "—", csv: (r) => r.marginPct },
          ]}
        />
      </SectionCard>

      <SectionCard title="Vendor country analysis">
        <ReportTable
          rows={byCountry}
          csvFilename="vendor-country.csv"
          columns={[
            { key: "country", label: "Country" },
            { key: "orders", label: "Orders", align: "right", render: (r) => fmtInt(r.orders) },
            { key: "revenue", label: "Revenue net", align: "right", render: (r) => fmtIdrCompact(r.revenue), csv: (r) => r.revenue },
            { key: "margin", label: "Margin", align: "right", render: (r) => fmtIdrCompact(r.margin), csv: (r) => r.margin },
            { key: "pct", label: "Margin %", align: "right", render: (r) => r.revenue > 0 ? fmtPct(r.margin / r.revenue, 1) : "—", csv: (r) => r.revenue > 0 ? r.margin / r.revenue : 0 },
          ]}
        />
      </SectionCard>
    </div>
  );
}
