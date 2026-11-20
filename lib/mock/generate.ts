import type {
  ApprovalRequest,
  Asset,
  AuditEntry,
  CapacityPrice,
  Country,
  DailyRevenue,
  DailyWeather,
  Decision,
  DispatchInterval,
  Driver,
  MarketPrice,
  Outage,
  WeatherDriver,
} from "../types";
import { planState } from "../plan";
import {
  COUNTRIES,
  DELAY_FROM,
  DEMO_NOW,
  DEMO_TODAY,
  FORECAST_END,
  MAINTENANCE_START,
  WINDOW_START,
  addDays,
  eachDate,
  formatClock,
  offsetHours,
  slotIso,
} from "../time";
import { ASSETS, BUDGET_FACTOR, PORTFOLIOS, defaultRules, isTradingAsset, onboardingFor } from "./assets";
import { rngFor } from "./prng";
import { forcedRegime, type Regime } from "./regimes";
import { blankDay, metricsToDaily, simulateDay, type SimSlot } from "./simulate";

export interface PowerCap {
  assetId: string;
  start: string;
  end: string;
  maxDischargeKw: number;
}

export interface Dataset {
  today: string;
  now: string;
  portfolios: typeof PORTFOLIOS;
  assets: Asset[];
  days: string[];
  forecastDates: string[];
  daily: DailyRevenue[];
  forecastDaily: DailyRevenue[];
  intervals: DispatchInterval[];
  forecastIntervals: DispatchInterval[];
  prices: MarketPrice[];
  capacity: CapacityPrice[];
  weather: WeatherDriver[];
  weatherDaily: DailyWeather[];
  outages: Outage[];
  caps: PowerCap[];
  decisions: Decision[];
  onboarding: ReturnType<typeof onboardingFor>;
  rules: ReturnType<typeof defaultRules>;
  approvals: ApprovalRequest[];
  audit: AuditEntry[];
}

const WIND_CAP: Record<Country, number> = { DE: 65000, PL: 10000, IT: 14000, ES: 30000, PT: 6000 };
const SOLAR_CAP: Record<Country, number> = { DE: 80000, PL: 15000, IT: 28000, ES: 32000, PT: 4000 };
const BIAS: Record<Country, number> = { DE: 0, PL: 14, IT: 18, ES: -8, PT: -10 };
const WIND_FRAC: Record<Regime, number> = {
  sunny_calm: 0.18,
  windy: 0.74,
  cloudy_windy: 0.72,
  dunkelflaute: 0.08,
  volatile: 0.38,
};
const SOLAR_FRAC: Record<Regime, number> = {
  sunny_calm: 0.86,
  windy: 0.4,
  cloudy_windy: 0.16,
  dunkelflaute: 0.1,
  volatile: 0.5,
};
const FC_ERR: Record<Regime, number> = {
  sunny_calm: 0.08,
  windy: 0.1,
  cloudy_windy: 0.08,
  dunkelflaute: 0.12,
  volatile: 0.38,
};

const OUTAGES: Outage[] = [
  {
    assetId: "lechfeld-1",
    start: "2026-11-17T05:00:00.000Z",
    end: "2026-11-18T12:00:00.000Z",
    lostKw: 50_000,
    reason: "inverter_fault",
    knownAhead: false,
  },
  {
    assetId: "oderbruch",
    start: "2026-11-16T09:00:00.000Z",
    end: "2026-11-16T13:00:00.000Z",
    lostKw: 10_000,
    reason: "dso_instruction",
    knownAhead: false,
  },
  {
    assetId: "havelland",
    start: "2026-11-19T07:00:00.000Z",
    end: "2026-11-19T09:30:00.000Z",
    lostKw: 15_000,
    reason: "telemetry_loss",
    knownAhead: false,
  },
];

const CAPS: PowerCap[] = [
  {
    assetId: "elbmarsch",
    start: "2026-11-18T15:00:00.000Z",
    end: "2026-11-18T17:00:00.000Z",
    maxDischargeKw: 6_000,
  },
];

function seasonSolar(date: string): number {
  const m = date.slice(5, 7);
  if (m === "08") return 1;
  if (m === "09") return 0.72;
  if (m === "10") return 0.42;
  return 0.28;
}

function regimeFor(date: string, calendar: Map<string, Regime>): Regime {
  return forcedRegime(date) ?? calendar.get(date) ?? "windy";
}

function buildCalendar(dates: string[]): Map<string, Regime> {
  const cycle: Regime[] = ["sunny_calm", "windy", "sunny_calm", "volatile", "cloudy_windy", "windy"];
  const map = new Map<string, Regime>();
  let i = 0;
  let idx = 0;
  while (i < dates.length) {
    const len = 2 + Math.floor(rngFor(`regime|${dates[i]}`)() * 3);
    const regime = cycle[idx % cycle.length];
    for (let k = 0; k < len && i < dates.length; k++, i++) map.set(dates[i], regime);
    idx++;
  }
  return map;
}

function solarShape(hour: number): number {
  if (hour < 6 || hour > 19) return 0;
  const x = (hour - 13) / 6.2;
  return Math.exp(-x * x);
}

interface BuiltDay {
  weather: WeatherDriver[];
  daily: DailyWeather;
  prices: MarketPrice[];
  capacity: CapacityPrice[];
  da: number[];
  forecastDa: number[];
  slots: Omit<SimSlot, "availableKw" | "maxDischargeKw" | "quality" | "outageReason" | "lostKw">[];
  forecastSlots: Omit<SimSlot, "availableKw" | "maxDischargeKw" | "quality" | "outageReason" | "lostKw">[];
}

function priceAt(hour: number, wind: number, solar: number, country: Country, regime: Regime, dayBias: number): number {
  const windCap = WIND_CAP[country];
  const solarCap = SOLAR_CAP[country];
  const w = Math.min(1.15, wind / windCap);
  const s = solarCap > 0 ? Math.min(1.2, solar / solarCap) : 0;
  let price = 98 - w * 72 + BIAS[country] + dayBias;
  const midday = Math.exp(-((hour - 13) ** 2) / 8);
  price -= s * 120 * midday;
  const evening = Math.exp(-((hour - 18.5) ** 2) / 5);
  price += (16 + (1 - Math.min(w, 1)) * 58) * evening;
  const morning = Math.exp(-((hour - 7.5) ** 2) / 6);
  price += 10 * morning;
  if (regime === "dunkelflaute") {
    price = 118 + BIAS[country] + dayBias * 0.4 + 6 * Math.sin(((hour - 8) / 24) * Math.PI * 2);
  }
  if (regime === "cloudy_windy") {
    const flat = 40 + BIAS[country] * 0.4 + dayBias * 0.3;
    price = flat + (price - flat) * 0.28;
  }
  if (regime === "volatile") price += Math.sin(hour * 1.3) * 8;
  return Math.round(price * 100) / 100;
}

function buildMarketDay(date: string, country: Country, regime: Regime): BuiltDay {
  const offset = offsetHours(country, date);
  const rng = rngFor(`wx|${country}|${date}`);
  const dayBias = (rng() - 0.5) * 10;
  const windBase = WIND_FRAC[regime] * WIND_CAP[country];
  const solarPeak = SOLAR_CAP[country] * seasonSolar(date) * SOLAR_FRAC[regime];
  const err = FC_ERR[regime];
  const weather: WeatherDriver[] = [];
  const windAct: number[] = [];
  const windFc: number[] = [];
  const solarAct: number[] = [];
  const solarFc: number[] = [];
  const temp: number[] = [];
  for (let h = 0; h < 24; h++) {
    const shape = 0.86 + 0.16 * Math.sin(((h - 4) / 24) * Math.PI * 2);
    const act = Math.max(200, windBase * shape * (0.9 + rng() * 0.2));
    const fc = Math.max(200, act * (1 + (rng() - 0.48) * 2 * err));
    const sAct = Math.max(0, solarPeak * solarShape(h) * (0.88 + rng() * 0.2));
    const sFc = Math.max(0, sAct * (1 + (rng() - 0.5) * 2 * err));
    const month = Number(date.slice(5, 7));
    const baseTemp = month === 8 ? 22 : month === 9 ? 17 : month === 10 ? 11 : 6;
    const t = Math.round((baseTemp - ((h - 15) ** 2) * 0.04) * 10) / 10;
    windAct.push(act);
    windFc.push(fc);
    solarAct.push(sAct);
    solarFc.push(sFc);
    temp.push(t);
    weather.push({
      country,
      ts: slotIso(date, h * 4, offset),
      windFcMw: Math.round(fc),
      windActMw: Math.round(act),
      solarFcMw: Math.round(sFc),
      solarActMw: Math.round(sAct),
      tempC: t,
      loadMw: Math.round(WIND_CAP[country] * (0.7 + 0.15 * Math.sin(((h - 8) / 24) * Math.PI * 2))),
    });
  }
  const daily: DailyWeather = {
    country,
    date,
    windActMw: Math.round(avg(windAct)),
    windFcMw: Math.round(avg(windFc)),
    solarActMw: Math.round(avg(solarAct)),
    solarFcMw: Math.round(avg(solarFc)),
    tempC: Math.round(avg(temp) * 10) / 10,
  };

  const prices: MarketPrice[] = [];
  const da: number[] = [];
  const forecastDa: number[] = [];
  const slots: BuiltDay["slots"] = [];
  const forecastSlots: BuiltDay["forecastSlots"] = [];
  const capScale = regime === "cloudy_windy" || regime === "windy" ? 0.55 : regime === "volatile" || regime === "dunkelflaute" ? 1.55 : 1;
  const sundayQuiet = date === "2026-11-08";

  const capacity: CapacityPrice[] = [];
  for (let b = 0; b < 6; b++) {
    const blockRng = rngFor(`cap|${country}|${date}|${b}`);
    let fcr = (6 + blockRng() * 12) * capScale;
    let pos = (12 + blockRng() * 28) * capScale;
    let neg = (8 + blockRng() * 16) * capScale;
    if (sundayQuiet) {
      fcr = 1 + blockRng() * 1.5;
      pos = 1.5 + blockRng() * 2;
      neg = 1 + blockRng();
    }
    if (b === 4 && regime === "volatile") pos *= 1.8;
    capacity.push({
      country,
      blockStart: slotIso(date, b * 16, offset),
      afrrPosEurMwH: round2(pos),
      afrrNegEurMwH: round2(neg),
      fcrEurMwH: round2(fcr),
    });
  }

  for (let q = 0; q < 96; q++) {
    const hour = Math.floor(q / 4);
    const ts = slotIso(date, q, offset);
    const daPx = priceAt(hour + 0.5, windAct[hour], solarAct[hour], country, regime, dayBias);
    const fcPx = priceAt(hour + 0.5, windFc[hour], solarFc[hour], country, regime, dayBias * 0.5);
    const amp = (3 + err * 70) * (regime === "volatile" ? 1.8 : 1);
    const id = round2(daPx + (rngFor(`id|${country}|${ts}`)() - 0.5) * 2 * amp);
    const block = capacity[Math.floor(q / 16)];
    const row: MarketPrice = {
      country,
      ts,
      daEurMwh: daPx,
      idVwapEurMwh: id,
      afrrPosEnergyEurMwh: round2(daPx + 18 + rngFor(`ap|${ts}|${country}`)() * 24),
      afrrNegEnergyEurMwh: round2(daPx - 12 - rngFor(`an|${ts}|${country}`)() * 16),
      imbalanceEurMwh: round2(daPx + (rngFor(`imb|${ts}|${country}`)() - 0.4) * 22),
    };
    prices.push(row);
    da.push(daPx);
    forecastDa.push(fcPx);
    const common = {
      ts,
      afrrPosEnergy: row.afrrPosEnergyEurMwh,
      afrrNegEnergy: row.afrrNegEnergyEurMwh,
      imbalance: row.imbalanceEurMwh,
      capAfrrPos: block.afrrPosEurMwH,
      capAfrrNeg: block.afrrNegEurMwH,
      capFcr: block.fcrEurMwH,
    };
    slots.push({ ...common, da: daPx, idPrice: id });
    forecastSlots.push({ ...common, da: fcPx, idPrice: fcPx });
  }

  return { weather, daily, prices, capacity, da, forecastDa, slots, forecastSlots };
}

function outageAt(assetId: string, ts: string, outages: Outage[]): Outage | null {
  let found: Outage | null = null;
  for (const o of outages) {
    if (o.assetId === assetId && ts >= o.start && ts < o.end) found = o;
  }
  return found;
}

function capAt(assetId: string, ts: string): number | null {
  for (const c of CAPS) {
    if (c.assetId === assetId && ts >= c.start && ts < c.end) return c.maxDischargeKw;
  }
  return null;
}

function toSim(
  base: BuiltDay["slots"],
  asset: Asset,
  date: string,
  mode: "actual" | "forecast" | "benchmark",
): SimSlot[] {
  return base.map((slot) => {
    const outage = outageAt(asset.id, slot.ts, OUTAGES);
    const known = !outage || outage.knownAhead || mode === "actual";
    const applyOutage = mode !== "benchmark" && outage && (mode === "actual" ? true : known);
    const lost = applyOutage && outage ? Math.min(asset.powerKw, outage.lostKw) : 0;
    const limit = Math.min(asset.powerKw, asset.gridLimitKw);
    let quality: SimSlot["quality"] = "ok";
    if (mode === "actual" && date === DEMO_TODAY && slot.ts >= DELAY_FROM) quality = "delayed";
    else if (mode === "actual" && outage?.reason === "telemetry_loss" && applyOutage) quality = "missing";
    return {
      ...slot,
      availableKw: Math.max(0, limit - lost),
      maxDischargeKw: mode === "benchmark" ? null : capAt(asset.id, slot.ts),
      quality,
      outageReason: applyOutage && outage ? outage.reason : null,
      lostKw: lost,
    };
  });
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function desiredCycles(asset: Asset): number {
  if (asset.strategy === "aggressive") return 2;
  if (asset.strategy === "conservative") return 1.5;
  return 1.75;
}

export function generate(): Dataset {
  const days = eachDate(WINDOW_START, DEMO_TODAY);
  const forecastDates = eachDate(addDays(DEMO_TODAY, 1), FORECAST_END);
  const allDates = eachDate(WINDOW_START, FORECAST_END);
  const calendar = buildCalendar(allDates);
  const built = new Map<string, BuiltDay>();
  const prices: MarketPrice[] = [];
  const capacity: CapacityPrice[] = [];
  const weather: WeatherDriver[] = [];
  const weatherDaily: DailyWeather[] = [];

  for (const date of allDates) {
    for (const country of COUNTRIES) {
      const day = buildMarketDay(date, country, regimeFor(date, calendar));
      built.set(`${country}|${date}`, day);
      prices.push(...day.prices);
      capacity.push(...day.capacity);
      weather.push(...day.weather);
      weatherDaily.push(day.daily);
    }
  }

  const assets = ASSETS.map((a) => ({ ...a, enabledMarkets: [...a.enabledMarkets] }));
  const daily: DailyRevenue[] = [];
  const forecastDaily: DailyRevenue[] = [];
  const intervals: DispatchInterval[] = [];
  const forecastIntervals: DispatchInterval[] = [];
  const decisions: Decision[] = [];
  const audit: AuditEntry[] = [];
  const failedBids: { assetId: string; ts: string; price: number; expectedCents: number }[] = [];

  for (const asset of assets) {
    const trading = isTradingAsset(asset.id);
    let soc = asset.energyKwh * 0.5;
    let forecastSoc = asset.energyKwh * 0.5;
    for (const date of allDates) {
      const market = built.get(`${asset.country}|${date}`);
      if (!market) continue;
      const historical = date <= DEMO_TODAY;
      if (!trading) {
        const bench = simulateDay(asset, toSim(market.slots, asset, date, "benchmark"), {
          useId: false,
          reserveCapacity: false,
          socStartKwh: asset.energyKwh * 0.5,
          desiredCycles: asset.maxCyclesPerDay,
          blockBestDischarge: false,
        });
        if (historical) {
          const row = blankDay(asset.id, date, false);
          row.benchmarkCents = Math.round(bench.metrics.totalCents * 0.8);
          daily.push(row);
          forecastDaily.push(blankDay(asset.id, date, false));
        } else {
          const row = blankDay(asset.id, date, false);
          forecastDaily.push(row);
        }
        continue;
      }

      const forecast = simulateDay(asset, toSim(market.forecastSlots, asset, date, "forecast"), {
        useId: false,
        reserveCapacity: true,
        socStartKwh: forecastSoc,
        desiredCycles: desiredCycles(asset),
        blockBestDischarge: false,
      });
      forecastSoc = forecast.socEndKwh;

      if (!historical) {
        forecastIntervals.push(...forecast.intervals);
        forecastDaily.push(
          metricsToDaily(asset.id, date, forecast.metrics, {
            forecastCents: forecast.metrics.totalCents,
            budgetCents: 0,
            benchmarkCents: 0,
            state: "on_plan",
            trading: true,
          }),
        );
        continue;
      }

      const bench = simulateDay(asset, toSim(market.slots, asset, date, "benchmark"), {
        useId: false,
        reserveCapacity: false,
        socStartKwh: asset.energyKwh * 0.5,
        desiredCycles: asset.maxCyclesPerDay,
        blockBestDischarge: false,
      });
      const actual = simulateDay(asset, toSim(market.slots, asset, date, "actual"), {
        useId: true,
        reserveCapacity: true,
        socStartKwh: soc,
        desiredCycles: desiredCycles(asset),
        blockBestDischarge: asset.id === "lechfeld-1" && date === "2026-11-10",
      });
      soc = actual.socEndKwh;
      if (actual.failedBid) {
        failedBids.push({
          assetId: asset.id,
          ts: actual.failedBid.ts,
          price: actual.failedBid.priceEurMwh,
          expectedCents: actual.failedBid.expectedCents,
        });
      }
      intervals.push(...actual.intervals);
      if (date >= MAINTENANCE_START) forecastIntervals.push(...forecast.intervals);
      daily.push(
        metricsToDaily(asset.id, date, actual.metrics, {
          forecastCents: forecast.metrics.totalCents,
          budgetCents: 0,
          benchmarkCents: Math.round(bench.metrics.totalCents * 0.8),
          state: "on_plan",
          trading: true,
        }),
      );
      forecastDaily.push(
        metricsToDaily(asset.id, date, forecast.metrics, {
          forecastCents: forecast.metrics.totalCents,
          budgetCents: 0,
          benchmarkCents: 0,
          state: "on_plan",
          trading: true,
        }),
      );
    }

    const fullDays = daily.filter((d) => d.assetId === asset.id && d.trading && d.date < DEMO_TODAY);
    const med = median(fullDays.map((d) => d.totalCents));
    asset.budgetCentsPerMonth = Math.round(med * 30 * (BUDGET_FACTOR[asset.id] ?? 1));
    for (const row of daily) {
      if (row.assetId !== asset.id) continue;
      const fraction = row.settledSlots > 0 ? row.settledSlots / 96 : 1;
      row.budgetCents = row.trading ? Math.round((asset.budgetCentsPerMonth / 30) * fraction) : 0;
      row.state = planState(row.totalCents, row.budgetCents, row.availabilityPct, row.trading);
    }
  }

  const decisionsByAsset = new Map<string, Decision[]>();
  for (const asset of assets) {
    if (!isTradingAsset(asset.id)) continue;
    const mine = intervals.filter((i) => i.assetId === asset.id);
    const builtDecisions = buildDecisions(asset, mine);
    decisions.push(...builtDecisions);
    decisionsByAsset.set(asset.id, builtDecisions);
  }

  for (const interval of intervals) {
    const list = decisionsByAsset.get(interval.assetId);
    if (!list) continue;
    const hit = list.find((d) => interval.ts >= d.ts && interval.ts <= d.endTs && d.action !== "hold");
    if (hit) interval.decisionId = hit.id;
  }

  for (const fail of failedBids) {
    const asset = assets.find((a) => a.id === fail.assetId)!;
    const time = formatClock(fail.ts, asset.timezone);
    decisions.push({
      id: `dec-fail-${fail.assetId}-${fail.ts}`,
      assetId: fail.assetId,
      ts: fail.ts,
      endTs: fail.ts,
      market: "ID",
      action: "hold",
      reason: `Bid rejected by the exchange: the ${time} offer at €${fail.price.toFixed(0)}/MWh sat outside the limits, so the system held.`,
      drivers: [{ kind: "spread", valueText: `Offer €${fail.price.toFixed(0)}/MWh`, deltaVsNormal: 0 }],
      revenueCents: 0,
      powerKw: 0,
      alternative: { label: "If the bid had been accepted", expectedCents: fail.expectedCents },
    });
    audit.push({
      id: `aud-fail-${fail.assetId}`,
      ts: fail.ts,
      assetId: fail.assetId,
      actor: { type: "system", name: "Because" },
      type: "bid",
      summary: "Bid rejected by the exchange: price outside limits — fell back to holding",
      reason: "The intraday offer sat outside the exchange price band, so the system held the position instead of forcing the trade.",
      effectCents: -fail.expectedCents,
      state: "failed",
      ref: { ts: fail.ts, decisionId: `dec-fail-${fail.assetId}-${fail.ts}` },
    });
  }

  for (const asset of assets) {
    if (!isTradingAsset(asset.id)) continue;
    for (const row of daily) {
      if (row.assetId !== asset.id || row.date < addDays(DEMO_TODAY, -20)) continue;
      audit.push({
        id: `aud-day-${asset.id}-${row.date}`,
        ts: slotIso(row.date, 80, offsetHours(asset.country, row.date)),
        assetId: asset.id,
        actor: { type: "system", name: "Because" },
        type: "dispatch",
        summary: `Dispatched ${row.cycles.toFixed(2)} cycles`,
        reason: dayReason(row),
        effectCents: row.totalCents,
        state: "executed",
        ref: { ts: slotIso(row.date, 72, offsetHours(asset.country, row.date)) },
      });
    }
  }

  audit.push({
    id: "aud-override-elbmarsch",
    ts: "2026-11-18T14:40:00.000Z",
    assetId: "elbmarsch",
    actor: { type: "operator", name: "Mara Keller" },
    type: "override",
    summary: "Capped Elbmarsch discharge at 6 MW until 18:00",
    reason: "Inverter fans were noisy on the afternoon check. The cap is time-boxed to 18:00 so the evening peak can still be traded if the check is clear.",
    effectCents: overrideEffect(daily, forecastDaily),
    state: "executed",
    ref: { ts: "2026-11-18T15:00:00.000Z" },
  });
  audit.push({
    id: "aud-alert-havelland",
    ts: "2026-11-19T07:05:00.000Z",
    assetId: "havelland",
    actor: { type: "system", name: "Because" },
    type: "alert",
    summary: "Telemetry gap on Havelland",
    reason: "No meter packets from 08:00 to 10:30. Those intervals are missing, not zero. The book does not invent a power figure for them.",
    state: "executed",
    ref: { ts: "2026-11-19T07:00:00.000Z" },
  });
  audit.push({
    id: "aud-expired-lechfeld",
    ts: "2026-11-18T16:30:00.000Z",
    assetId: "lechfeld-1",
    actor: { type: "system", name: "Because" },
    type: "approval",
    summary: "Expired — system used safe default",
    reason: "The inverter alarm was still open at the gate. Nobody approved a bid, so the system kept the safe default and did not offer new volume.",
    effectCents: 0,
    state: "expired",
  });

  const puglia = assets.find((a) => a.id === "puglia-nord")!;
  const evening = forecastIntervals.filter(
    (i) => i.assetId === "puglia-nord" && i.ts >= DELAY_FROM && i.ts.slice(0, 10) <= "2026-11-19",
  );
  const upside = evening.filter((i) => (i.daEurMwh ?? 0) > 80).reduce((s, i) => s + Math.max(0, i.revenueCents), 0);
  const low = Math.max(80_000, Math.round(upside * 0.45));
  const high = Math.max(low + 40_000, Math.round(upside * 0.85));

  const approvals: ApprovalRequest[] = [
    {
      id: "apr-puglia-cycles",
      assetId: "puglia-nord",
      createdAt: "2026-11-19T07:40:00.000Z",
      deadline: "2026-11-19T15:00:00.000Z",
      action: "Exceed daily cycle budget (>1.5 cycles)",
      reason: "The evening peak still ahead of the settled window is well above the prices already captured. The cycle rule stops Because from taking it alone.",
      expectedCents: [low, high],
      state: "pending",
    },
    {
      id: "apr-lechfeld-alarm",
      assetId: "lechfeld-1",
      createdAt: "2026-11-18T15:10:00.000Z",
      deadline: "2026-11-18T16:30:00.000Z",
      action: "Bid while SoH below threshold / after alarm",
      reason: "State of health is 97%, but the inverter alarm was still open. The rule requires a person before any new bid.",
      expectedCents: [0, 40_000],
      state: "expired",
      resolvedBy: "Because",
    },
  ];
  void puglia;

  audit.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));

  return {
    today: DEMO_TODAY,
    now: DEMO_NOW,
    portfolios: PORTFOLIOS,
    assets,
    days,
    forecastDates,
    daily,
    forecastDaily,
    intervals,
    forecastIntervals,
    prices,
    capacity,
    weather,
    weatherDaily,
    outages: OUTAGES,
    caps: CAPS,
    decisions,
    onboarding: assets.flatMap(onboardingFor),
    rules: assets.flatMap((a) => defaultRules(a.id)),
    approvals,
    audit,
  };
}

function overrideEffect(daily: DailyRevenue[], forecastDaily: DailyRevenue[]): number {
  const actual = daily.find((d) => d.assetId === "elbmarsch" && d.date === "2026-11-18");
  const forecast = forecastDaily.find((d) => d.assetId === "elbmarsch" && d.date === "2026-11-18");
  if (!actual || !forecast) return 0;
  return Math.min(0, actual.totalCents - forecast.totalCents);
}

function dayReason(row: DailyRevenue): string {
  if (row.availabilityPct < 90) {
    return "Availability was short of a full day, so the book could not take every slot the prices suggested.";
  }
  if (row.capturedSpreadEurMwh < 25) {
    return "The captured spread was thin, so the battery cycled less value than on a shaped day.";
  }
  if (row.idExtraCents > 50_000) {
    return "Intraday prices moved away from day-ahead and the system took the gap.";
  }
  return "Day-ahead spread and capacity prices were inside the strategy limits, so the system acted alone.";
}

function buildDecisions(asset: Asset, intervals: DispatchInterval[]): Decision[] {
  const out: Decision[] = [];
  let index = 0;
  while (index < intervals.length) {
    const start = intervals[index];
    if (start.quality !== "ok" || start.powerKw === 0 || !start.market || (start.market !== "DA" && start.market !== "ID")) {
      index += 1;
      continue;
    }
    const sign = Math.sign(start.powerKw);
    let end = index;
    while (
      end + 1 < intervals.length &&
      intervals[end + 1].quality === "ok" &&
      Math.sign(intervals[end + 1].powerKw) === sign &&
      intervals[end + 1].market === start.market
    ) {
      end += 1;
    }
    const group = intervals.slice(index, end + 1);
    const revenue = group.reduce((s, g) => s + g.revenueCents, 0);
    const power = group.reduce((s, g) => s + g.powerKw, 0) / group.length;
    const price = group.reduce((s, g) => s + (g.priceEurMwh ?? 0), 0) / group.length;
    const da = group.reduce((s, g) => s + (g.daEurMwh ?? 0), 0) / group.length;
    const action = sign > 0 ? "discharge" : "charge";
    const mw = Math.abs(power) / 1000;
    const time = formatClock(start.ts, asset.timezone);
    let reason: string;
    const drivers: Driver[] = [];
    if (action === "discharge" && start.market === "ID") {
      reason = `Discharged ${mw.toFixed(1)} MW on intraday from ${time} at €${price.toFixed(0)}/MWh. Day-ahead for the same slots was €${da.toFixed(0)}/MWh.`;
      drivers.push({ kind: "spread", valueText: `Intraday €${price.toFixed(0)} vs day-ahead €${da.toFixed(0)}`, deltaVsNormal: price - da });
    } else if (action === "discharge") {
      reason = `Discharged ${mw.toFixed(1)} MW on day-ahead from ${time} at €${price.toFixed(0)}/MWh, one of the day's dearer slots.`;
      drivers.push({ kind: "spread", valueText: `Day-ahead €${price.toFixed(0)}/MWh`, deltaVsNormal: 0 });
    } else if (start.market === "ID") {
      reason = `Charged ${mw.toFixed(1)} MW on intraday from ${time} at €${price.toFixed(0)}/MWh, below day-ahead (€${da.toFixed(0)}/MWh).`;
      drivers.push({ kind: "spread", valueText: `Intraday €${price.toFixed(0)} vs day-ahead €${da.toFixed(0)}`, deltaVsNormal: da - price });
    } else {
      reason = `Charged ${mw.toFixed(1)} MW on day-ahead from ${time} at €${price.toFixed(0)}/MWh, into a cheaper part of the day.`;
      drivers.push({ kind: "spread", valueText: `Day-ahead €${price.toFixed(0)}/MWh`, deltaVsNormal: 0 });
    }
    const later = intervals.slice(end + 1).filter((g) => g.quality === "ok" && (g.daEurMwh ?? 0) > price + 12);
    let alternative: Decision["alternative"];
    if (action === "discharge" && later.length) {
      const best = later.reduce((m, g) => ((g.daEurMwh ?? 0) > (m.daEurMwh ?? 0) ? g : m));
      const mwh = group.reduce((s, g) => s + Math.max(0, g.powerKw), 0) * 0.25 / 1000;
      alternative = {
        label: `Holding until ${formatClock(best.ts, asset.timezone)}`,
        expectedCents: Math.round(mwh * (best.daEurMwh ?? 0) * 100),
      };
    }
    out.push({
      id: `dec-${asset.id}-${start.ts}`,
      assetId: asset.id,
      ts: start.ts,
      endTs: group[group.length - 1].ts,
      market: start.market,
      action,
      reason,
      drivers,
      alternative,
      revenueCents: revenue,
      powerKw: power,
    });
    index = end + 1;
  }
  return out;
}

function avg(values: number[]): number {
  return values.reduce((s, n) => s + n, 0) / values.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

let cache: Dataset | null = null;

export function getDataset(): Dataset {
  if (!cache) cache = generate();
  return cache;
}

export function resetDataset(): void {
  cache = null;
}
