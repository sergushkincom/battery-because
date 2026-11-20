import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RevenueHeatmap, WaterfallChart } from "@/components/charts";
import { DayExplorer } from "@/components/day-explorer";
import { StateChip, toneForPlan, toneForPosition } from "@/components/state-chip";
import { marketPosition } from "@/lib/explain";
import { explainWindow } from "@/lib/selectors";
import { formatEUR, formatSignedEUR } from "@/lib/format";
import { PLAN_LABEL, POSITION_LABEL } from "@/lib/labels";
import { findAsset, linkTo, loadView, resolvedDate } from "@/lib/page-model";
import { addDays, DEMO_TODAY, formatDay, FORECAST_END, offsetHours, slotIso, WINDOW_START } from "@/lib/time";

export default async function AssetDayPage({
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
  const date = resolvedDate(q);
  const start = slotIso(date, 0, offsetHours(asset.country, date));
  const end = slotIso(addDays(date, 1), 0, offsetHours(asset.country, addDays(date, 1)));
  const source = date > DEMO_TODAY ? ds.forecastIntervals : ds.intervals;
  const intervals = source.filter((row) => row.assetId === asset.id && row.ts >= start && row.ts < end);
  const prices = ds.prices.filter((row) => row.country === asset.country && row.ts >= start && row.ts < end);
  const weather = ds.weather.filter((row) => row.country === asset.country && row.ts >= start && row.ts < end);
  const decisions = ds.decisions.filter((row) => row.assetId === asset.id && row.ts < end && row.endTs >= start);
  const daily = ds.daily.find((row) => row.assetId === asset.id && row.date === date) ?? ds.forecastDaily.find((row) => row.assetId === asset.id && row.date === date);
  const explanation = asset.id === "tajo-sur" || date > DEMO_TODAY
    ? null
    : explainWindow(ds, {
        assetId: asset.id,
        from: date > DEMO_TODAY ? date : date,
        to: date,
        mode: "forecast",
        baselineLabel: "the morning forecast",
        locale: q.locale,
      });
  const cells = ds.days.map((day) => {
    const row = ds.daily.find((item) => item.assetId === asset.id && item.date === day);
    return { date: day, cents: row?.totalCents ?? 0 };
  });
  const max = Math.max(...cells.map((cell) => cell.cents), 1);
  const heatmap = cells.map((cell) => ({
    ...cell,
    label: formatDay(cell.date),
    bucket: cell.cents > max * 0.75 ? "Strong" : cell.cents > max * 0.5 ? "Solid" : cell.cents > max * 0.25 ? "Soft" : "Quiet",
    href: linkTo(q, `/assets/${asset.id}`, { date: cell.date }),
  }));
  const position = daily?.trading ? marketPosition(daily.totalCents, daily.benchmarkCents) : "inline";
  const sub = (path: string) => linkTo(q, path, { date });

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] text-muted-foreground">
            {asset.country} · {asset.powerKw / 1000} MW / {asset.energyKwh / 1000} MWh · Europe/Berlin display follows the asset zone
          </p>
          <h1 className="text-[20px] font-semibold">{asset.name}</h1>
          <p className="text-[13px]">{formatDay(date)}{date > DEMO_TODAY ? " · forecast" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="rounded-[4px] border border-border px-2 py-1" href={linkTo(q, `/assets/${asset.id}`, { date: addDays(date, -1) < WINDOW_START ? WINDOW_START : addDays(date, -1) })} aria-label="Previous day">
            Previous
          </Link>
          <Link className="rounded-[4px] border border-border px-2 py-1" href={linkTo(q, `/assets/${asset.id}`, { date: addDays(date, 1) > FORECAST_END ? FORECAST_END : addDays(date, 1) })} aria-label="Next day">
            Next
          </Link>
        </div>
      </header>
      <nav className="flex flex-wrap gap-3 text-[13px]" aria-label="Asset">
        <Link className="font-medium text-primary" href={sub(`/assets/${asset.id}`)}>Day</Link>
        <Link href={sub(`/assets/${asset.id}/why`)}>Why</Link>
        <Link href={sub(`/assets/${asset.id}/control`)}>Control</Link>
        <Link href={sub(`/assets/${asset.id}/log`)}>Log</Link>
        <Link href={sub(`/assets/${asset.id}/journey`)}>Journey</Link>
      </nav>
      <p className="text-[12px] text-muted-foreground">
        {date === DEMO_TODAY ? "Data delayed — last telemetry 14:05" : date > DEMO_TODAY ? "Forecast only" : intervals.some((row) => row.quality === "missing") ? "Telemetry gap — some intervals are missing" : "Settled"}
      </p>
      {!daily?.trading && (
        <section className="rounded-[6px] border border-border bg-card p-4">
          <h2 className="text-[16px] font-semibold">Trading has not started</h2>
          <p className="mt-1">Prequalification is blocked, waiting on the DSO. There is no dispatch to explain yet.</p>
          <Link className="mt-2 inline-block text-primary" href={sub(`/assets/${asset.id}/journey`)}>Open the go-live journey</Link>
        </section>
      )}
      <RevenueHeatmap cells={heatmap} selected={date} />
      {daily?.trading && (
        <section className="grid gap-3 md:grid-cols-4">
          <Mini label="Revenue" value={formatEUR(daily.totalCents, q.locale, 0)} />
          <Mini label="Vs plan" value={formatSignedEUR(daily.totalCents - daily.budgetCents, q.locale, 0)} extra={<StateChip tone={toneForPlan(daily.state)}>{PLAN_LABEL[daily.state]}</StateChip>} />
          <Mini label="Vs market" value={formatSignedEUR(daily.totalCents - daily.benchmarkCents, q.locale, 0)} extra={<StateChip tone={toneForPosition(position)}>{POSITION_LABEL[position]}</StateChip>} />
          <Mini label="Cycles" value={daily.cycles.toFixed(2)} extra={<span className="text-[12px] text-muted-foreground">{Math.round(daily.availabilityPct)}% available</span>} />
        </section>
      )}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <article className="rounded-[6px] border border-border bg-card p-4 shadow-[var(--shadow-sheet)]">
          <h2 className="mb-2 text-[16px] font-semibold">Dispatch</h2>
          <DayExplorer
            intervals={intervals}
            prices={prices}
            weather={weather}
            decisions={decisions}
            timeZone={asset.timezone}
            locale={q.locale}
            forecast={date > DEMO_TODAY}
          />
        </article>
        <aside className="grid gap-3">
          <article className="rounded-[6px] border border-border bg-card p-4">
            <h2 className="text-[16px] font-semibold">Day story</h2>
            {explanation ? (
              <>
                <p className="mt-2 font-medium">{explanation.headline}</p>
                <ul className="mt-2 grid gap-2">
                  {explanation.sentences.slice(0, 4).map((sentence) => (
                    <li key={sentence.text}>{sentence.text}</li>
                  ))}
                </ul>
                <Link className="mt-3 inline-block text-[12px] text-primary" href={linkTo(q, `/assets/${asset.id}/why`, { from: date, to: date, compare: "forecast" })}>
                  Open the full bridge
                </Link>
              </>
            ) : (
              <p className="mt-2">No revenue story until control is handed over.</p>
            )}
          </article>
          {daily?.trading && (
            <article className="rounded-[6px] border border-border bg-card p-4">
              <h2 className="mb-2 text-[16px] font-semibold">Where the euros came from</h2>
              <WaterfallChart
                locale={q.locale}
                rows={[
                  ...(["DA", "ID", "AFRR_CAP", "AFRR_ENERGY", "FCR", "IMBALANCE"] as const)
                    .filter((market) => daily.byMarketCents[market] !== 0)
                    .map((market) => ({ label: market, cents: daily.byMarketCents[market] })),
                  { label: "Total", cents: daily.totalCents, total: true },
                ]}
              />
            </article>
          )}
        </aside>
      </div>
      <p className="text-[11px] text-muted-foreground">Zone {asset.timezone}. Window starts {WINDOW_START}.</p>
    </div>
  );
}

function Mini({ label, value, extra }: { label: string; value: string; extra?: ReactNode }) {
  return (
    <article className="rounded-[6px] border border-border bg-card px-4 py-3">
      <h2 className="text-[11px] font-semibold text-muted-foreground">{label}</h2>
      <p className="num text-[20px] font-medium leading-[1.2]">{value}</p>
      {extra}
    </article>
  );
}
