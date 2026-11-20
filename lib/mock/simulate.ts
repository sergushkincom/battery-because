import { emptyMarkets } from "../labels";
import type { Asset, DailyRevenue, DispatchInterval, Market, OutageReason } from "../types";
import { quantile } from "./prng";

export interface SimSlot {
  ts: string;
  da: number;
  idPrice: number;
  afrrPosEnergy: number;
  afrrNegEnergy: number;
  imbalance: number;
  capAfrrPos: number;
  capAfrrNeg: number;
  capFcr: number;
  availableKw: number;
  maxDischargeKw: number | null;
  quality: DispatchInterval["quality"];
  outageReason: OutageReason | null;
  lostKw: number;
}

export interface SimOptions {
  useId: boolean;
  reserveCapacity: boolean;
  socStartKwh: number;
  desiredCycles: number;
  blockBestDischarge: boolean;
}

export interface DayMetrics {
  byMarketCents: Record<Market, number>;
  totalCents: number;
  cycles: number;
  availabilityPct: number;
  dischargedMwh: number;
  chargedMwh: number;
  batteryDischargeMwh: number;
  spreadComponentCents: number;
  capturedSpreadEurMwh: number;
  idExtraCents: number;
  capacityCents: number;
  reservedMwh: number;
  avgCapPriceEurMwH: number;
  availableMwh: number;
  nameplateMwh: number;
  eurPerAvailableMwh: number;
  cycleLimitSkippedCents: number;
  gridConstraintCents: number;
  gridLostMwh: number;
  imbalanceCents: number;
  settledSlots: number;
}

export interface SimDayResult {
  intervals: DispatchInterval[];
  socEndKwh: number;
  metrics: DayMetrics;
  failedBid: { ts: string; priceEurMwh: number; expectedCents: number } | null;
}

function zeros(): DayMetrics {
  return {
    byMarketCents: emptyMarkets(),
    totalCents: 0,
    cycles: 0,
    availabilityPct: 0,
    dischargedMwh: 0,
    chargedMwh: 0,
    batteryDischargeMwh: 0,
    spreadComponentCents: 0,
    capturedSpreadEurMwh: 0,
    idExtraCents: 0,
    capacityCents: 0,
    reservedMwh: 0,
    avgCapPriceEurMwH: 0,
    availableMwh: 0,
    nameplateMwh: 0,
    eurPerAvailableMwh: 0,
    cycleLimitSkippedCents: 0,
    gridConstraintCents: 0,
    gridLostMwh: 0,
    imbalanceCents: 0,
    settledSlots: 0,
  };
}

function noteGrid(metrics: DayMetrics, slot: SimSlot): void {
  if (slot.outageReason !== "dso_instruction" && slot.outageReason !== "grid_curtailment") return;
  if (slot.lostKw <= 0) return;
  const lostMwh = (slot.lostKw / 1000) * 0.25;
  metrics.gridLostMwh += lostMwh;
  metrics.gridConstraintCents += Math.round(lostMwh * Math.max(slot.da, 30) * 100);
}

function selectSlots(
  da: number[],
  n: number,
  can: boolean[],
  rte: number,
): { charge: Set<number>; discharge: Set<number> } {
  const dischargeCands = da
    .map((p, i) => ({ p, i }))
    .filter((x) => can[x.i])
    .sort((a, b) => b.p - a.p || a.i - b.i);
  const chargeCands = da
    .map((p, i) => ({ p, i }))
    .filter((x) => can[x.i])
    .sort((a, b) => a.p - b.p || a.i - b.i);
  const discharge = new Set<number>();
  for (const c of dischargeCands) {
    if (discharge.size >= n) break;
    discharge.add(c.i);
  }
  const rankedDischarge = [...discharge].sort((a, b) => da[b] - da[a]);
  const charge = new Set<number>();
  for (const c of chargeCands) {
    if (charge.size >= n) break;
    if (discharge.has(c.i)) continue;
    const clears = rankedDischarge.some((i) => da[i] * rte > c.p * 1.03);
    if (!clears) break;
    charge.add(c.i);
  }
  for (const i of [...discharge]) {
    if (charge.has(i)) discharge.delete(i);
  }
  return { charge, discharge };
}

export function simulateDay(asset: Asset, slots: SimSlot[], opts: SimOptions): SimDayResult {
  const metrics = zeros();
  const intervals: DispatchInterval[] = [];
  const minKwh = (asset.energyKwh * asset.socMinPct) / 100;
  const maxKwh = (asset.energyKwh * asset.socMaxPct) / 100;
  const usableKwh = maxKwh - minKwh;
  const eta = Math.sqrt(asset.roundTripEff);
  const rte = asset.roundTripEff;
  let soc = Math.min(maxKwh, Math.max(minKwh, opts.socStartKwh));
  let batteryOut = 0;
  const cycleLimit = usableKwh * asset.maxCyclesPerDay;
  const slotEnergy = asset.powerKw * 0.25 * eta;
  const n = Math.max(1, Math.round((opts.desiredCycles * usableKwh) / Math.max(slotEnergy, 1)));

  const da = slots.map((s) => s.da);
  const sorted = [...da].sort((a, b) => a - b);
  const spread = quantile(sorted, 0.8) - quantile(sorted, 0.2);
  const bias = asset.strategy === "conservative" ? 0.7 : asset.strategy === "aggressive" ? 1.45 : 1;
  const hurdle = Math.max(4, spread * 0.16 * bias);

  const planned = slots.map((slot) => {
    if (!opts.reserveCapacity || slot.quality !== "ok") {
      return { afrrPos: 0, afrrNeg: 0, fcr: 0 };
    }
    const enabled = new Set(asset.enabledMarkets);
    const pos = enabled.has("AFRR_CAP") ? slot.capAfrrPos : 0;
    const neg = enabled.has("AFRR_CAP") ? slot.capAfrrNeg : 0;
    const fcr = enabled.has("FCR") ? slot.capFcr : 0;
    const best = Math.max(pos, neg, fcr);
    if (best < hurdle) return { afrrPos: 0, afrrNeg: 0, fcr: 0 };
    if (fcr >= pos && fcr >= neg && fcr >= hurdle) {
      return { afrrPos: 0, afrrNeg: 0, fcr: asset.powerKw * 0.2 };
    }
    return {
      afrrPos: enabled.has("AFRR_CAP") ? asset.powerKw * 0.25 : 0,
      afrrNeg: enabled.has("AFRR_CAP") ? asset.powerKw * 0.15 : 0,
      fcr: 0,
    };
  });

  const headroom = slots.map((slot, i) => {
    const avail = slot.quality === "ok" ? slot.availableKw : 0;
    const fcr = Math.min(planned[i].fcr, avail);
    const rest = Math.max(0, avail - fcr);
    const afrrPos = Math.min(planned[i].afrrPos, rest);
    const afrrNeg = Math.min(planned[i].afrrNeg, rest);
    const charge = Math.max(0, avail - fcr - afrrNeg);
    let discharge = Math.max(0, avail - fcr - afrrPos);
    if (slot.maxDischargeKw != null) discharge = Math.min(discharge, slot.maxDischargeKw);
    return { afrrPos, afrrNeg, fcr, charge, discharge };
  });

  const can = headroom.map((h) => h.discharge > 50 || h.charge > 50);
  const plan = selectSlots(da, n, can, rte);
  let failedBid: SimDayResult["failedBid"] = null;
  if (opts.blockBestDischarge && plan.discharge.size) {
    let best = -1;
    let bestP = -Infinity;
    for (const i of plan.discharge) {
      if (da[i] > bestP) {
        bestP = da[i];
        best = i;
      }
    }
    if (best >= 0) {
      plan.discharge.delete(best);
      const mwh = (Math.min(headroom[best].discharge, asset.powerKw) * 0.25) / 1000;
      failedBid = {
        ts: slots[best].ts,
        priceEurMwh: da[best],
        expectedCents: Math.round(mwh * Math.max(da[best], 0) * 100),
      };
    }
  }

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const reserve = headroom[i];
    const socPct = (soc / asset.energyKwh) * 100;

    if (slot.quality === "delayed") {
      intervals.push(idle(asset, slot, socPct, reserve,  slot.availableKw));
      continue;
    }

    const unavailable = slot.quality === "missing" || slot.availableKw <= 0;
    if (unavailable) {
      noteGrid(metrics, slot);
      metrics.nameplateMwh += (asset.powerKw / 1000) * 0.25;
      metrics.settledSlots += 1;
      intervals.push(idle(asset, slot, socPct, { afrrPos: 0, afrrNeg: 0, fcr: 0 }, 0));
      continue;
    }

    let powerKw = 0;
    let market: Market | null = null;
    let price: number | null = null;
    let revenue = 0;
    let daCents = 0;

    if (plan.discharge.has(i) && reserve.discharge > 0) {
      const inventory = Math.max(0, soc - minKwh);
      let deliverKwh = Math.min(reserve.discharge * 0.25, inventory * eta);
      const remaining = cycleLimit - batteryOut;
      const maxDeliver = Math.max(0, remaining * eta);
      if (deliverKwh > maxDeliver + 1e-6) {
        const skipped = deliverKwh - maxDeliver;
        metrics.cycleLimitSkippedCents += Math.round((skipped / 1000) * Math.max(slot.da, 0) * 100);
        deliverKwh = maxDeliver;
      }
      if (deliverKwh > 0.05) {
        const batteryKwh = deliverKwh / eta;
        soc -= batteryKwh;
        batteryOut += batteryKwh;
        powerKw = deliverKwh / 0.25;
        const useId = opts.useId && slot.idPrice > slot.da + 8;
        price = round2(useId ? slot.idPrice : slot.da);
        market = useId ? "ID" : "DA";
        revenue = Math.round((deliverKwh / 1000) * price * 100);
        daCents = Math.round((deliverKwh / 1000) * slot.da * 100);
        metrics.dischargedMwh += deliverKwh / 1000;
        metrics.batteryDischargeMwh += batteryKwh / 1000;
      }
    } else if (plan.charge.has(i) && reserve.charge > 0) {
      const room = Math.max(0, maxKwh - soc);
      const store = Math.min(room, reserve.charge * 0.25 * eta);
      if (store > 0.05) {
        const gridKwh = store / eta;
        soc += store;
        powerKw = -(gridKwh / 0.25);
        const useId = opts.useId && slot.idPrice < slot.da - 8;
        price = round2(useId ? slot.idPrice : slot.da);
        market = useId ? "ID" : "DA";
        revenue = -Math.round((gridKwh / 1000) * price * 100);
        daCents = -Math.round((gridKwh / 1000) * slot.da * 100);
        metrics.chargedMwh += gridKwh / 1000;
      }
    }

    if (reserve.afrrPos > 0 && soc - minKwh > 0.05) {
      const roomKw = Math.max(0, slot.availableKw - Math.max(0, powerKw));
      const kw = Math.min(reserve.afrrPos * 0.08, roomKw);
      let deliver = Math.min(kw * 0.25, Math.max(0, soc - minKwh) * eta);
      deliver = Math.min(deliver, Math.max(0, (cycleLimit - batteryOut) * eta));
      if (deliver > 0.05) {
        const batteryKwh = deliver / eta;
        soc -= batteryKwh;
        batteryOut += batteryKwh;
        powerKw += deliver / 0.25;
        const cents = Math.round((deliver / 1000) * slot.afrrPosEnergy * 100);
        metrics.byMarketCents.AFRR_ENERGY += cents;
        if (!market) {
          market = "AFRR_ENERGY";
          price = slot.afrrPosEnergy;
        }
      }
    }

    if (reserve.afrrNeg > 0 && maxKwh - soc > 0.05) {
      const roomKw = Math.max(0, slot.availableKw - Math.abs(Math.min(0, powerKw)));
      const kw = Math.min(reserve.afrrNeg * 0.08, roomKw);
      const store = Math.min(kw * 0.25 * eta, maxKwh - soc);
      if (store > 0.05) {
        soc += store;
        powerKw -= store / eta / 0.25;
        const cents = Math.round((store / eta / 1000) * Math.max(20, 40 - slot.afrrNegEnergy) * 100);
        metrics.byMarketCents.AFRR_ENERGY += cents;
        if (!market) {
          market = "AFRR_ENERGY";
          price = slot.afrrNegEnergy;
        }
      }
    }

    const h = 0.25;
    metrics.byMarketCents.AFRR_CAP += Math.round((reserve.afrrPos / 1000) * h * slot.capAfrrPos * 100);
    metrics.byMarketCents.AFRR_CAP += Math.round((reserve.afrrNeg / 1000) * h * slot.capAfrrNeg * 100);
    metrics.byMarketCents.FCR += Math.round((reserve.fcr / 1000) * h * slot.capFcr * 100);
    metrics.reservedMwh += ((reserve.afrrPos + reserve.afrrNeg + reserve.fcr) / 1000) * h;

    noteGrid(metrics, slot);

    if (market === "DA" || market === "ID") {
      metrics.byMarketCents[market] += revenue;
      metrics.spreadComponentCents += daCents;
      metrics.idExtraCents += revenue - daCents;
      if (market === "ID") {
        const mwh = (Math.abs(powerKw) * h) / 1000;
        const imb = -Math.round(mwh * 0.04 * Math.abs(slot.imbalance - (price ?? slot.da)) * 100);
        metrics.byMarketCents.IMBALANCE += imb;
      }
    }

    if (soc < minKwh && minKwh - soc < 1e-3) soc = minKwh;
    if (soc > maxKwh && soc - maxKwh < 1e-3) soc = maxKwh;

    metrics.availableMwh += (slot.availableKw / 1000) * h;
    metrics.nameplateMwh += (asset.powerKw / 1000) * h;
    metrics.settledSlots += 1;

    intervals.push({
      assetId: asset.id,
      ts: slot.ts,
      powerKw: roundKw(powerKw),
      market,
      priceEurMwh: price,
      daEurMwh: slot.da,
      revenueCents: market === "DA" || market === "ID" ? revenue : 0,
      socPct: (soc / asset.energyKwh) * 100,
      availableKw: slot.availableKw,
      reservedKw: { afrrPos: reserve.afrrPos, afrrNeg: reserve.afrrNeg, fcr: reserve.fcr },
      quality: slot.quality,
      outageReason: slot.outageReason,
    });
  }

  finish(metrics, usableKwh);
  return { intervals, socEndKwh: soc, metrics, failedBid };
}

function idle(
  asset: Asset,
  slot: SimSlot,
  socPct: number,
  reserve: { afrrPos: number; afrrNeg: number; fcr: number },
  availableKw: number,
): DispatchInterval {
  return {
    assetId: asset.id,
    ts: slot.ts,
    powerKw: 0,
    market: null,
    priceEurMwh: null,
    daEurMwh: slot.da,
    revenueCents: 0,
    socPct,
    availableKw,
    reservedKw: { afrrPos: reserve.afrrPos, afrrNeg: reserve.afrrNeg, fcr: reserve.fcr },
    quality: slot.quality,
    outageReason: slot.outageReason,
  };
}

function finish(metrics: DayMetrics, usableKwh: number): void {
  metrics.totalCents = Object.values(metrics.byMarketCents).reduce((s, n) => s + n, 0);
  metrics.capturedSpreadEurMwh =
    metrics.dischargedMwh > 0 ? metrics.spreadComponentCents / 100 / metrics.dischargedMwh : 0;
  const capPay = metrics.byMarketCents.AFRR_CAP + metrics.byMarketCents.FCR;
  metrics.capacityCents = capPay + metrics.byMarketCents.AFRR_ENERGY;
  metrics.avgCapPriceEurMwH = metrics.reservedMwh > 0 ? capPay / 100 / metrics.reservedMwh : 0;
  metrics.cycles = usableKwh > 0 ? metrics.batteryDischargeMwh / (usableKwh / 1000) : 0;
  metrics.availabilityPct =
    metrics.nameplateMwh > 0 ? (metrics.availableMwh / metrics.nameplateMwh) * 100 : 0;
  metrics.imbalanceCents = metrics.byMarketCents.IMBALANCE;
  metrics.eurPerAvailableMwh =
    metrics.availableMwh > 0 ? metrics.totalCents / 100 / metrics.availableMwh : 0;
}

export function blankDay(assetId: string, date: string, trading: boolean): DailyRevenue {
  return {
    assetId,
    date,
    byMarketCents: emptyMarkets(),
    totalCents: 0,
    forecastCents: 0,
    budgetCents: 0,
    benchmarkCents: 0,
    cycles: 0,
    availabilityPct: trading ? 100 : 0,
    state: trading ? "on_plan" : "not_live",
    dischargedMwh: 0,
    chargedMwh: 0,
    batteryDischargeMwh: 0,
    spreadComponentCents: 0,
    capturedSpreadEurMwh: 0,
    idExtraCents: 0,
    capacityCents: 0,
    reservedMwh: 0,
    avgCapPriceEurMwH: 0,
    availableMwh: 0,
    nameplateMwh: 0,
    eurPerAvailableMwh: 0,
    cycleLimitSkippedCents: 0,
    gridConstraintCents: 0,
    gridLostMwh: 0,
    imbalanceCents: 0,
    settledSlots: trading ? 96 : 0,
    trading,
  };
}

export function metricsToDaily(
  assetId: string,
  date: string,
  metrics: DayMetrics,
  extra: Pick<DailyRevenue, "forecastCents" | "budgetCents" | "benchmarkCents" | "state" | "trading">,
): DailyRevenue {
  return { assetId, date, ...metrics, ...extra };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundKw(n: number): number {
  return Math.round(n * 10) / 10;
}
