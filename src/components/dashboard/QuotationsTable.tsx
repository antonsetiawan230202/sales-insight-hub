import { useMemo, useState } from "react";
import type { QuotationRow } from "@/lib/parse-quotations";
import { fmtIdr, fmtPct } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Download } from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey =
  | "quotationDate"
  | "customer"
  | "salesman"
  | "status"
  | "probability"
  | "idr"
  | "estPoDate";

const cols: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "quotationDate", label: "Date" },
  { key: "customer", label: "Customer" },
  { key: "salesman", label: "Salesman" },
  { key: "status", label: "Status" },
  { key: "probability", label: "Prob.", align: "right" },
  { key: "idr", label: "IDR", align: "right" },
  { key: "estPoDate", label: "Est PO" },
];

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

function statusBadge(s: string) {
  const cls =
    s === "Won"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : s === "Active"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : s === "Lost"
          ? "bg-red-500/15 text-red-700 dark:text-red-400"
          : "bg-muted text-muted-foreground";
  return <Badge className={cn("border-0 font-medium", cls)}>{s}</Badge>;
}

export function QuotationsTable({ rows }: { rows: QuotationRow[] }) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("quotationDate");
  const [asc, setAsc] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = rows;
    if (s) {
      list = list.filter((r) =>
        [r.customer, r.salesman, r.reference, r.brand, r.workType, r.description, r.remarks]
          .join(" ")
          .toLowerCase()
          .includes(s)
      );
    }
    const sorted = [...list].sort((a, b) => {
      const va = (a as any)[sortKey];
      const vb = (b as any)[sortKey];
      if (va instanceof Date || vb instanceof Date) {
        return ((va?.getTime() ?? 0) - (vb?.getTime() ?? 0)) * (asc ? 1 : -1);
      }
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * (asc ? 1 : -1);
      }
      return String(va ?? "").localeCompare(String(vb ?? "")) * (asc ? 1 : -1);
    });
    return sorted;
  }, [rows, q, sortKey, asc]);

  const exportCsv = () => {
    const header = [
      "Date",
      "Reference",
      "Customer",
      "Business Area",
      "Brand",
      "Work Type",
      "Salesman",
      "Status",
      "Probability",
      "IDR",
      "Actual IDR",
      "Est PO",
      "PO Received",
      "PO Number",
      "Remarks",
    ];
    const lines = [header.join(",")];
    for (const r of filtered) {
      const cells = [
        fmtDate(r.quotationDate),
        r.reference,
        r.customer,
        r.businessArea,
        r.brand,
        r.workType,
        r.salesman,
        r.status,
        r.probability,
        r.idr,
        r.actualIdr,
        r.estPoDate,
        fmtDate(r.poReceivedDate),
        r.poNumber,
        r.remarks,
      ].map((v) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      });
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "quotations.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <h3 className="text-sm font-semibold">
          Quotations{" "}
          <span className="text-xs font-normal text-muted-foreground">
            ({filtered.length} rows)
          </span>
        </h3>
        <div className="ml-auto flex items-center gap-2">
          <Input
            placeholder="Search customer, ref, salesman…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 w-56"
          />
          <Button variant="outline" size="sm" className="h-8" onClick={exportCsv}>
            <Download className="mr-1 h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </div>
      <div className="max-h-[480px] overflow-auto border-t">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b text-left text-muted-foreground">
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-3 py-2 font-medium whitespace-nowrap",
                    c.align === "right" && "text-right"
                  )}
                >
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => {
                      if (sortKey === c.key) setAsc(!asc);
                      else {
                        setSortKey(c.key);
                        setAsc(false);
                      }
                    }}
                  >
                    {c.label}
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Ref</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/40">
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                  {fmtDate(r.quotationDate)}
                </td>
                <td className="px-3 py-2 max-w-[220px] truncate" title={r.customer}>
                  {r.customer}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{r.salesman || "—"}</td>
                <td className="px-3 py-2">{statusBadge(r.status)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtPct(r.probability, 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.idr ? fmtIdr(r.idr) : "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{r.estPoDate || "—"}</td>
                <td className="px-3 py-2 max-w-[180px] truncate text-muted-foreground" title={r.reference}>
                  {r.reference}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No quotations match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
