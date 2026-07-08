import type { EiRow } from "./parse-ei-report";
import { monthKey, fmtMonth, monthFloorUtc } from "./format";

export function sumBy<T>(rows: T[], fn: (r: T) => number): number {
  let s = 0;
  for (const r of rows) s += fn(r) || 0;
  return s;
}

export function idrOnly(rows: EiRow[]): EiRow[] {
  return rows.filter((r) => !r.currency || r.currency.toUpperCase() === "IDR");
}

export interface MonthBucket {
  key: string;
  label: string;
  date: Date;
  intake: number;
  billing: number;
}

export function monthlyIntakeBilling(rows: EiRow[]): MonthBucket[] {
  const map = new Map<string, MonthBucket>();
  const ensure = (d: Date) => {
    const md = monthFloorUtc(d);
    const k = monthKey(md);
    let b = map.get(k);
    if (!b) {
      b = { key: k, label: fmtMonth(md), date: md, intake: 0, billing: 0 };
      map.set(k, b);
    }
    return b;
  };
  for (const r of rows) {
    if (r.orderDate) ensure(r.orderDate).intake += r.orderIntakeExcl || 0;
    if (r.invoiceDate) ensure(r.invoiceDate).billing += r.billedExcl || 0;
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function backlogValue(r: EiRow): number {
  return Math.max(0, (r.orderIntakeExcl || 0) - (r.billedExcl || 0));
}

export function agingBucket(days: number): string {
  if (days < 31) return "0–30 days";
  if (days < 61) return "31–60 days";
  if (days < 91) return "61–90 days";
  return "90+ days";
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

export function topN<T>(rows: T[], value: (r: T) => number, n = 10): T[] {
  return rows.slice().sort((a, b) => value(b) - value(a)).slice(0, n);
}

export function groupSum<T>(rows: T[], key: (r: T) => string, value: (r: T) => number): { key: string; value: number; count: number }[] {
  const map = new Map<string, { key: string; value: number; count: number }>();
  for (const r of rows) {
    const k = key(r) || "—";
    const cur = map.get(k) || { key: k, value: 0, count: 0 };
    cur.value += value(r) || 0;
    cur.count++;
    map.set(k, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}
