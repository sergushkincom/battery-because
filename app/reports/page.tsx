import Link from "next/link";
import { DayBars, Delta } from "@/components/report-parts";
import { formatEUR, formatNumber } from "@/lib/format";
import { linkTo, loadView, tradingInPortfolio } from "@/lib/page-model";
import { REPORTS, reportFigures, reportKind, type ReportPeriod } from "@/lib/reports";
import { formatDayShort } from "@/lib/time";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ds, q } = loadView(await searchParams);
  const assets = tradingInPortfolio(ds, q.portfolio);
  const ids = new Set(assets.map((asset) => asset.id));
  const portfolio = ds.portfolios.find((item) => item.id === q.portfolio)?.name ?? "Portfolio";
  const groups: { title: string; periods: ReportPeriod[] }[] = [
    { title: "Months", periods: REPORTS.filter((period) => reportKind(period) === "month") },
    { title: "Quarters", periods: REPORTS.filter((period) => reportKind(period) === "quarter") },
  ];

  return (
    <div className="grid gap-4">
      <header className="grid gap-1">
        <p className="text-[12px] text-muted-foreground">
          {portfolio} · {assets.length} trading {assets.length === 1 ? "asset" : "assets"}
        </p>
        <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.01em]">Reports</h1>
        <p className="max-w-[68ch] text-muted-foreground">
          A month or a quarter for an investor, a board, or the internal book. Each report explains its numbers and exports as PDF or CSV on this machine.
        </p>
      </header>

      <div className="table-wrap relative">
        <table className="table-grid">
          <caption className="sr-only">Reports for {portfolio}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Window</th>
              <th scope="col">Revenue per day</th>
              <th scope="col" className="text-right">
                Revenue
              </th>
              <th scope="col" className="text-right">
                Vs plan
              </th>
              <th scope="col" className="text-right">
                Of plan
              </th>
              <th scope="col" className="text-right">
                Vs benchmark
              </th>
              <th scope="col" className="text-right">
                Availability
              </th>
              <th scope="col" className="text-right">
                Incidents
              </th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.title}>
              <tr>
                <th scope="colgroup" colSpan={9} className="bg-muted/60 text-[12px] font-medium text-muted-foreground">
                  {group.title}
                </th>
              </tr>
              {group.periods.map((period) => {
                const figures = reportFigures(ds, period, ids);
                const { metrics } = figures;
                const partial = figures.coveredDays < figures.calendarDays;
                return (
                  <tr key={period.id} className="report-row">
                    <th scope="row" className="whitespace-nowrap">
                      <Link href={linkTo(q, `/reports/${period.id}`)} className="report-link font-medium">
                        {period.label}
                      </Link>
                    </th>
                    <td className="num whitespace-nowrap text-[12px] text-muted-foreground">
                      {formatDayShort(period.from)} – {formatDayShort(period.to)}
                      {partial && ` · ${figures.coveredDays}/${figures.calendarDays} d`}
                    </td>
                    <td>
                      <DayBars days={figures.days} />
                    </td>
                    <td className="num text-right font-medium">{formatEUR(metrics.totalCents, q.locale, 0)}</td>
                    <td className="text-right">
                      <Delta cents={metrics.totalCents - metrics.planCents} locale={q.locale} />
                    </td>
                    <td className="num text-right text-muted-foreground">{metrics.planCents > 0 ? `${Math.round((metrics.totalCents / metrics.planCents) * 100)}%` : "—"}</td>
                    <td className="text-right">
                      <Delta cents={metrics.totalCents - metrics.benchmarkCents} locale={q.locale} />
                    </td>
                    <td className="num text-right">{formatNumber(metrics.availabilityPct, q.locale, 1)}%</td>
                    <td className="text-right">
                      {figures.incidents.length === 0 ? (
                        <span className="text-muted-foreground">None</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <i className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                          <span className="num">{figures.incidents.length}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <i className="legend-swatch bg-primary opacity-60" /> Revenue per day
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="legend-swatch bg-accent" /> A day with an outage
        </span>
        <span>The book runs from 22 Aug to 19 Nov 2026, so August, November and both quarters are partial.</span>
      </p>
    </div>
  );
}
