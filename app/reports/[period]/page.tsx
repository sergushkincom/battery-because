import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ReportActions } from "@/components/report-actions";
import { AudienceSwitch, DailyChart, ManagerNote } from "@/components/report-client";
import { BridgeStatement, Delta } from "@/components/report-parts";
import { explainWindow } from "@/lib/selectors";
import { formatEUR, formatMwh, formatNumber, formatSignedEUR } from "@/lib/format";
import { OUTAGE_LABEL } from "@/lib/labels";
import { findAsset, linkTo, loadView, tradingInPortfolio } from "@/lib/page-model";
import { findReport, reportFigures, reportKind } from "@/lib/reports";
import { formatDay, formatDayShort, formatStamp } from "@/lib/time";

const AUDIENCES = [
  { id: "investor", label: "Investor", lead: "Investor view: result versus plan and versus the market benchmark." },
  { id: "board", label: "Board", lead: "Board view: availability, constraints and the decisions a person had to make." },
  { id: "internal", label: "Internal", lead: "Internal view: the full bridge, including fees and the residual." },
] as const;

export default async function ReportPeriodPage({
  params,
  searchParams,
}: {
  params: Promise<{ period: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { period: periodId } = await params;
  const period = findReport(periodId);
  if (!period) notFound();
  const { ds, q } = loadView(await searchParams);
  const asset = q.asset ? findAsset(ds, q.asset) : undefined;
  const assets = asset ? [asset] : tradingInPortfolio(ds, q.portfolio);
  const ids = new Set(assets.map((item) => item.id));
  const figures = reportFigures(ds, period, ids);
  const { metrics, actual, incidents } = figures;
  const explanation = explainWindow(ds, {
    assetId: asset?.id ?? null,
    assetIds: ids,
    from: period.from,
    to: period.to,
    mode: "forecast",
    baselineLabel: "the morning forecast",
    locale: q.locale,
    focus: q.audience === "board" ? "outage" : q.audience === "internal" ? "default" : "benchmark",
  });
  const name = asset?.name ?? ds.portfolios.find((item) => item.id === q.portfolio)?.name ?? "Portfolio";
  const audience = AUDIENCES.find((item) => item.id === q.audience) ?? AUDIENCES[0];
  const partial = figures.coveredDays < figures.calendarDays;
  const planDelta = metrics.totalCents - metrics.planCents;
  const benchmarkDelta = metrics.totalCents - metrics.benchmarkCents;
  const outageDays = figures.days.filter((day) => day.outage).map((day) => formatDayShort(day.date));
  const byAsset = assets.map((item) => {
    const rows = actual.filter((row) => row.assetId === item.id);
    const cents = rows.reduce((sum, row) => sum + row.totalCents, 0);
    const plan = rows.reduce((sum, row) => sum + row.budgetCents, 0);
    return { id: item.id, name: item.name, mw: item.powerKw / 1000, cents, delta: cents - plan };
  });

  const summary = [audience.lead, explanation.headline, ...explanation.sentences.map((sentence) => sentence.text)];
  const rows = [
    { label: "Revenue", value: formatEUR(metrics.totalCents, q.locale, 0) },
    { label: "Vs plan", value: formatSignedEUR(planDelta, q.locale, 0) },
    { label: "Vs benchmark", value: formatSignedEUR(benchmarkDelta, q.locale, 0) },
    { label: "Availability", value: `${Math.round(metrics.availabilityPct)}%` },
    { label: "Cycles", value: metrics.cycles.toFixed(2) },
  ];

  return (
    <div className="paper-desk grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] text-muted-foreground">
          <Link href={linkTo(q, "/reports")} className="hover:text-foreground">
            Reports
          </Link>
          <ChevronRight size={13} aria-hidden="true" />
          <span aria-current="page" className="text-foreground">
            {period.label}
          </span>
        </nav>
        <ReportActions
          periodId={period.id}
          title={`Because — ${name} — ${period.label}`}
          meta={`${q.audience} · ${period.from} to ${period.to}`}
          summary={summary}
          rows={rows}
          csvRows={actual.map((row) => ({
            date: row.date,
            asset: row.assetId,
            revenue_eur: (row.totalCents / 100).toFixed(2),
            plan_eur: (row.budgetCents / 100).toFixed(2),
            benchmark_eur: (row.benchmarkCents / 100).toFixed(2),
            availability_pct: row.availabilityPct.toFixed(1),
          }))}
        />
      </div>

      <article className="paper" aria-labelledby="report-title">
        <header>
          <p className="paper-eyebrow">
            <span>
              {name} · {reportKind(period) === "month" ? "Monthly" : "Quarterly"} report
            </span>
            <span>
              {formatDay(period.from)} – {formatDay(period.to)}
              {partial && ` · ${figures.coveredDays} of ${figures.calendarDays} days`}
            </span>
          </p>
          <h1 id="report-title" className="paper-title">
            <span className="sr-only">{period.label}. </span>
            {period.label.split(" ")[0]}: <em>{formatEUR(metrics.totalCents, q.locale, 0)}</em>, {planVerdict(metrics.totalCents, metrics.planCents)}.
          </h1>
          <p className="paper-lede">{keepSigns(explanation.headline)}</p>
          {explanation.sentences.map((sentence) => (
            <p key={sentence.text} className="paper-lede">
              {keepSigns(sentence.text)}
            </p>
          ))}
          <AudienceSwitch
            current={audience.id}
            options={AUDIENCES.map((item) => ({ id: item.id, label: item.label, href: linkTo(q, `/reports/${period.id}`, { audience: item.id }) }))}
          />
        </header>

        <section aria-label="Key figures" className="paper-figures">
          <Figure label="Revenue" value={formatEUR(metrics.totalCents, q.locale, 0)} note={`${formatEUR(metrics.totalCents / Math.max(1, figures.coveredDays), q.locale, 0)} a day`} />
          <Figure label="Vs plan" value={<Delta cents={planDelta} locale={q.locale} className="!font-serif" />} note={`plan ${formatEUR(metrics.planCents, q.locale, 0)}`} />
          <Figure label="Vs benchmark" value={<Delta cents={benchmarkDelta} locale={q.locale} className="!font-serif" />} note={`benchmark ${formatEUR(metrics.benchmarkCents, q.locale, 0)}`} />
          <Figure
            label="Availability"
            value={`${formatNumber(metrics.availabilityPct, q.locale, 1)}%`}
            note={incidents.length === 0 ? "no outages" : `${incidents.length} ${incidents.length === 1 ? "incident" : "incidents"}`}
          />
        </section>

        <section className="paper-section" aria-labelledby="s-daily">
          <h2 id="s-daily" className="paper-h2">
            <i>01</i>Revenue per day
          </h2>
          <p className="paper-caption">
            Navy bars are revenue, the dashed line is the plan.
            {outageDays.length > 0 && ` Amber marks a day with an outage: ${outageDays.join(", ")}.`}
          </p>
          <DailyChart days={figures.days} locale={q.locale} />
        </section>

        <section className="paper-section" aria-labelledby="s-bridge">
          <h2 id="s-bridge" className="paper-h2">
            <i>02</i>From forecast to result
          </h2>
          <p className="paper-caption">The bridge from the morning forecast to actual revenue, read as a statement.</p>
          <BridgeStatement
            openLabel="Morning forecast"
            openCents={explanation.baselineCents}
            closeLabel="Actual revenue"
            closeCents={explanation.actualCents}
            locale={q.locale}
            rows={explanation.bridge.filter((row) => row.cents !== 0).map((row) => ({ key: row.label, label: row.label, cents: row.cents }))}
          />
        </section>

        <section className="paper-section" aria-labelledby="s-assets">
          <h2 id="s-assets" className="paper-h2">
            <i>03</i>Assets and availability
          </h2>
          <p className="paper-caption">Revenue by asset against its plan, then every outage in the period.</p>
          <table className="statement">
            <caption className="sr-only">Revenue by asset and incidents</caption>
            <tbody>
              {byAsset.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    {row.name} <span className="text-[12px] text-muted-foreground">{formatNumber(row.mw, q.locale, 0)} MW</span>
                  </th>
                  <td>{formatEUR(row.cents, q.locale, 0)}</td>
                  <td className="w-28">
                    <Delta cents={row.delta} locale={q.locale} />
                  </td>
                </tr>
              ))}
              {incidents.map((incident) => {
                const where = ds.assets.find((item) => item.id === incident.assetId);
                const zone = where?.timezone ?? "Europe/Berlin";
                return (
                  <tr key={`${incident.assetId}-${incident.start}`}>
                    <td colSpan={3} className="quiet">
                      <span className="mr-2 inline-block size-1.5 -translate-y-px rounded-full bg-accent" aria-hidden="true" />
                      {OUTAGE_LABEL[incident.reason]} at {where?.name}, {formatStamp(incident.start, zone)} – {formatStamp(incident.end, zone)}, {formatNumber(incident.lostKw / 1000, q.locale, 1)} MW.
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={3} className="quiet">
                  {incidents.length === 0 && "No outages in this period. "}
                  {formatNumber(metrics.cycles, q.locale, 2)} cycles a day on average, {formatMwh(metrics.dischargedMwh)} discharged.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="paper-section">
          <ManagerNote periodId={period.id} />
        </section>

        <footer className="paper-footer">
          <span>{audience.lead}</span>
          <span>Seeded demo book · Because</span>
        </footer>
      </article>
    </div>
  );
}

/** Keep a sign with its amount: "+€88,391" must not break after the "+". */
function keepSigns(text: string): string {
  return text.replace(/([+\u2212\-–])(€)/g, "$1\u2060$2");
}

function planVerdict(totalCents: number, planCents: number): string {
  if (planCents <= 0) return "no plan set";
  const pct = Math.round((totalCents / planCents - 1) * 100);
  if (pct < 0) return `${-pct}% under plan`;
  if (pct > 0) return `${pct}% over plan`;
  return "on plan";
}

function Figure({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div>
      <p className="paper-label">{label}</p>
      <p className="paper-figure">{value}</p>
      <p className="text-[12px] text-muted-foreground">{note}</p>
    </div>
  );
}
