import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ReportActions } from "@/components/report-actions";
import { AudienceSwitch, DailyChart, ManagerNote } from "@/components/report-client";
import { BridgeLedger, Delta } from "@/components/report-parts";
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
  const planPct = metrics.planCents > 0 ? Math.round((metrics.totalCents / metrics.planCents) * 100) : null;

  const summary = [audience.lead, explanation.headline, ...explanation.sentences.map((sentence) => sentence.text)];
  const rows = [
    { label: "Revenue", value: formatEUR(metrics.totalCents, q.locale, 0) },
    { label: "Vs plan", value: formatSignedEUR(planDelta, q.locale, 0) },
    { label: "Vs benchmark", value: formatSignedEUR(benchmarkDelta, q.locale, 0) },
    { label: "Availability", value: `${Math.round(metrics.availabilityPct)}%` },
    { label: "Cycles", value: metrics.cycles.toFixed(2) },
  ];

  return (
    <div className="grid gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-muted-foreground">
        <Link href={linkTo(q, "/reports")} className="hover:text-foreground">
          Reports
        </Link>
        <ChevronRight size={12} aria-hidden="true" />
        <span aria-current="page" className="text-foreground">
          {period.label}
        </span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="grid gap-1">
          <p className="eyebrow">
            {name} · <span className="num">{formatDayShort(period.from)} – {formatDayShort(period.to)}</span>
            {partial && (
              <>
                {" "}
                · <span className="num">{figures.coveredDays}</span> of <span className="num">{figures.calendarDays}</span> days
              </>
            )}
          </p>
          <h1 className="page-title">{period.label}</h1>
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
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <AudienceSwitch
          current={audience.id}
          options={AUDIENCES.map((item) => ({ id: item.id, label: item.label, href: linkTo(q, `/reports/${period.id}`, { audience: item.id }) }))}
        />
        <p className="text-muted-foreground">{audience.lead}</p>
      </div>

      <section aria-label="Key figures" className="card kpi-strip grid grid-cols-2 md:grid-cols-5">
        <Kpi label="Revenue" value={formatEUR(metrics.totalCents, q.locale, 0)} note={<>{formatEUR(metrics.totalCents / Math.max(1, figures.coveredDays), q.locale, 0)} a day</>} />
        <Kpi
          label="Vs plan"
          value={<Delta cents={planDelta} locale={q.locale} />}
          note={
            <>
              Plan {formatEUR(metrics.planCents, q.locale, 0)}
              {planPct !== null && <> · {planPct}%</>}
            </>
          }
        />
        <Kpi label="Vs benchmark" value={<Delta cents={benchmarkDelta} locale={q.locale} />} note={<>Benchmark {formatEUR(metrics.benchmarkCents, q.locale, 0)}</>} />
        <Kpi
          label="Availability"
          value={`${formatNumber(metrics.availabilityPct, q.locale, 1)}%`}
          note={incidents.length === 0 ? "No outages" : `${incidents.length} ${incidents.length === 1 ? "incident" : "incidents"}`}
        />
        <Kpi label="Cycles a day" value={formatNumber(metrics.cycles, q.locale, 2)} note={<>Discharged {formatMwh(metrics.dischargedMwh)}</>} />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <div className="grid gap-4">
          <section className="card p-5" aria-labelledby="daily-title">
            <h2 id="daily-title" className="section-title mb-3">
              Revenue per day
            </h2>
            <DailyChart days={figures.days} locale={q.locale} />
          </section>

          <section className="card p-5" aria-labelledby="bridge-title">
            <div className="mb-3 grid gap-0.5">
              <h2 id="bridge-title" className="section-title">
                What moved revenue
              </h2>
              <p className="text-[12px] text-muted-foreground">Bridge from the morning forecast to the actual result. Each driver is drawn on the same scale.</p>
            </div>
            <BridgeLedger
              baselineLabel="Forecast"
              baselineCents={explanation.baselineCents}
              actualCents={explanation.actualCents}
              locale={q.locale}
              rows={explanation.bridge.filter((row) => row.cents !== 0).map((row) => ({ key: row.label, label: row.label, cents: row.cents }))}
            />
          </section>
        </div>

        <aside className="grid gap-4">
          <section className="card p-5" aria-labelledby="summary-title">
            <h2 id="summary-title" className="label mb-2">
              Summary
            </h2>
            <p className="item-title">{explanation.headline}</p>
            <ul className="summary-list mt-3 grid gap-2.5">
              {explanation.sentences.map((sentence) => (
                <li key={sentence.text}>{sentence.text}</li>
              ))}
            </ul>
          </section>

          <section className="card p-5" aria-labelledby="incidents-title">
            <h2 id="incidents-title" className="section-title mb-2">
              Availability and incidents
            </h2>
            {incidents.length === 0 ? (
              <p className="text-muted-foreground">No outages in this period.</p>
            ) : (
              <ul className="divide-y divide-border">
                {incidents.map((incident) => {
                  const where = ds.assets.find((item) => item.id === incident.assetId);
                  const zone = where?.timezone ?? "Europe/Berlin";
                  return (
                    <li key={`${incident.assetId}-${incident.start}`} className="grid gap-0.5 py-2.5 first:pt-0 last:pb-0">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <i className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                          {OUTAGE_LABEL[incident.reason]}
                        </span>
                        <span className="num text-[12px]">{formatNumber(incident.lostKw / 1000, q.locale, 1)} MW</span>
                      </span>
                      <span className="pl-3.5 text-[12px] text-muted-foreground">
                        {where?.name} · <span className="num">{formatStamp(incident.start, zone)} – {formatStamp(incident.end, zone)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <ManagerNote periodId={period.id} />
          </section>
        </aside>
      </div>
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: React.ReactNode; note: React.ReactNode }) {
  return (
    <div className="kpi-cell grid content-start gap-1 px-5 py-4">
      <p className="label">{label}</p>
      <p className="num text-[22px] font-medium leading-[28px] tracking-[-0.02em]">{value}</p>
      <p className="num text-[12px] text-muted-foreground">{note}</p>
    </div>
  );
}
