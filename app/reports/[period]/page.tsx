import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportActions } from "@/components/report-actions";
import { WaterfallChart } from "@/components/charts";
import { rollup } from "@/lib/explain";
import { explainWindow } from "@/lib/selectors";
import { formatEUR, formatSignedEUR } from "@/lib/format";
import { findAsset, linkTo, loadView, tradingInPortfolio } from "@/lib/page-model";
import { findReport } from "@/lib/reports";
import { sliceDays } from "@/lib/selectors";

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
  const ids = new Set((asset ? [asset] : tradingInPortfolio(ds, q.portfolio)).map((item) => item.id));
  const actual = sliceDays(ds.daily, asset?.id ?? null, period.from, period.to).filter((row) => ids.has(row.assetId));
  const metrics = rollup(actual);
  const explanation = explainWindow(ds, {
    assetId: asset?.id ?? null,
    from: period.from,
    to: period.to,
    mode: "forecast",
    baselineLabel: "the morning forecast",
    locale: q.locale,
    focus: q.audience === "board" ? "outage" : q.audience === "internal" ? "default" : "benchmark",
  });
  const name = asset?.name ?? (ds.portfolios.find((item) => item.id === q.portfolio)?.name ?? "Portfolio");
  const audienceLead =
    q.audience === "board"
      ? "Board view: availability, constraints and the decisions a person had to make."
      : q.audience === "internal"
        ? "Internal view: the full bridge, including fees and the residual."
        : "Investor view: result versus plan and versus the market benchmark.";
  const summary = [audienceLead, explanation.headline, ...explanation.sentences.map((sentence) => sentence.text)];
  const rows = [
    { label: "Revenue", value: formatEUR(metrics.totalCents, q.locale, 0) },
    { label: "Vs plan", value: formatSignedEUR(metrics.totalCents - metrics.planCents, q.locale, 0) },
    { label: "Vs benchmark", value: formatSignedEUR(metrics.totalCents - metrics.benchmarkCents, q.locale, 0) },
    { label: "Availability", value: `${Math.round(metrics.availabilityPct)}%` },
    { label: "Cycles", value: metrics.cycles.toFixed(2) },
  ];
  const incidents = ds.outages.filter((outage) => ids.has(outage.assetId) && outage.start.slice(0, 10) <= period.to && outage.end.slice(0, 10) >= period.from);

  return (
    <div className="grid gap-4">
      <header>
        <p className="text-[12px] text-muted-foreground">{name}</p>
        <h1 className="page-title">{period.label}</h1>
        <p>{audienceLead}</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {(["investor", "board", "internal"] as const).map((audience) => (
          <Link key={audience} href={linkTo(q, `/reports/${period.id}`, { audience })} className={q.audience === audience ? "font-medium text-primary" : "text-muted-foreground"}>
            {audience}
          </Link>
        ))}
      </div>
      <article className="card p-5">
        <h2 className="section-title">{explanation.headline}</h2>
        <ul className="mt-2 grid gap-2">
          {explanation.sentences.map((sentence) => (
            <li key={sentence.text}>{sentence.text}</li>
          ))}
        </ul>
        <dl className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-[11px] text-muted-foreground">{row.label}</dt>
              <dd className="num">{row.value}</dd>
            </div>
          ))}
        </dl>
      </article>
      <article className="card p-5">
        <h2 className="section-title mb-3">Bridge versus the morning forecast</h2>
        <WaterfallChart
          locale={q.locale}
          rows={[
            { label: "Forecast", cents: explanation.baselineCents, total: true },
            ...explanation.bridge.filter((row) => row.cents !== 0),
            { label: "Actual", cents: explanation.actualCents, total: true },
          ]}
        />
      </article>
      <article className="card p-5">
        <h2 className="section-title">Availability and incidents</h2>
        {incidents.length === 0 && <p className="mt-2 text-muted-foreground">No outages in this period.</p>}
        <ul className="mt-2 grid gap-1">
          {incidents.map((incident) => (
            <li key={incident.start}>
              {ds.assets.find((item) => item.id === incident.assetId)?.name}: {incident.reason.replaceAll("_", " ")}, {incident.lostKw / 1000} MW.
            </li>
          ))}
        </ul>
      </article>
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
  );
}
