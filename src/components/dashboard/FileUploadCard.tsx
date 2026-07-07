import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, X, Link2, RefreshCw, Zap, ZapOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { parseQuotationsWorkbook } from "@/lib/parse-quotations";
import { parseEiWorkbook } from "@/lib/parse-ei-report";
import { useDashboardStore, type LinkedSource, type MergeSummary } from "@/lib/dashboard-store";
import { saveHandle, loadHandle, deleteHandle, supportsFileSystemAccess } from "@/lib/file-handle-store";
import { toast } from "sonner";

type Kind = "quotations" | "ei";

const HANDLE_KEYS: Record<Kind, string> = {
  quotations: "quotations-handle",
  ei: "ei-handle",
};

function formatAgo(ms: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ms).toLocaleString();
}

function summaryText(s: MergeSummary): string {
  return `+${s.added} new · ${s.updated} updated · ${s.unchanged} unchanged`;
}

async function parseBuffer(kind: Kind, buf: ArrayBuffer, fileName: string) {
  if (kind === "quotations") {
    const { rows, year, sheetName } = parseQuotationsWorkbook(buf);
    if (!rows.length) throw new Error("No quotation rows found");
    return { rows, meta: { fileName, year, sheet: sheetName } };
  }
  const { rows, sheetName } = parseEiWorkbook(buf);
  if (!rows.length) throw new Error("No order rows found");
  return { rows, meta: { fileName, sheet: sheetName } };
}

function DropZone({
  kind,
  title,
  subtitle,
  loaded,
  fileName,
  source,
  busy,
  onFile,
  onLink,
  onRefresh,
  onToggleAuto,
  onUnlink,
  onClear,
}: {
  kind: Kind;
  title: string;
  subtitle: string;
  loaded: boolean;
  fileName?: string;
  source: LinkedSource | null;
  busy: boolean;
  onFile: (f: File) => void;
  onLink: () => void;
  onRefresh: () => void;
  onToggleAuto: () => void;
  onUnlink: () => void;
  onClear: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const [, force] = useState(0);
  useEffect(() => {
    if (!source) return;
    const t = setInterval(() => force((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [source]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  const fsa = supportsFileSystemAccess();
  const linked = !!source?.linked;

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
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">{title}</p>
                {linked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {loaded && fileName ? fileName : subtitle}
              </p>
              {source && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Refreshed {formatAgo(source.lastRefreshedAt)}
                  {source.autoRefresh && linked ? " · auto-refresh on" : ""}
                </p>
              )}
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
              {loaded ? "Merge file" : "Choose file"}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
            </label>

            {fsa && !linked && (
              <Button variant="outline" size="sm" className="h-7" onClick={onLink} disabled={busy}>
                <Link2 className="mr-1 h-3 w-3" /> Link source
              </Button>
            )}
            {linked && (
              <>
                <Button variant="outline" size="sm" className="h-7" onClick={onRefresh} disabled={busy}>
                  <RefreshCw className={cn("mr-1 h-3 w-3", busy && "animate-spin")} /> Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={onToggleAuto}
                  title={source?.autoRefresh ? "Disable auto-refresh" : "Enable auto-refresh"}
                >
                  {source?.autoRefresh ? (
                    <><Zap className="mr-1 h-3 w-3 text-emerald-600" /> Auto on</>
                  ) : (
                    <><ZapOff className="mr-1 h-3 w-3" /> Auto off</>
                  )}
                </Button>
                <Button variant="ghost" size="sm" className="h-7" onClick={onUnlink}>
                  Unlink
                </Button>
              </>
            )}
            {!fsa && !loaded && (
              <span className="text-xs text-muted-foreground">or drag & drop</span>
            )}
          </div>
          {!fsa && loaded && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Auto-refresh requires Chrome, Edge, or the desktop app. Re-upload to merge in new rows.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function FileUploadCard() {
  const {
    quotationsMeta, eiMeta, quotations, ei,
    mergeQuotations, mergeEi, sources, setSource,
  } = useDashboardStore();
  const [busy, setBusy] = useState<Kind | null>(null);
  const handlesRef = useRef<{ quotations: FileSystemFileHandle | null; ei: FileSystemFileHandle | null }>({
    quotations: null,
    ei: null,
  });

  const applyParsed = useCallback(
    async (kind: Kind, buf: ArrayBuffer, fileName: string, lastModified: number, silent = false) => {
      const parsed = await parseBuffer(kind, buf, fileName);
      const summary =
        kind === "quotations"
          ? mergeQuotations(parsed.rows as any, parsed.meta as any)
          : mergeEi(parsed.rows as any, parsed.meta as any);
      const prev = sources[kind];
      setSource(kind, {
        fileName,
        lastModified,
        lastRefreshedAt: Date.now(),
        autoRefresh: prev?.autoRefresh ?? true,
        linked: prev?.linked ?? false,
      });
      if (!silent || summary.added > 0 || summary.updated > 0) {
        const label = kind === "quotations" ? "quotations" : "orders";
        toast.success(`Loaded ${summary.total} ${label} · ${summaryText(summary)}`);
      }
      return summary;
    },
    [mergeQuotations, mergeEi, setSource, sources]
  );

  // Restore linked handles on mount
  useEffect(() => {
    (async () => {
      for (const kind of ["quotations", "ei"] as Kind[]) {
        const h = await loadHandle(HANDLE_KEYS[kind]);
        if (!h) continue;
        handlesRef.current[kind] = h;
        try {
          // Query permission without prompting.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const perm = await (h as any).queryPermission?.({ mode: "read" });
          if (perm !== "granted") {
            // Mark as linked but pending permission.
            setSource(kind, {
              fileName: h.name,
              lastModified: 0,
              lastRefreshedAt: Date.now(),
              autoRefresh: true,
              linked: true,
            });
            continue;
          }
          const file = await h.getFile();
          const buf = await file.arrayBuffer();
          await applyParsed(kind, buf, file.name, file.lastModified, true);
          setSource(kind, {
            fileName: file.name,
            lastModified: file.lastModified,
            lastRefreshedAt: Date.now(),
            autoRefresh: sources[kind]?.autoRefresh ?? true,
            linked: true,
          });
        } catch (err) {
          console.warn("Failed to restore linked file", kind, err);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling for auto-refresh
  useEffect(() => {
    const timer = setInterval(async () => {
      for (const kind of ["quotations", "ei"] as Kind[]) {
        const src = sources[kind];
        const h = handlesRef.current[kind];
        if (!src?.linked || !src.autoRefresh || !h) continue;
        try {
          const file = await h.getFile();
          if (file.lastModified === src.lastModified) continue;
          const buf = await file.arrayBuffer();
          const summary = await applyParsed(kind, buf, file.name, file.lastModified, true);
          if (summary.added || summary.updated) {
            toast.success(
              `${kind === "quotations" ? "Quotations" : "EI report"} updated · ${summaryText(summary)}`
            );
          }
        } catch (err) {
          console.warn("Auto-refresh failed", kind, err);
        }
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [sources, applyParsed]);

  const handleFile = async (kind: Kind, file: File) => {
    setBusy(kind);
    try {
      const buf = await file.arrayBuffer();
      await applyParsed(kind, buf, file.name, file.lastModified);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setBusy(null);
    }
  };

  const handleLink = async (kind: Kind) => {
    if (!supportsFileSystemAccess()) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [handle] = await (window as any).showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: "Excel files",
            accept: {
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
              "application/vnd.ms-excel": [".xls"],
            },
          },
        ],
      });
      if (!handle) return;
      handlesRef.current[kind] = handle;
      await saveHandle(HANDLE_KEYS[kind], handle);
      setBusy(kind);
      const file = await handle.getFile();
      const buf = await file.arrayBuffer();
      await applyParsed(kind, buf, file.name, file.lastModified);
      setSource(kind, {
        fileName: file.name,
        lastModified: file.lastModified,
        lastRefreshedAt: Date.now(),
        autoRefresh: true,
        linked: true,
      });
      toast.success(`Linked ${file.name} · auto-refresh enabled`);
    } catch (err) {
      // User cancelled or permission denied
      if ((err as Error)?.name !== "AbortError") {
        console.error(err);
        toast.error("Failed to link file");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRefresh = async (kind: Kind) => {
    const h = handlesRef.current[kind];
    if (!h) return;
    setBusy(kind);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const perm = await (h as any).requestPermission?.({ mode: "read" });
      if (perm && perm !== "granted") {
        toast.error("Permission to read the linked file was denied");
        return;
      }
      const file = await h.getFile();
      const buf = await file.arrayBuffer();
      await applyParsed(kind, buf, file.name, file.lastModified);
    } catch (err) {
      console.error(err);
      toast.error("Failed to refresh — the file may have been moved or renamed. Re-link it.");
    } finally {
      setBusy(null);
    }
  };

  const handleToggleAuto = (kind: Kind) => {
    const src = sources[kind];
    if (!src) return;
    setSource(kind, { ...src, autoRefresh: !src.autoRefresh });
  };

  const handleUnlink = async (kind: Kind) => {
    handlesRef.current[kind] = null;
    await deleteHandle(HANDLE_KEYS[kind]);
    const src = sources[kind];
    setSource(kind, src ? { ...src, linked: false, autoRefresh: false } : null);
    toast.message("Source unlinked");
  };

  const handleClear = (kind: Kind) => {
    if (kind === "quotations") {
      useDashboardStore.setState({ quotations: [], quotationsMeta: null });
    } else {
      useDashboardStore.setState({ ei: [], eiMeta: null });
    }
    handlesRef.current[kind] = null;
    deleteHandle(HANDLE_KEYS[kind]);
    setSource(kind, null);
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
        source={sources.quotations}
        busy={busy === "quotations"}
        onFile={(f) => handleFile("quotations", f)}
        onLink={() => handleLink("quotations")}
        onRefresh={() => handleRefresh("quotations")}
        onToggleAuto={() => handleToggleAuto("quotations")}
        onUnlink={() => handleUnlink("quotations")}
        onClear={() => handleClear("quotations")}
      />
      <DropZone
        kind="ei"
        title={busy === "ei" ? "Parsing..." : `EI Report${ei.length ? ` — ${ei.length} rows` : ""}`}
        subtitle="EI-_Additional_Report-YTD_YYYY.xlsx"
        loaded={!!eiMeta && ei.length > 0}
        fileName={eiMeta?.fileName}
        source={sources.ei}
        busy={busy === "ei"}
        onFile={(f) => handleFile("ei", f)}
        onLink={() => handleLink("ei")}
        onRefresh={() => handleRefresh("ei")}
        onToggleAuto={() => handleToggleAuto("ei")}
        onUnlink={() => handleUnlink("ei")}
        onClear={() => handleClear("ei")}
      />
    </div>
  );
}
