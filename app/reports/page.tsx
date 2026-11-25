import Link from "next/link";
import { DayBars, Delta } from "@/components/report-parts";
import { formatEUR, formatNumber } from "@/lib/format";
import { linkTo, loadView, tradingInPortfolio } from "@/lib/page-model";
import {
  REPORTS,
  reportFigures,
  reportKind,
  type ReportPeriod,
} from "@/lib/reports";
import { formatDayShort } from "@/lib/time";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ds, q } = loadView(await searchParams);
  const assets = tradingInPortfolio(ds, q.portfolio);
  const ids = new Set(assets.map((asset) => asset.id));
  const portfolio =
    ds.portfolios.find((item) => item.id === q.portfolio)?.name ?? "Portfolio";
  const groups: { title: string; periods: ReportPeriod[] }[] = [
    {
      title: "Months",
      periods: REPORTS.filter((period) => reportKind(period) === "month"),
    },
    {
      title: "Quarters",
      periods: REPORTS.filter((period) => reportKind(period) === "quarter"),
    },
  ];

  return (
    <div className="paper-desk">
      <article className="paper" aria-labelledby="reports-title">
        <header>
          <p className="paper-eyebrow">
            <span>{portfolio} · Reports</span>
            <span>
              {assets.length} trading {assets.length === 1 ? "asset" : "assets"}{" "}
              · book 22 Aug – 19 Nov 2026
            </span>
          </p>
          <h1 id="reports-title" className="paper-title">
            Reports
          </h1>
          <p className="paper-lede">
            A month or a quarter for an investor, a board, or the internal book.
            Each report explains its numbers and exports as PDF or CSV on this
            machine.
          </p>
        </header>

        <div className="relative -mx-1 mt-8 overflow-x-auto px-1">
          <table className="table-grid report-table">
            <caption className="sr-only">Reports for {portfolio}</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Per day</th>
                <th scope="col" className="text-right">
                  Revenue
                </th>
                <th scope="col" className="text-right">
                  Vs plan
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
                <tr className="report-group">
                  <th
                    scope="colgroup"
                    colSpan={7}
                    className="!bg-transparent !pt-6 font-serif !text-[17px] !font-medium !text-foreground"
                  >
                    {group.title}
                  </th>
                </tr>
                {group.periods.map((period) => {
                  const figures = reportFigures(ds, period, ids);
                  const { metrics } = figures;
                  const partial = figures.coveredDays < figures.calendarDays;
                  const planPct =
                    metrics.planCents > 0
                      ? Math.round(
                          (metrics.totalCents / metrics.planCents) * 100,
                        )
                      : null;
                  return (
                    <tr key={period.id} className="report-row">
                      <th scope="row">
                        <Link
                          href={linkTo(q, `/reports/${period.id}`)}
                          className="report-link font-medium"
                        >
                          {period.label}
                        </Link>
                        <span className="num mt-0.5 block text-[11px] text-muted-foreground">
                          {formatDayShort(period.from)} –{" "}
                          {formatDayShort(period.to)}
                          {partial && (
                            <span className="ml-1.5">
                              · {figures.coveredDays} of {figures.calendarDays}{" "}
                              days
                            </span>
                          )}
                        </span>
                      </th>
                      <td>
                        <DayBars days={figures.days} />
                      </td>
                      <td className="num text-right font-medium">
                        {formatEUR(metrics.totalCents, q.locale, 0)}
                      </td>
                      <td className="text-right">
                        <Delta
                          cents={metrics.totalCents - metrics.planCents}
                          locale={q.locale}
                        />
                        {planPct !== null && (
                          <span className="num block text-[11px] text-muted-foreground">
                            {planPct}% of plan
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <Delta
                          cents={metrics.totalCents - metrics.benchmarkCents}
                          locale={q.locale}
                        />
                      </td>
                      <td className="num text-right">
                        {formatNumber(metrics.availabilityPct, q.locale, 1)}%
                      </td>
                      <td className="text-right">
                        {figures.incidents.length === 0 ? (
                          <span className="text-muted-foreground">None</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <i
                              className="size-1.5 rounded-full bg-accent"
                              aria-hidden="true"
                            />
                            <span className="num">
                              {figures.incidents.length}
                            </span>
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
        <p className="paper-footer items-center !justify-start gap-x-4">
          <span className="inline-flex items-center gap-1.5">
            <i className="legend-swatch bg-[var(--series-da)] opacity-60" />{" "}
            Revenue per day
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="legend-swatch bg-accent" /> A day with an outage
          </span>
          <span>
            The book runs from 22 Aug to 19 Nov 2026, so August, November and
            both quarters are partial.
          </span>
        </p>
      </article>
    </div>
  );
}
