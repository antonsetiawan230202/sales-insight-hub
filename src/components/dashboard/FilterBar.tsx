import { useMemo } from "react";
import { useDashboardStore } from "@/lib/dashboard-store";
import type { QuotationStatus } from "@/lib/parse-quotations";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const summary =
    value.length === 0 ? "All" : value.length === 1 ? value[0] : `${value.length} selected`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 justify-between gap-2 min-w-[10rem]"
        >
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <span className="text-xs font-medium truncate max-w-[10rem]">{summary}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="max-h-64 overflow-auto p-1">
          {options.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground">No options</div>
          )}
          {options.map((opt) => {
            const active = value.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                  active && "bg-accent/50"
                )}
                onClick={() =>
                  onChange(active ? value.filter((v) => v !== opt) : [...value, opt])
                }
              >
                <span className="truncate">{opt || "(blank)"}</span>
                {active && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
        {value.length > 0 && (
          <div className="border-t p-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full justify-start text-xs"
              onClick={() => onChange([])}
            >
              <X className="mr-1 h-3 w-3" /> Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function FilterBar() {
  const { quotations, filters, setFilters, resetFilters } = useDashboardStore();

  const opts = useMemo(() => {
    return {
      salesmen: unique(quotations.map((r) => r.salesman).filter(Boolean)).sort(),
      statuses: unique(quotations.map((r) => r.status).filter(Boolean)).sort(),
      businessAreas: unique(quotations.map((r) => r.businessArea).filter(Boolean)).sort(),
      brands: unique(quotations.map((r) => r.brand).filter(Boolean)).sort(),
      workTypes: unique(quotations.map((r) => r.workType).filter(Boolean)).sort(),
    };
  }, [quotations]);

  const activeCount =
    filters.salesmen.length +
    filters.statuses.length +
    filters.businessAreas.length +
    filters.brands.length +
    filters.workTypes.length +
    (filters.probMin > 0 || filters.probMax < 1 ? 1 : 0) +
    (filters.dateFrom || filters.dateTo ? 1 : 0);

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          label="Salesman"
          options={opts.salesmen}
          value={filters.salesmen}
          onChange={(v) => setFilters({ salesmen: v })}
        />
        <MultiSelect
          label="Status"
          options={STATUSES}
          value={filters.statuses}
          onChange={(v) => setFilters({ statuses: v as QuotationStatus[] })}
        />
        <MultiSelect
          label="Business Area"
          options={opts.businessAreas}
          value={filters.businessAreas}
          onChange={(v) => setFilters({ businessAreas: v })}
        />
        <MultiSelect
          label="Brand"
          options={opts.brands}
          value={filters.brands}
          onChange={(v) => setFilters({ brands: v })}
        />
        <MultiSelect
          label="Work Type"
          options={opts.workTypes}
          value={filters.workTypes}
          onChange={(v) => setFilters({ workTypes: v })}
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 justify-between gap-2 min-w-[10rem]">
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Probability
                </span>
                <span className="text-xs font-medium">
                  {Math.round(filters.probMin * 100)}–{Math.round(filters.probMax * 100)}%
                </span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Min {Math.round(filters.probMin * 100)}%</span>
                <span>Max {Math.round(filters.probMax * 100)}%</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[filters.probMin * 100, filters.probMax * 100]}
                onValueChange={([lo, hi]) =>
                  setFilters({ probMin: lo / 100, probMax: hi / 100 })
                }
              />
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 justify-between gap-2 min-w-[10rem]">
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Quotation date
                </span>
                <span className="text-xs font-medium">
                  {filters.dateFrom || filters.dateTo
                    ? `${filters.dateFrom ?? "…"} → ${filters.dateTo ?? "…"}`
                    : "All"}
                </span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-3" align="start">
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">From</span>
              <Input
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={(e) => setFilters({ dateFrom: e.target.value || null })}
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">To</span>
              <Input
                type="date"
                value={filters.dateTo ?? ""}
                onChange={(e) => setFilters({ dateTo: e.target.value || null })}
              />
            </label>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-2">
          {activeCount > 0 && (
            <>
              <Badge variant="secondary" className="h-6">
                {activeCount} filter{activeCount === 1 ? "" : "s"} active
              </Badge>
              <Button variant="ghost" size="sm" className="h-8" onClick={resetFilters}>
                Reset
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
