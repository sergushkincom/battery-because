import Link from "next/link";
import { AssetTable } from "@/components/asset-table";
import { StackedMarkets } from "@/components/charts";
import { StateChip } from "@/components/state-chip";
import { formatEUR, formatNumber, formatPct, formatSignedEUR } from "@/lib/format";
import { marketPosition } from "@/lib/explain";
import { POSITION_LABEL } from "@/lib/labels";
import { loadView, linkTo, portfolioExplain, tradingInPortfolio } from "@/lib/page-model";
import { rollup } from "@/lib/explain";
import { DEMO_TODAY } from "@/lib/time";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ds, q } = loadView(await searchParams);
  const view = portfolioExplain(ds, q);
  const metrics = rollup(view.actual);
  const position = marketPosition(metrics.totalCents, metrics.benchmarkCents);
  const mw = tradingInPortfolio(ds, q.portfolio).reduce((sum, asset) => sum + asset.powerKw, 0) / 1000;
  const days = Math.max(1, view.actual.length / Math.max(1, tradingInPortfolio(ds, q.portfolio).length));
  const perMwYear = mw > 0 ? (metrics.totalCents / 100 / mw) * (365 / days) : 0;
  const vsPlan = metrics.planCents ? ((metrics.totalCents - metrics.planCents) / Math.abs(metrics.planCents)) * 100 : 0;
  const charged = view.actual.reduce((sum, row) => sum + row.chargedMwh, 0);
  const pending = ds.approvals.filter(
    (item) => item.state === "pending" && tradingInPortfolio(ds, q.portfolio).some((asset) => asset.id === item.assetId),
  ).length;
  const reason = view.explanation.sentences[0]?.text ?? view.explanation.headline;
  const portfolio = ds.portfolios.find((item) => item.id === q.portfolio) ?? ds.portfolios[0];
  const series = groupByDate(view.actual).map((row) => ({
    label: row.date.slice(5),
    DA: row.DA / 100,
    ID: row.ID / 100,
    AFRR_CAP: row.AFRR_CAP / 100,
    AFRR_ENERGY: row.AFRR_ENERGY / 100,
    FCR: row.FCR / 100,
    IMBALANCE: row.IMBALANCE / 100,
  }));
  const countries = new Map<string, { mw: number; cents: number; live: number }>();
  for (const row of view.rows) {
    const current = countries.get(row.asset.country) ?? { mw: 0, cents: 0, live: 0 };
    current.mw += row.asset.powerKw / 1000;
    current.cents += row.metrics.totalCents;
    if (row.trading) current.live += 1;
    countries.set(row.asset.country, current);
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{portfolio.ownerName}</p>
          <h1 className="page-title">{portfolio.name}</h1>
          <p className="text-[13px] text-muted-foreground">
            {view.window.label} · {view.window.from} to {view.window.to}
          </p>
        </div>
        <DataLine today={view.window.to === DEMO_TODAY} />
      </header>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" aria-label="Portfolio figures">
        <Kpi label="Revenue" value={formatEUR(metrics.totalCents, q.locale, 0)} meta={`${formatNumber(perMwYear, q.locale, 0)} €/MW/yr`} reason={view.explanation.headline} />
        <Kpi
          label="Vs plan"
          value={formatSignedEUR(metrics.totalCents - metrics.planCents, q.locale, 0)}
          meta={formatPct(vsPlan)}
          tone={vsPlan >= 0 ? "up" : "down"}
          reason={reason}
        />
        <Kpi
          label="Vs market"
          value={formatSignedEUR(metrics.totalCents - metrics.benchmarkCents, q.locale, 0)}
          meta={POSITION_LABEL[position]}
          tone={position === "below" ? "down" : position === "above" ? "up" : "flat"}
          reason="Benchmark is a same-size battery with perfect hindsight, then 80%."
        />
        <Kpi
          label="Energy"
          value={`${formatNumber(metrics.dischargedMwh, q.locale, 0)} MWh`}
          meta={`${formatNumber(charged, q.locale, 0)} MWh charged`}
          reason={`Availability ${Math.round(metrics.availabilityPct)}% · ${metrics.cycles.toFixed(1)} cycles on average.`}
        />
        <Kpi
          label="Open decisions"
          value={String(pending)}
          meta={pending ? "Needs a decision" : "System running"}
          tone={pending ? "attention" : "flat"}
          reason={pending ? "A cycle-budget request is waiting on a person." : "Nothing is waiting on a person in this portfolio."}
        />
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <article className="card p-5">
          <h2 className="section-title">Revenue by market</h2>
          <p className="mb-3 text-[12px] text-muted-foreground">Euros per day. Imbalance can sit below zero.</p>
          <StackedMarkets rows={series} />
        </article>
        <article className="card p-5">
          <h2 className="section-title">By country</h2>
          <ul className="mt-3 divide-y divide-border">
            {[...countries.entries()].map(([country, item]) => (
              <li key={country} className="flex items-baseline justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{country}</span>
                  <span className="ml-2 text-[12px] text-muted-foreground">{formatNumber(item.mw, q.locale, 0)} MW</span>
                </span>
                <span className="num">{formatEUR(item.cents, q.locale, 0)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Tajo Sur is not in the totals.{" "}
            <Link className="link" href={linkTo(q, "/assets/tajo-sur/journey")}>
              See where it is in go-live.
            </Link>
          </p>
        </article>
      </section>
      <section>
        <h2 className="section-title mb-3">Assets</h2>
        <AssetTable
          locale={q.locale}
          rows={view.rows.map((row) => ({
            id: row.asset.id,
            name: row.asset.name,
            country: row.asset.country,
            mw: row.asset.powerKw / 1000,
            mwh: row.asset.energyKwh / 1000,
            revenueCents: row.metrics.totalCents,
            planCents: row.metrics.planCents,
            state: row.state,
            position: row.position,
            availability: row.metrics.availabilityPct,
            attention: attentionFor(ds, row.asset.id, row.state),
            href: linkTo(q, `/assets/${row.asset.id}`, { date: view.window.to === DEMO_TODAY ? addDaysSafe(DEMO_TODAY) : view.window.to }),
          }))}
        />
      </section>
      <NotifyNote role={q.role} />
      <span className="sr-only">
        <StateChip>Portfolio</StateChip>
      </span>
    </div>
  );
}

function addDaysSafe(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().slice(0, 10);
}

function attentionFor(ds: ReturnType<typeof loadView>["ds"], assetId: string, state: string): string {
  const pending = ds.approvals.find((item) => item.assetId === assetId && item.state === "pending");
  if (pending) return "Needs a decision";
  if (state === "not_live") return "Prequalification blocked";
  if (state === "below_availability") return "Availability is the reason";
  const latest = ds.audit.find((item) => item.assetId === assetId);
  return latest ? `System · ${latest.summary}` : "System";
}

function groupByDate(rows: ReturnType<typeof portfolioExplain>["actual"]) {
  const map = new Map<string, { date: string; DA: number; ID: number; AFRR_CAP: number; AFRR_ENERGY: number; FCR: number; IMBALANCE: number }>();
  for (const row of rows) {
    const current = map.get(row.date) ?? { date: row.date, DA: 0, ID: 0, AFRR_CAP: 0, AFRR_ENERGY: 0, FCR: 0, IMBALANCE: 0 };
    current.DA += row.byMarketCents.DA;
    current.ID += row.byMarketCents.ID;
    current.AFRR_CAP += row.byMarketCents.AFRR_CAP;
    current.AFRR_ENERGY += row.byMarketCents.AFRR_ENERGY;
    current.FCR += row.byMarketCents.FCR;
    current.IMBALANCE += row.byMarketCents.IMBALANCE;
    map.set(row.date, current);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function Kpi({
  label,
  value,
  meta,
  reason,
  tone = "flat",
}: {
  label: string;
  value: string;
  meta: string;
  reason: string;
  tone?: "up" | "down" | "flat" | "attention";
}) {
  const metaClass = tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "attention" ? "text-needs" : "text-muted-foreground";
  return (
    <article className="card flex flex-col px-4 py-4">
      <h2 className="label">{label}</h2>
      <p className="num mt-2 text-[26px] font-medium leading-[30px] tracking-[-0.02em]">{value}</p>
      <p className={`num mt-1 text-[12px] font-medium ${metaClass}`}>{meta}</p>
      <p className="mt-3 line-clamp-3 border-t border-border pt-3 text-[12px] leading-[18px] text-muted-foreground">{reason}</p>
    </article>
  );
}

function DataLine({ today }: { today: boolean }) {
  return (
    <p className={`inline-flex items-center gap-1.5 text-[12px] ${today ? "text-needs" : "text-muted-foreground"}`}>
      <span className={`size-1.5 rounded-full ${today ? "bg-accent" : "bg-up"}`} aria-hidden="true" />
      {today ? "Data delayed — last telemetry 14:05" : "Settled"}
    </p>
  );
}

function NotifyNote({ role }: { role: string }) {
  if (role === "operator") return null;
  return (
    <p className="text-[12px] text-muted-foreground">
      Days that finish well under plan are flagged on Decisions. Rules stay on this browser — nothing is emailed.
    </p>
  );
}
