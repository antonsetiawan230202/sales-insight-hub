import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportCsv } from "@/lib/report-utils";

export interface ReportColumn<T> {
  key: string;
  label: string;
  align?: "right" | "left";
  render?: (row: T) => React.ReactNode;
  csv?: (row: T) => string | number;
}

export function ReportTable<T>({
  rows,
  columns,
  csvFilename,
  emptyText = "No rows.",
  maxHeight = 420,
}: {
  rows: T[];
  columns: ReportColumn<T>[];
  csvFilename?: string;
  emptyText?: string;
  maxHeight?: number;
}) {
  const onExport = () => {
    if (!csvFilename) return;
    exportCsv(
      csvFilename,
      columns.map((c) => c.label),
      rows.map((r) => columns.map((c) => (c.csv ? c.csv(r) : String((r as any)[c.key] ?? ""))))
    );
  };
  return (
    <div className="rounded-lg border bg-background">
      {csvFilename && (
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs text-muted-foreground">{rows.length} rows</span>
          <Button variant="outline" size="sm" className="h-7" onClick={onExport}>
            <Download className="mr-1 h-3 w-3" /> CSV
          </Button>
        </div>
      )}
      <div className="overflow-auto border-t" style={{ maxHeight }}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b text-left text-muted-foreground">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-3 py-2 font-medium whitespace-nowrap",
                    c.align === "right" && "text-right"
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-b-0 hover:bg-muted/40">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3 py-2",
                      c.align === "right" && "text-right tabular-nums"
                    )}
                  >
                    {c.render ? c.render(r) : String((r as any)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
