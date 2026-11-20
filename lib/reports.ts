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
