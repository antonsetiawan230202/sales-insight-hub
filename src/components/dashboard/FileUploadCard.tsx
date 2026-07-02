import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { parseQuotationsWorkbook } from "@/lib/parse-quotations";
import { parseEiWorkbook } from "@/lib/parse-ei-report";
import { useDashboardStore } from "@/lib/dashboard-store";
import { toast } from "sonner";

type Kind = "quotations" | "ei";

function DropZone({
  kind,
  title,
  subtitle,
  loaded,
  fileName,
  onFile,
  onClear,
}: {
  kind: Kind;
  title: string;
  subtitle: string;
  loaded: boolean;
  fileName?: string;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={cn(
        "relative rounded-xl border border-dashed p-5 transition-colors",
        drag ? "border-primary bg-primary/5" : "border-border bg-card",
        loaded && "border-solid border-primary/40 bg-primary/5"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            loaded ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          {loaded ? <CheckCircle2 className="h-5 w-5" /> : <FileSpreadsheet className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{title}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {loaded && fileName ? fileName : subtitle}
              </p>
            </div>
            {loaded && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onClear}
                aria-label="Clear file"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent">
              <Upload className="h-3.5 w-3.5" />
              {loaded ? "Replace file" : "Choose file"}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="text-xs text-muted-foreground">or drag & drop</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FileUploadCard() {
  const { quotationsMeta, eiMeta, quotations, ei, setQuotations, setEi } = useDashboardStore();
  const [busy, setBusy] = useState<Kind | null>(null);

  const handle = async (kind: Kind, file: File) => {
    setBusy(kind);
    try {
      const buf = await file.arrayBuffer();
      if (kind === "quotations") {
        const { rows, year, sheetName } = parseQuotationsWorkbook(buf);
        if (!rows.length) throw new Error("No quotation rows found");
        setQuotations(rows, { fileName: file.name, year, sheet: sheetName });
        toast.success(`Loaded ${rows.length} quotations from ${sheetName}`);
      } else {
        const { rows, sheetName } = parseEiWorkbook(buf);
        if (!rows.length) throw new Error("No order rows found");
        setEi(rows, { fileName: file.name, sheet: sheetName });
        toast.success(`Loaded ${rows.length} orders from ${sheetName}`);
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <DropZone
        kind="quotations"
        title={
          busy === "quotations"
            ? "Parsing..."
            : `Quotations file${quotations.length ? ` — ${quotations.length} rows` : ""}`
        }
        subtitle="QUOTATION_REFERENCE_NO_AND_STATUS_YYYY.xlsx"
        loaded={!!quotationsMeta && quotations.length > 0}
        fileName={quotationsMeta?.fileName}
        onFile={(f) => handle("quotations", f)}
        onClear={() =>
          useDashboardStore.setState({ quotations: [], quotationsMeta: null })
        }
      />
      <DropZone
        kind="ei"
        title={busy === "ei" ? "Parsing..." : `EI Report${ei.length ? ` — ${ei.length} rows` : ""}`}
        subtitle="EI-_Additional_Report-YTD_YYYY.xlsx"
        loaded={!!eiMeta && ei.length > 0}
        fileName={eiMeta?.fileName}
        onFile={(f) => handle("ei", f)}
        onClear={() => useDashboardStore.setState({ ei: [], eiMeta: null })}
      />
    </div>
  );
}
