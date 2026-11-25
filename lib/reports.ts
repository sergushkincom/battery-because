import { rollup, type PeriodMetrics } from "./explain";
import type { Dataset } from "./mock/generate";
import { sliceDays } from "./selectors";
import { eachDate } from "./time";
import type { DailyRevenue, Outage } from "./types";

export interface ReportPeriod {
  id: string;
  label: string;
  from: string;
  to: string;
}

export const REPORTS: ReportPeriod[] = [
  { id: "2026-11", label: "November 2026", from: "2026-11-01", to: "2026-11-19" },
  { id: "2026-10", label: "October 2026", from: "2026-10-01", to: "2026-10-31" },
  { id: "2026-09", label: "September 2026", from: "2026-09-01", to: "2026-09-30" },
  { id: "2026-08", label: "August 2026", from: "2026-08-22", to: "2026-08-31" },
  { id: "2026-Q4", label: "Q4 2026", from: "2026-10-01", to: "2026-11-19" },
  { id: "2026-Q3", label: "Q3 2026", from: "2026-08-22", to: "2026-09-30" },
];

export function findReport(id: string): ReportPeriod | undefined {
  return REPORTS.find((period) => period.id === id);
}

export function reportKind(period: ReportPeriod): "month" | "quarter" {
  return period.id.includes("Q") ? "quarter" : "month";
}

/** The calendar month or quarter of a report, before the book's start or the demo day cut it short. */
export function calendarSpan(period: ReportPeriod): { from: string; to: string } {
  const [year, rest] = period.id.split("-");
  const y = Number(year);
  const quarter = rest.startsWith("Q");
  const firstMonth = quarter ? (Number(rest.slice(1)) - 1) * 3 + 1 : Number(rest);
  const lastMonth = quarter ? firstMonth + 2 : firstMonth;
  const lastDay = new Date(Date.UTC(y, lastMonth, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { from: `${y}-${pad(firstMonth)}-01`, to: `${y}-${pad(lastMonth)}-${pad(lastDay)}` };
}

export interface ReportDay {
  date: string;
  cents: number;
  planCents: number;
  /** An outage on one of the report's assets touched this day. */
  outage: boolean;
}

export interface ReportFigures {
  actual: DailyRevenue[];
  metrics: PeriodMetrics;
  days: ReportDay[];
  incidents: Outage[];
  /** Days the report covers, and days in its calendar month or quarter. */
  coveredDays: number;
  calendarDays: number;
}

/** Everything a report shows for one period and one set of assets. Every figure comes from the seeded book. */
export function reportFigures(ds: Dataset, period: ReportPeriod, ids: ReadonlySet<string>): ReportFigures {
  const actual = sliceDays(ds.daily, null, period.from, period.to).filter((row) => ids.has(row.assetId));
  const incidents = ds.outages
    .filter((outage) => ids.has(outage.assetId) && outage.start.slice(0, 10) <= period.to && outage.end.slice(0, 10) >= period.from)
    .sort((a, b) => a.start.localeCompare(b.start));
  const dates = eachDate(period.from, period.to);
  const days = dates.map((date) => {
    const rows = actual.filter((row) => row.date === date);
    return {
      date,
      cents: rows.reduce((sum, row) => sum + row.totalCents, 0),
      planCents: rows.reduce((sum, row) => sum + row.budgetCents, 0),
      outage: incidents.some((outage) => outage.start.slice(0, 10) <= date && outage.end.slice(0, 10) >= date),
    };
  });
  const span = calendarSpan(period);
  return {
    actual,
    metrics: rollup(actual),
    days,
    incidents,
    coveredDays: dates.length,
    calendarDays: eachDate(span.from, span.to).length,
  };
}
