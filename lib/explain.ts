import { formatEUR, formatNumber, formatPct, type Locale } from "./format";
import type { DailyRevenue, DailyWeather, Explanation, ExplainInput, Outage, UsedFigure } from "./types";

export const BRIDGE_METHOD: { label: string; formula: string }[] = [
  {
    label: "Price spread",
    formula: "Change in average captured spread (€/MWh) × energy discharged in the baseline (MWh).",
  },
  {
    label: "Intraday volatility",
    formula: "Change in intraday revenue that day-ahead prices do not explain.",
  },
  {
    label: "Balancing capacity price",
    formula: "Change in average capacity price (€/MW/h) × reserved MW·h in the baseline.",
  },
  {
    label: "Availability",
    formula: "Change in available MWh × baseline revenue per available MWh.",
  },
  {
    label: "Grid constraint",
    formula: "Energy blocked by a DSO instruction or curtailment in above-median hours, valued at the gap to that day’s median price.",
  },
  {
    label: "Cycle limit",
    formula: "Change in the value of discharges the daily cycle cap skipped.",
  },
  {
    label: "Fees and imbalance",
    formula: "Change in imbalance and fee cashflows.",
  },
  {
    label: "Other",
    formula: "Whatever is left so the bridge equals actual minus baseline. It is shown, not dropped.",
  },
];

export interface PeriodMetrics {
  totalCents: number;
  planCents: number;
  benchmarkCents: number;
  dischargedMwh: number;
  capturedSpread: number;
  idExtraCents: number;
  reservedMwh: number;
  avgCap: number;
  availableMwh: number;
  eurPerAvailable: number;
  cycleSkippedCents: number;
  gridCents: number;
  gridLostMwh: number;
  imbalanceCents: number;
  availabilityPct: number;
  cycles: number;
}

export function rollup(days: DailyRevenue[]): PeriodMetrics {
  const totalCents = sum(days, (d) => d.totalCents);
  const dischargedMwh = sum(days, (d) => d.dischargedMwh);
  const spreadComponent = sum(days, (d) => d.spreadComponentCents);
  const reservedMwh = sum(days, (d) => d.reservedMwh);
  const capPay = sum(days, (d) => d.byMarketCents.AFRR_CAP + d.byMarketCents.FCR);
  const availableMwh = sum(days, (d) => d.availableMwh);
  const nameplate = sum(days, (d) => d.nameplateMwh);
  const usableCycles = days.length ? sum(days, (d) => d.cycles) / days.length : 0;
  return {
    totalCents,
    planCents: sum(days, (d) => d.budgetCents),
    benchmarkCents: sum(days, (d) => d.benchmarkCents),
    dischargedMwh,
    capturedSpread: dischargedMwh > 0 ? spreadComponent / 100 / dischargedMwh : 0,
    idExtraCents: sum(days, (d) => d.idExtraCents),
    reservedMwh,
    avgCap: reservedMwh > 0 ? capPay / 100 / reservedMwh : 0,
    availableMwh,
    eurPerAvailable: availableMwh > 0 ? totalCents / 100 / availableMwh : 0,
    cycleSkippedCents: sum(days, (d) => d.cycleLimitSkippedCents),
    gridCents: sum(days, (d) => d.gridConstraintCents),
    gridLostMwh: sum(days, (d) => d.gridLostMwh),
    imbalanceCents: sum(days, (d) => d.imbalanceCents),
    availabilityPct: nameplate > 0 ? (availableMwh / nameplate) * 100 : 0,
    cycles: usableCycles,
  };
}

export function windStats(weather: DailyWeather[], from: string, to: string, country: DailyWeather["country"]) {
  const all = weather.filter((w) => w.country === country);
  const slice = all.filter((w) => w.date >= from && w.date <= to);
  const normal = mean(all.map((w) => w.windActMw));
  const period = mean(slice.map((w) => w.windActMw));
  const solarNormal = mean(all.map((w) => w.solarActMw));
  const solar = mean(slice.map((w) => w.solarActMw));
  return {
    windPct: normal > 0 ? ((period - normal) / normal) * 100 : 0,
    solarPct: solarNormal > 0 ? ((solar - solarNormal) / solarNormal) * 100 : 0,
  };
}

export function explain(input: ExplainInput): Explanation {
  const locale = input.locale ?? "en-GB";
  const actual = rollup(input.actual);
  const baseline = rollup(input.baseline);
  const delta = actual.totalCents - baseline.totalCents;
  const from = input.actual[0]?.date ?? "";
  const to = input.actual[input.actual.length - 1]?.date ?? from;
  const evidence = { assetId: input.assetId ?? "portfolio", from, to };

  const spreadEffect = Math.round((actual.capturedSpread - baseline.capturedSpread) * baseline.dischargedMwh * 100);
  const volEffect = actual.idExtraCents - baseline.idExtraCents;
  const capEffect = Math.round((actual.avgCap - baseline.avgCap) * baseline.reservedMwh * 100);
  const availActual = actual.availableMwh + actual.gridLostMwh;
  const availBase = baseline.availableMwh + baseline.gridLostMwh;
  const availEffect = Math.round((availActual - availBase) * baseline.eurPerAvailable * 100);
  const gridEffect = -(actual.gridCents - baseline.gridCents);
  const cycleEffect = -(actual.cycleSkippedCents - baseline.cycleSkippedCents);
  const feeEffect = actual.imbalanceCents - baseline.imbalanceCents;
  const named = [
    { label: "Price spread", cents: spreadEffect },
    { label: "Intraday volatility", cents: volEffect },
    { label: "Balancing capacity price", cents: capEffect },
    { label: "Availability", cents: availEffect },
    { label: "Grid constraint", cents: gridEffect },
    { label: "Cycle limit", cents: cycleEffect },
    { label: "Fees and imbalance", cents: feeEffect },
  ];
  const explained = named.reduce((s, row) => s + row.cents, 0);
  const bridge = [...named, { label: "Other", cents: delta - explained }];

  const used: UsedFigure[] = [];
  const euro = (cents: number, source: string, signed = true) => {
    const rounded = Math.round(cents / 100);
    used.push({ value: rounded, source });
    const body = formatEUR(Math.abs(cents), locale, 0);
    if (!signed) return body;
    if (rounded > 0) return `+${body}`;
    if (rounded < 0) return `−${body}`;
    return body;
  };
  const whole = (value: number, source: string) => {
    const rounded = Math.round(value);
    used.push({ value: rounded, source });
    return String(Math.abs(rounded));
  };

  const pct = baseline.totalCents !== 0 ? (delta / baseline.totalCents) * 100 : 0;
  const pctRounded = Math.round(pct);
  const verb = delta < 0 ? "fell" : delta > 0 ? "rose" : "held flat";
  const headline =
    delta === 0
      ? `Revenue held flat versus ${input.baselineLabel}.`
      : `Revenue ${verb} ${whole(pctRounded, "headlinePct")}% (${euro(delta, "delta")}) versus ${input.baselineLabel}.`;

  const stats = windStats(
    input.weather,
    from,
    to,
    input.country,
  );
  const sentences: Explanation["sentences"] = [];
  const ranked = [...bridge].sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));

  const pushDriver = (row: { label: string; cents: number }) => {
    if (row.cents === 0) return;
    const money = euro(row.cents, `bridge:${row.label}`);
    if (row.label === "Price spread") {
      const now = Math.round(actual.capturedSpread);
      const then = Math.round(baseline.capturedSpread);
      used.push({ value: now, source: "spreadNow" });
      used.push({ value: then, source: "spreadBase" });
      const wind = Math.round(stats.windPct);
      used.push({ value: wind, source: "windPct" });
      if (wind >= 15 && row.cents < 0) {
        sentences.push({
          text: `Wind was ${Math.abs(wind)}% above normal, so prices stayed flatter (captured spread €${now}/MWh versus €${then}/MWh). Price spread accounts for ${money}.`,
          evidence,
        });
      } else if (wind <= -15 && row.cents > 0) {
        sentences.push({
          text: `Wind was ${Math.abs(wind)}% below normal, and the captured spread widened from €${then}/MWh to €${now}/MWh. Price spread accounts for ${money}.`,
          evidence,
        });
      } else {
        sentences.push({
          text: `Captured spread moved from €${then}/MWh to €${now}/MWh. Price spread accounts for ${money}.`,
          evidence,
        });
      }
      return;
    }
    if (row.label === "Availability") {
      const outage = largestOutage(input.outages, input.assetId, from, to);
      if (outage) {
        const hours = Math.round((Date.parse(outage.end) - Date.parse(outage.start)) / 3_600_000);
        const mw = Math.round(outage.lostKw / 1000);
        used.push({ value: hours, source: "outageHours" });
        used.push({ value: mw, source: "outageMw" });
        const noun = outage.reason === "inverter_fault" ? "Inverter fault" : outage.reason === "telemetry_loss" ? "Telemetry gap" : "Outage";
        sentences.push({
          text: `${noun} took ${mw} MW offline for ${hours} hours. Availability accounts for ${money}.`,
          evidence: { assetId: outage.assetId, from: outage.start.slice(0, 10), to: outage.end.slice(0, 10) },
        });
      } else {
        sentences.push({ text: `Availability accounts for ${money}.`, evidence });
      }
      return;
    }
    if (row.label === "Grid constraint") {
      sentences.push({
        text: `A grid constraint accounts for ${money}.`,
        evidence,
      });
      return;
    }
    const clause =
      row.label === "Intraday volatility"
        ? "Intraday prices, beyond the day-ahead spread, account for"
        : row.label === "Balancing capacity price"
          ? "Balancing capacity prices account for"
          : row.label === "Cycle limit"
            ? "The daily cycle limit accounts for"
            : row.label === "Fees and imbalance"
              ? "Fees and imbalance account for"
              : "Other effects, including volume mix, account for";
    sentences.push({ text: `${clause} ${money}.`, evidence });
  };

  if (input.focus === "benchmark") {
    const gap = actual.totalCents - actual.benchmarkCents;
    sentences.push({
      text: `Against the market benchmark (perfect hindsight, then 80%), this window is ${euro(gap, "benchmarkGap")}.`,
      evidence,
    });
  } else if (input.focus === "afrr") {
    sentences.push({
      text: `Balancing capacity prices account for ${euro(capEffect, "bridge:Balancing capacity price")}. On a high-spread day the energy trade beat the capacity price, so the book did not reserve aFRR.`,
      evidence,
    });
  } else if (input.focus === "outage") {
    const row = bridge.find((b) => b.label === "Availability")!;
    pushDriver(row);
  } else {
    const picked = ranked.filter((r) => Math.abs(r.cents) >= 100).slice(0, 3);
    for (const row of picked) pushDriver(row);
  }

  if (input.focus !== "benchmark" && input.planCents !== 0) {
    const vsPlan = actual.totalCents - input.planCents;
    sentences.push({
      text: `The plan for this window was ${euro(input.planCents, "plan", false)}, so the result sits ${euro(vsPlan, "vsPlan")} versus plan.`,
      evidence,
    });
  }

  const inputs = [
    { label: "Actual revenue", value: formatEUR(actual.totalCents, locale, 0) },
    { label: "Baseline revenue", value: formatEUR(baseline.totalCents, locale, 0) },
    { label: "Captured spread, actual", value: `€${formatNumber(actual.capturedSpread, locale, 0)}/MWh` },
    { label: "Captured spread, baseline", value: `€${formatNumber(baseline.capturedSpread, locale, 0)}/MWh` },
    { label: "Baseline discharge", value: `${formatNumber(baseline.dischargedMwh, locale, 0)} MWh` },
    { label: "Baseline reserved", value: `${formatNumber(baseline.reservedMwh, locale, 0)} MW·h` },
    { label: "Availability, actual", value: formatPct(actual.availabilityPct).replace("+", "") },
    { label: "Wind versus normal", value: formatPct(stats.windPct) },
  ];

  return {
    headline,
    sentences,
    bridge,
    used,
    deltaCents: delta,
    baselineCents: baseline.totalCents,
    actualCents: actual.totalCents,
    inputs,
  };
}

function largestOutage(outages: Outage[], assetId: string | null, from: string, to: string): Outage | null {
  const hits = outages.filter((o) => {
    if (assetId && o.assetId !== assetId) return false;
    const start = o.start.slice(0, 10);
    const end = o.end.slice(0, 10);
    return end >= from && start <= to;
  });
  hits.sort((a, b) => b.lostKw * (Date.parse(b.end) - Date.parse(b.start)) - a.lostKw * (Date.parse(a.end) - Date.parse(a.start)));
  return hits[0] ?? null;
}

function sum(days: DailyRevenue[], pick: (d: DailyRevenue) => number): number {
  return days.reduce((s, d) => s + pick(d), 0);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, n) => s + n, 0) / values.length;
}

export function marketPosition(totalCents: number, benchmarkCents: number): "above" | "inline" | "below" {
  if (benchmarkCents <= 0) return "inline";
  const ratio = totalCents / benchmarkCents;
  if (ratio >= 1.05) return "above";
  if (ratio <= 0.95) return "below";
  return "inline";
}
