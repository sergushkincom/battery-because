import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ReportActions } from "@/components/report-actions";
import { AudienceSwitch, DailyChart, ManagerNote } from "@/components/report-client";
import { BridgeTable, Delta } from "@/components/report-parts";
import { explainWindow } from "@/lib/selectors";
import { formatEUR, formatMwh, formatNumber, formatSignedEUR } from "@/lib/format";
import { OUTAGE_LABEL } from "@/lib/labels";
import { findAsset, linkTo, loadView, tradingInPortfolio } from "@/lib/page-model";
import { findReport, reportFigures } from "@/lib/reports";
import { formatDayShort, formatStamp } from "@/lib/time";

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
    <div className="grid gap-4">
      <header className="grid gap-1">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-muted-foreground">
          <Link href={linkTo(q, "/reports")} className="hover:text-foreground">
            Reports
          </Link>
          <ChevronRight size={12} aria-hidden="true" />
          <span>{name}</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="grid gap-1">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.01em]">{period.label}</h1>
            <p className="text-muted-foreground">
              <span className="num">
                {formatDayShort(period.from)} – {formatDayShort(period.to)}
              </span>
              {partial && ` · ${figures.coveredDays} of ${figures.calendarDays} days`} · {assets.length} {assets.length === 1 ? "asset" : "assets"}
            </p>
          </div>
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
      </header>

      <div className="grid gap-2">
        <AudienceSwitch
          current={audience.id}
          options={AUDIENCES.map((item) => ({ id: item.id, label: item.label, href: linkTo(q, `/reports/${period.id}`, { audience: item.id }) }))}
        />
        <p className="text-[12px] text-muted-foreground">{audience.lead}</p>
      </div>

      <section aria-label="Key figures" className="card grid grid-cols-2 lg:grid-cols-4">
        <Kpi label="Revenue" value={formatEUR(metrics.totalCents, q.locale, 0)} note={`${formatEUR(metrics.totalCents / Math.max(1, figures.coveredDays), q.locale, 0)} a day`} />
        <Kpi label="Vs plan" value={<Delta cents={planDelta} locale={q.locale} />} note={`${planShare(metrics.totalCents, metrics.planCents)} of ${formatEUR(metrics.planCents, q.locale, 0)}`} />
        <Kpi label="Vs benchmark" value={<Delta cents={benchmarkDelta} locale={q.locale} />} note={`benchmark ${formatEUR(metrics.benchmarkCents, q.locale, 0)}`} />
        <Kpi
          label="Availability"
          value={`${formatNumber(metrics.availabilityPct, q.locale, 1)}%`}
          note={incidents.length === 0 ? "no outages" : `${incidents.length} ${incidents.length === 1 ? "incident" : "incidents"}`}
        />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <section className="card p-4" aria-labelledby="daily-title">
            <h2 id="daily-title" className="item-title mb-2">
              Revenue per day
            </h2>
            <DailyChart days={figures.days} locale={q.locale} />
          </section>

          <section className="card overflow-hidden" aria-labelledby="bridge-title">
            <div className="flex items-baseline justify-between gap-3 px-4 py-3">
              <h2 id="bridge-title" className="item-title">
                Bridge
              </h2>
              <span className="text-[12px] text-muted-foreground">morning forecast → actual</span>
            </div>
            <BridgeTable
              openLabel="Morning forecast"
              openCents={explanation.baselineCents}
              closeLabel="Actual revenue"
              closeCents={explanation.actualCents}
              locale={q.locale}
              rows={explanation.bridge.filter((row) => row.cents !== 0).map((row) => ({ key: row.label, label: row.label, cents: row.cents }))}
            />
          </section>
        </div>

        <aside className="grid gap-4">
          <section className="card p-4" aria-labelledby="summary-title">
            <h2 id="summary-title" className="label">
              Summary
            </h2>
            <p className="item-title mt-1">{keepSigns(explanation.headline)}</p>
            <ul className="mt-2 grid gap-2 text-muted-foreground">
              {explanation.sentences.map((sentence) => (
                <li key={sentence.text}>{keepSigns(sentence.text)}</li>
              ))}
            </ul>
          </section>

          <section className="card overflow-hidden" aria-labelledby="assets-title">
            <div className="flex items-baseline justify-between gap-3 px-4 py-3">
              <h2 id="assets-title" className="item-title">
                Assets
              </h2>
              <span className="text-[12px] text-muted-foreground">
                {formatNumber(metrics.cycles, q.locale, 2)} cycles a day · {formatMwh(metrics.dischargedMwh)}
              </span>
            </div>
            <table className="table-grid">
              <caption className="sr-only">Revenue by asset against plan</caption>
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col" className="text-right">
                    Revenue
                  </th>
                  <th scope="col" className="text-right">
                    Vs plan
                  </th>
                </tr>
              </thead>
              <tbody>
                {byAsset.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      {row.name} <span className="text-[12px] text-muted-foreground">{formatNumber(row.mw, q.locale, 0)} MW</span>
                    </th>
                    <td className="num text-right">{formatEUR(row.cents, q.locale, 0)}</td>
                    <td className="text-right">
                      <Delta cents={row.delta} locale={q.locale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card p-4" aria-labelledby="incidents-title">
            <h2 id="incidents-title" className="item-title">
              Incidents
            </h2>
            {incidents.length === 0 ? (
              <p className="mt-1 text-muted-foreground">No outages in this period.</p>
            ) : (
              <ul className="mt-2 grid gap-2">
                {incidents.map((incident) => {
                  const where = ds.assets.find((item) => item.id === incident.assetId);
                  const zone = where?.timezone ?? "Europe/Berlin";
                  return (
                    <li key={`${incident.assetId}-${incident.start}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="inline-flex h-5 items-center gap-1 rounded-full bg-accent-soft px-2 text-[12px] font-medium text-needs">
                        <i className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                        {OUTAGE_LABEL[incident.reason]}
                      </span>
                      <span className="text-muted-foreground">
                        {where?.name} · <span className="num">{formatStamp(incident.start, zone)} – {formatStamp(incident.end, zone)}</span> · {formatNumber(incident.lostKw / 1000, q.locale, 1)} MW
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card p-4">
            <ManagerNote periodId={period.id} />
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Keep a sign with its amount: "+€88,391" must not break after the "+". */
function keepSigns(text: string): string {
  return text.replace(/([+\u2212\-–])(€)/g, "$1\u2060$2");
}

function planShare(totalCents: number, planCents: number): string {
  return planCents > 0 ? `${Math.round((totalCents / planCents) * 100)}%` : "—";
}

function Kpi({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="kpi-cell grid content-start gap-1 p-4">
      <p className="label">{label}</p>
      <p className="num text-[24px] font-medium leading-8 tracking-[-0.02em]">{value}</p>
      <p className="text-[12px] text-muted-foreground">{note}</p>
    </div>
  );
}
