import { useEffect, useRef, useState } from "react";
import { useDashboardStore, type LinkedSource } from "@/lib/dashboard-store";
import { parseQuotationsWorkbook } from "@/lib/parse-quotations";
import { parseEiWorkbook } from "@/lib/parse-ei-report";
import { hydrateFromElectron } from "@/lib/dashboard-store";
import { toast } from "sonner";

type ElectronFsApi = {
  listDataFiles: () => Promise<{ name: string; path: string }[]>;
  readDataFile: (name: string) => Promise<ArrayBuffer | null>;
  statDataFile: (name: string) => Promise<number | null>;
};

function getElectronFs(): ElectronFsApi | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { electronFs?: ElectronFsApi }).electronFs ?? null;
}

function matchKind(fileName: string): "quotations" | "ei" | null {
  const upper = fileName.toUpperCase();
  if (upper.startsWith("QUOTATION_REFERENCE_NO")) return "quotations";
  if (upper.startsWith("EI-_ADDITIONAL_REPORT")) return "ei";
  return null;
}

export function useBootstrapData() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const efs = getElectronFs();
      if (!efs) return;

      // First, hydrate persisted state from JSON file
      await hydrateFromElectron();

      // Then check if we need to auto-load bundled Excel files
      const state = useDashboardStore.getState();
      const hasData = state.quotations.length > 0 || state.ei.length > 0;

      if (hasData) {
        // Data already persisted — just set up sources for bundled files if linked
        setBootstrapped(true);
        return;
      }

      try {
        const files = await efs.listDataFiles();
        if (!files.length) {
          setBootstrapped(true);
          return;
        }

        let quotationsLoaded = 0;
        let ordersLoaded = 0;

        for (const file of files) {
          const kind = matchKind(file.name);
          if (!kind) continue;

          const buf = await efs.readDataFile(file.name);
          if (!buf) continue;

          const mtime = await efs.statDataFile(file.name);
          const lastModified = mtime ? Math.floor(mtime) : Date.now();

          if (kind === "quotations") {
            const { rows, year, sheetName } = parseQuotationsWorkbook(buf);
            if (rows.length) {
              const { mergeQuotations, setSource } = useDashboardStore.getState();
              mergeQuotations(rows, { fileName: file.name, year, sheet: sheetName });
              const source: LinkedSource = {
                fileName: file.name,
                lastModified,
                lastRefreshedAt: Date.now(),
                autoRefresh: true,
                linked: true,
              };
              setSource("quotations", source);
              quotationsLoaded = useDashboardStore.getState().quotations.length;
            }
          } else {
            const { rows, sheetName } = parseEiWorkbook(buf);
            if (rows.length) {
              const { mergeEi, setSource } = useDashboardStore.getState();
              mergeEi(rows, { fileName: file.name, sheet: sheetName });
              const source: LinkedSource = {
                fileName: file.name,
                lastModified,
                lastRefreshedAt: Date.now(),
                autoRefresh: true,
                linked: true,
              };
              setSource("ei", source);
              ordersLoaded = useDashboardStore.getState().ei.length;
            }
          }
        }

        if (quotationsLoaded > 0 || ordersLoaded > 0) {
          toast.success(
            `Loaded ${quotationsLoaded} quotations and ${ordersLoaded} orders from bundled files`
          );
        }
      } catch (err) {
        console.error("Bootstrap auto-load failed", err);
      } finally {
        setBootstrapped(true);
      }
    })();
  }, []);

  return bootstrapped;
}

export { getElectronFs, matchKind };
