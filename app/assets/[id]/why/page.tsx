import Link from "next/link";
import { AssetTabs } from "@/components/asset-tabs";
import { notFound } from "next/navigation";
import { WaterfallChart } from "@/components/charts";
import { QuestionBox } from "@/components/question-box";
import { BRIDGE_METHOD, explain } from "@/lib/explain";
import { formatEUR } from "@/lib/format";
import { matchIntent, SUGGESTED } from "@/lib/intents";
import { findAsset, linkTo, loadView } from "@/lib/page-model";
import { sliceDays } from "@/lib/selectors";
import { addDays } from "@/lib/time";

export default async function WhyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { ds, q } = loadView(await searchParams);
  const asset = findAsset(ds, id);
  if (!asset) notFound();
  const intent = q.q ? matchIntent(q.q) : null;
  const unknown = Boolean(q.q && !intent);
  const from = intent?.from ?? q.from ?? addDays("2026-11-19", -6);
  const to = intent?.to ?? q.to ?? "2026-11-19";
  const compare = intent?.compare ?? q.compare ?? "previous";
  const focus = (intent?.focus ?? q.focus ?? "default") as "default" | "afrr" | "outage" | "benchmark";
  const actual = sliceDays(ds.daily, asset.id, from, to, false);
  const len = actual.length || 1;
  const baseline =
    compare === "forecast"
      ? sliceDays(ds.forecastDaily, asset.id, from, to, false)
      : sliceDays(ds.daily, asset.id, addDays(from, -len), addDays(from, -1), false);
  const explanation = explain({
    assetId: asset.id,
    assetName: asset.name,
    actual: actual.filter((row) => row.trading),
    baseline: baseline.filter((row) => row.trading),
    baselineLabel: compare === "forecast" ? "the morning forecast" : "the previous window",
    weather: ds.weatherDaily,
    country: asset.country,
    outages: ds.outages,
    planCents: actual.reduce((sum, row) => sum + row.budgetCents, 0),
    benchmarkCents: actual.reduce((sum, row) => sum + row.benchmarkCents, 0),
    locale: q.locale,
    focus,
  });
  const waterfall = [
    { label: "Baseline", cents: explanation.baselineCents, total: true },
    ...explanation.bridge.filter((row) => row.cents !== 0),
    { label: "Actual", cents: explanation.actualCents, total: true },
  ];

  return (
    <div className="grid gap-4">
      <header>
        <p className="eyebrow">{asset.name}</p>
        <h1 className="page-title">Why revenue changed</h1>
        <p className="text-muted-foreground">
          {from} to {to}, compared with {compare === "forecast" ? "the morning forecast" : "the previous window"}.
        </p>
      </header>
      <AssetTabs assetId={asset.id} active="why" href={(path) => linkTo(q, path)} />
      <p className="text-[12px] text-muted-foreground">{to === "2026-11-19" ? "Data delayed — last telemetry 14:05" : "Settled"}</p>
      {asset.id === "tajo-sur" ? (
        <section className="card p-5">
          <h2 className="section-title">No revenue to explain yet</h2>
          <p>Tajo Sur is not trading. The bridge starts once control is handed over.</p>
        </section>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
          <article className="card p-5">
            <h2 className="mb-3 section-title">Revenue bridge</h2>
            <WaterfallChart rows={waterfall} locale={q.locale} animated />
          </article>
          <article className="card p-5">
            <h2 className="section-title">{explanation.headline}</h2>
            <ul className="mt-3 grid gap-2">
              {explanation.sentences.map((sentence) => (
                <li key={sentence.text}>
                  {sentence.text}{" "}
                  <Link className="link" href={linkTo(q, `/assets/${sentence.evidence.assetId === "portfolio" ? asset.id : sentence.evidence.assetId}`, { date: sentence.evidence.from })}>
                    Show on the timeline
                  </Link>
                </li>
              ))}
            </ul>
            <details className="mt-4">
              <summary className="cursor-pointer font-medium">How we computed this</summary>
              <ul className="mt-2 grid gap-2 text-[12px] text-muted-foreground">
                {BRIDGE_METHOD.map((row) => (
                  <li key={row.label}>
                    <span className="text-foreground">{row.label}.</span> {row.formula}
                  </li>
                ))}
              </ul>
              <table className="table-grid mt-3">
                <tbody>
                  {explanation.inputs.map((input) => (
                    <tr key={input.label}>
                      <th scope="row" className="bg-transparent font-normal">
                        {input.label}
                      </th>
                      <td className="num">{input.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </article>
        </div>
      )}
      <section className="card p-5">
        <h2 className="section-title">Ask a supported question</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTED.map((item) => (
            <Link
              key={item.title}
              className="inline-flex h-8 items-center rounded-full border border-border-strong bg-surface px-3 hover:border-primary hover:text-primary"
              href={linkTo(q, `/assets/${asset.id}/why`, { from: item.from, to: item.to, compare: item.compare, focus: item.focus, q: null })}
            >
              {item.title}
            </Link>
          ))}
        </div>
        <QuestionBox action={`/assets/${asset.id}/why`} hidden={{ role: q.role, portfolio: q.portfolio, period: q.period, loc: q.locale }} />
        {unknown && <p className="mt-2 text-muted-foreground">This prototype answers the suggested questions. Try one of them.</p>}
        {intent && <p className="mt-2">Showing: {intent.title}. Bridge total change {formatEUR(explanation.deltaCents, q.locale, 0)}.</p>}
      </section>
    </div>
  );
}
