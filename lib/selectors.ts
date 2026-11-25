import { explain, marketPosition, rollup, type PeriodMetrics } from "./explain";
import { isTradingAsset } from "./mock/assets";
import type { Dataset } from "./mock/generate";
import { planState } from "./plan";
import { addDays, DEMO_TODAY, WINDOW_START } from "./time";
import type { Asset, DailyRevenue, Explanation, MarketPosition, PlanState, Role } from "./types";

export type PeriodKey = "yesterday" | "7d" | "mtd" | "ytd";

export interface PeriodWindow {
  key: PeriodKey;
  label: string;
  from: string;
  to: string;
  prevFrom: string | null;
  prevTo: string | null;
  baselineLabel: string;
  mode: "previous" | "forecast";
}

export function parsePeriod(value: string | undefined): PeriodKey {
  if (value === "yesterday" || value === "7d" || value === "mtd" || value === "ytd") return value;
  return "7d";
}

export function periodWindow(key: PeriodKey, today = DEMO_TODAY): PeriodWindow {
  if (key === "yesterday") {
    const day = addDays(today, -1);
    return {
      key,
      label: "Yesterday",
      from: day,
      to: day,
      prevFrom: addDays(day, -1),
      prevTo: addDays(day, -1),
      baselineLabel: "the day before",
      mode: "previous",
    };
  }
  if (key === "mtd") {
    const from = `${today.slice(0, 7)}-01`;
    const length = daysBetween(from, today);
    return {
      key,
      label: "Month to date",
      from,
      to: today,
      prevFrom: addDays(from, -length),
      prevTo: addDays(from, -1),
      baselineLabel: "the previous window",
      mode: "previous",
    };
  }
  if (key === "ytd") {
    return {
      key,
      label: "Demo window",
      from: WINDOW_START,
      to: today,
      prevFrom: null,
      prevTo: null,
      baselineLabel: "the morning forecast",
      mode: "forecast",
    };
  }
  const to = today;
  const from = addDays(today, -6);
  return {
    key: "7d",
    label: "7 days",
    from,
    to,
    prevFrom: addDays(from, -7),
    prevTo: addDays(from, -1),
    baselineLabel: "the previous window",
    mode: "previous",
  };
}

export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

export function portfolioAssets(ds: Dataset, portfolioId: string): Asset[] {
  const portfolio = ds.portfolios.find((p) => p.id === portfolioId) ?? ds.portfolios[0];
  return portfolio.assetIds.map((id) => ds.assets.find((a) => a.id === id)!).filter(Boolean);
}

export function defaultPortfolio(role: Role): string {
  return role === "stadtwerk" ? "elbe" : "kestrel";
}

export function sliceDays(rows: DailyRevenue[], assetId: string | null, from: string, to: string, tradingOnly = true): DailyRevenue[] {
  return rows.filter(
    (d) =>
      d.date >= from &&
      d.date <= to &&
      (assetId ? d.assetId === assetId : true) &&
      (!tradingOnly || d.trading),
  );
}

export function explainWindow(
  ds: Dataset,
  opts: {
    assetId: string | null;
    /** Limit a portfolio explanation to these assets. Without it, `assetId: null` means the whole book. */
    assetIds?: ReadonlySet<string>;
    from: string;
    to: string;
    mode: "previous" | "forecast";
    baselineLabel: string;
    focus?: Explanation extends never ? never : "default" | "afrr" | "outage" | "benchmark" | "tuesday";
    locale?: "en-GB" | "de-DE";
  },
): Explanation {
  const asset = opts.assetId ? ds.assets.find((a) => a.id === opts.assetId) : undefined;
  const scope = <T extends { assetId: string }>(rows: T[]): T[] => (opts.assetIds ? rows.filter((row) => opts.assetIds!.has(row.assetId)) : rows);
  const actual = scope(sliceDays(ds.daily, opts.assetId, opts.from, opts.to));
  let baseline: DailyRevenue[] = [];
  if (opts.mode === "forecast") {
    baseline = scope(sliceDays(ds.forecastDaily, opts.assetId, opts.from, opts.to));
  } else {
    const len = daysBetween(opts.from, opts.to);
    const prevTo = addDays(opts.from, -1);
    const prevFrom = addDays(prevTo, -(len - 1));
    baseline = scope(sliceDays(ds.daily, opts.assetId, prevFrom, prevTo));
  }
  const metrics = rollup(actual);
  return explain({
    assetId: opts.assetId,
    assetName: asset?.name ?? "Portfolio",
    actual,
    baseline,
    baselineLabel: opts.baselineLabel,
    weather: ds.weatherDaily,
    country: asset?.country ?? "DE",
    outages: scope(ds.outages),
    planCents: metrics.planCents,
    benchmarkCents: metrics.benchmarkCents,
    locale: opts.locale,
    focus: opts.focus ?? "default",
  });
}

export interface AssetPeriodRow {
  asset: Asset;
  trading: boolean;
  metrics: PeriodMetrics;
  state: PlanState;
  position: MarketPosition;
}

export function assetPeriodRows(ds: Dataset, assets: Asset[], from: string, to: string): AssetPeriodRow[] {
  return assets.map((asset) => {
    const trading = isTradingAsset(asset.id);
    const days = sliceDays(ds.daily, asset.id, from, to, false).filter((d) => d.assetId === asset.id);
    const metrics = rollup(days.filter((d) => d.trading));
    const state = trading ? planState(metrics.totalCents, metrics.planCents, metrics.availabilityPct, true) : "not_live";
    const position = trading ? marketPosition(metrics.totalCents, metrics.benchmarkCents) : "inline";
    return { asset, trading, metrics, state, position };
  });
}

export function dailySeries(rows: DailyRevenue[]): { date: string; totalCents: number; byMarket: DailyRevenue["byMarketCents"] }[] {
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  return dates.map((date) => {
    const slice = rows.filter((r) => r.date === date);
    const byMarket = {
      DA: slice.reduce((s, r) => s + r.byMarketCents.DA, 0),
      ID: slice.reduce((s, r) => s + r.byMarketCents.ID, 0),
      AFRR_CAP: slice.reduce((s, r) => s + r.byMarketCents.AFRR_CAP, 0),
      AFRR_ENERGY: slice.reduce((s, r) => s + r.byMarketCents.AFRR_ENERGY, 0),
      FCR: slice.reduce((s, r) => s + r.byMarketCents.FCR, 0),
      IMBALANCE: slice.reduce((s, r) => s + r.byMarketCents.IMBALANCE, 0),
    };
    return { date, totalCents: slice.reduce((s, r) => s + r.totalCents, 0), byMarket };
  });
}

export { planState };
