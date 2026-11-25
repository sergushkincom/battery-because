import { isTradingAsset } from "./mock/assets";
import { getDataset, type Dataset } from "./mock/generate";
import { readQuery, withParams, type ViewQuery } from "./query";
import { assetPeriodRows, explainWindow, periodWindow, portfolioAssets, sliceDays } from "./selectors";
import { addDays, DEMO_TODAY, FORECAST_END, formatDay } from "./time";
import type { Asset } from "./types";

export function loadView(sp: Record<string, string | string[] | undefined>): { ds: Dataset; q: ViewQuery } {
  return { ds: getDataset(), q: readQuery(sp) };
}

export function baseParams(q: ViewQuery): Record<string, string | undefined> {
  return { role: q.role, portfolio: q.portfolio, period: q.period, loc: q.locale };
}

export function linkTo(q: ViewQuery, path: string, patch: Record<string, string | null | undefined> = {}): string {
  return withParams(path, baseParams(q), patch);
}

export function findAsset(ds: Dataset, id: string): Asset | undefined {
  return ds.assets.find((asset) => asset.id === id);
}

export function tradingInPortfolio(ds: Dataset, portfolioId: string): Asset[] {
  return portfolioAssets(ds, portfolioId).filter((asset) => isTradingAsset(asset.id));
}

export function resolvedDate(q: ViewQuery, fallback = addDays(DEMO_TODAY, -1)): string {
  const date = q.date ?? fallback;
  if (date < "2026-08-22" || date > FORECAST_END) return fallback;
  return date;
}

export function portfolioExplain(ds: Dataset, q: ViewQuery) {
  const window = periodWindow(q.period);
  const ids = new Set(tradingInPortfolio(ds, q.portfolio).map((asset) => asset.id));
  const actual = sliceDays(ds.daily, null, window.from, window.to).filter((row) => ids.has(row.assetId));
  return {
    window,
    rows: assetPeriodRows(ds, portfolioAssets(ds, q.portfolio), window.from, window.to),
    actual,
    explanation: explainWindow(ds, {
      assetId: null,
      assetIds: ids,
      from: window.from,
      to: window.to,
      mode: window.mode,
      baselineLabel: window.baselineLabel,
      locale: q.locale,
    }),
  };
}

export function dayLabel(date: string): string {
  return formatDay(date);
}
