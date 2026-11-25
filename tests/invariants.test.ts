import { describe, expect, it } from "vitest";
import { explain, rollup, windStats } from "../lib/explain";
import { suggestCheaperWindow, windowImpact } from "../lib/maintenance";
import { generate } from "../lib/mock/generate";
import { slotStory } from "../lib/story";

const ds = generate();

function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const match of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const token = match[0];
    const normalised = token.includes(",") && !token.includes(".") ? token.replace(/,/g, "") : token.replace(/,/g, "");
    const value = Number(normalised);
    if (!Number.isNaN(value)) out.push(value);
  }
  return out;
}

describe("mock book", () => {
  it("is deterministic", () => {
    const again = generate();
    expect(again.daily.map((d) => d.totalCents)).toEqual(ds.daily.map((d) => d.totalCents));
    expect(again.intervals.map((d) => d.powerKw)).toEqual(ds.intervals.map((d) => d.powerKw));
  });

  it("keeps state of charge inside the asset limits", () => {
    const assets = new Map(ds.assets.map((a) => [a.id, a]));
    for (const interval of ds.intervals) {
      const asset = assets.get(interval.assetId)!;
      expect(interval.socPct).toBeGreaterThanOrEqual(asset.socMinPct - 0.05);
      expect(interval.socPct).toBeLessThanOrEqual(asset.socMaxPct + 0.05);
    }
  });

  it("sums market lines to the daily total", () => {
    for (const day of ds.daily) {
      const sum = Object.values(day.byMarketCents).reduce((s, n) => s + n, 0);
      expect(sum).toBe(day.totalCents);
    }
  });

  it("does not dispatch through a full outage", () => {
    const fault = ds.intervals.filter(
      (i) =>
        i.assetId === "lechfeld-1" &&
        i.ts >= "2026-11-17T05:00:00.000Z" &&
        i.ts < "2026-11-18T12:00:00.000Z",
    );
    expect(fault.length).toBeGreaterThan(90);
    for (const interval of fault) {
      expect(interval.availableKw).toBe(0);
      expect(interval.powerKw).toBe(0);
    }
  });

  it("matches the morning forecast stored on each day", () => {
    for (const day of ds.daily.filter((d) => d.trading)) {
      const forecast = ds.forecastDaily.find((d) => d.assetId === day.assetId && d.date === day.date);
      expect(forecast?.totalCents).toBe(day.forecastCents);
    }
  });

  it("earns less in the cloudy week than in the week before", () => {
    const recent = rollup(ds.daily.filter((d) => d.trading && d.date >= "2026-11-13" && d.date <= "2026-11-19"));
    const prior = rollup(ds.daily.filter((d) => d.trading && d.date >= "2026-11-06" && d.date <= "2026-11-12"));
    expect(recent.totalCents).toBeLessThan(prior.totalCents * 0.7);
  });

  it("keeps Tajo Sur out of the trading book and blocked on prequalification", () => {
    const rows = ds.daily.filter((d) => d.assetId === "tajo-sur");
    expect(rows.every((d) => d.totalCents === 0 && d.state === "not_live")).toBe(true);
    const step = ds.onboarding.find((s) => s.assetId === "tajo-sur" && s.step === "prequal");
    expect(step?.state).toBe("blocked");
  });

  it("records the failed bid and the pending cycle approval", () => {
    expect(ds.audit.some((a) => a.state === "failed" && a.assetId === "lechfeld-1")).toBe(true);
    expect(ds.approvals.some((a) => a.id === "apr-puglia-cycles" && a.state === "pending")).toBe(true);
    expect(ds.audit.some((a) => a.state === "expired")).toBe(true);
  });
});

describe("explanations", () => {
  const actual = ds.daily.filter((d) => d.assetId === "lechfeld-1" && d.date >= "2026-11-13" && d.date <= "2026-11-19");
  const baseline = ds.daily.filter((d) => d.assetId === "lechfeld-1" && d.date >= "2026-11-06" && d.date <= "2026-11-12");
  const exp = explain({
    assetId: "lechfeld-1",
    assetName: "Lechfeld 1",
    actual,
    baseline,
    baselineLabel: "the previous window",
    weather: ds.weatherDaily,
    country: "DE",
    outages: ds.outages,
    planCents: rollup(actual).planCents,
    benchmarkCents: rollup(actual).benchmarkCents,
  });

  it("makes the bridge add up to actual minus baseline", () => {
    expect(exp.bridge.reduce((s, row) => s + row.cents, 0)).toBe(exp.deltaCents);
    expect(exp.actualCents - exp.baselineCents).toBe(exp.deltaCents);
  });

  it("only uses numbers that were computed, and money matches the bridge", () => {
    const text = [exp.headline, ...exp.sentences.map((s) => s.text)].join(" ");
    const allowed = new Set(exp.used.map((u) => Math.abs(u.value)));
    for (const value of numbersIn(text)) {
      expect(allowed.has(Math.abs(value)), `${value} in “${text}”`).toBe(true);
    }
    for (const used of exp.used) {
      if (used.source === "delta") {
        expect(Math.abs(used.value)).toBe(Math.abs(Math.round(exp.deltaCents / 100)));
      }
      if (used.source.startsWith("bridge:")) {
        const row = exp.bridge.find((b) => b.label === used.source.slice(7));
        expect(row).toBeTruthy();
        expect(Math.abs(used.value)).toBe(Math.abs(Math.round((row?.cents ?? 0) / 100)));
      }
      if (used.source === "windPct") {
        expect(used.value).toBe(Math.round(windStats(ds.weatherDaily, "2026-11-13", "2026-11-19", "DE").windPct));
      }
      if (used.source === "spreadNow") {
        expect(used.value).toBe(Math.round(rollup(actual).capturedSpread));
      }
      if (used.source === "spreadBase") {
        expect(used.value).toBe(Math.round(rollup(baseline).capturedSpread));
      }
      if (used.source === "plan") {
        expect(Math.abs(used.value)).toBe(Math.abs(Math.round(rollup(actual).planCents / 100)));
      }
    }
    expect(exp.headline).toMatch(/fell|rose|held/);
    expect(text).toContain("50 MW");
    expect(text).toContain("31 hours");
  });
});

describe("slot story", () => {
  it("repeats the interval’s own price and revenue", () => {
    const interval = ds.intervals.find(
      (i) => i.assetId === "lechfeld-1" && i.market === "ID" && i.powerKw > 0 && i.quality === "ok",
    );
    expect(interval).toBeTruthy();
    const text = slotStory(interval!, "Europe/Berlin", null);
    expect(text).toContain(`€${interval!.priceEurMwh!.toFixed(0)}/MWh`);
    expect(text).toContain("€");
    const earned = text.match(/Earned (€[\d,]+)/);
    expect(earned?.[1].replace(/[€,]/g, "")).toBe(String(Math.round(interval!.revenueCents / 100)));
  });
});

describe("maintenance windows", () => {
  it("suggests a cheaper block and prices it from the same slots", () => {
    const slots = Array.from({ length: 8 }, (_, i) => ({
      ts: new Date(Date.UTC(2026, 10, 20, 8 + i, 0, 0)).toISOString(),
      revenueCents: i < 4 ? 50_000 : 10_000,
    }));
    const start = slots[0].ts;
    const end = slots[4].ts;
    expect(windowImpact(slots, start, end, 10_000, 10_000)).toBe(200_000);
    const suggestion = suggestCheaperWindow(slots, start, end, 10_000, 10_000);
    expect(suggestion).toBeTruthy();
    expect(suggestion!.cents).toBeLessThan(200_000);
    expect(suggestion!.saveCents).toBe(200_000 - suggestion!.cents);
    expect(suggestion!.cents).toBe(windowImpact(slots, suggestion!.start, suggestion!.end, 10_000, 10_000));
  });
});

describe("reports", () => {
  it("explains a portfolio report with that portfolio's assets only", async () => {
    const { explainWindow, portfolioAssets } = await import("../lib/selectors");
    const { REPORTS, reportFigures } = await import("../lib/reports");
    const { isTradingAsset } = await import("../lib/mock/assets");
    for (const portfolio of ds.portfolios) {
      const ids = new Set(portfolioAssets(ds, portfolio.id).filter((asset) => isTradingAsset(asset.id)).map((asset) => asset.id));
      for (const period of REPORTS) {
        const figures = reportFigures(ds, period, ids);
        const explanation = explainWindow(ds, { assetId: null, assetIds: ids, from: period.from, to: period.to, mode: "forecast", baselineLabel: "the morning forecast" });
        expect(explanation.actualCents).toBe(figures.metrics.totalCents);
        expect(explanation.bridge.reduce((sum, row) => sum + row.cents, 0)).toBe(explanation.actualCents - explanation.baselineCents);
        expect(figures.days.reduce((sum, day) => sum + day.cents, 0)).toBe(figures.metrics.totalCents);
      }
    }
  });
});
