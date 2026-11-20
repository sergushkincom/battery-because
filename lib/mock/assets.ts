import { ACTION_ORDER, DEFAULT_MODE } from "../labels";
import type { Asset, AutonomyRule, Country, Market, OnboardingStep, Portfolio } from "../types";

const ALL: Market[] = ["DA", "ID", "AFRR_CAP", "AFRR_ENERGY", "FCR", "IMBALANCE"];
const NO_FCR: Market[] = ["DA", "ID", "AFRR_CAP", "AFRR_ENERGY", "IMBALANCE"];
const ENERGY: Market[] = ["DA", "ID", "IMBALANCE"];

function asset(partial: Asset): Asset {
  return partial;
}

export const PORTFOLIOS: Portfolio[] = [
  {
    id: "kestrel",
    name: "Kestrel Fund I",
    ownerName: "Kestrel Infrastructure",
    assetIds: ["lechfeld-1", "oderbruch", "puglia-nord", "tajo-sur"],
    currency: "EUR",
  },
  {
    id: "elbe",
    name: "Stadtwerk Elbe",
    ownerName: "Stadtwerk Elbe",
    assetIds: ["elbmarsch", "havelland"],
    currency: "EUR",
  },
];

export const ASSETS: Asset[] = [
  asset({
    id: "lechfeld-1",
    name: "Lechfeld 1",
    country: "DE",
    timezone: "Europe/Berlin",
    powerKw: 50_000,
    energyKwh: 100_000,
    roundTripEff: 0.88,
    socMinPct: 5,
    socMaxPct: 95,
    maxCyclesPerDay: 1.5,
    stateOfHealthPct: 97,
    gridLimitKw: 50_000,
    commissionedOn: "2024-06-12",
    strategy: "balanced",
    budgetCentsPerMonth: 0,
    enabledMarkets: ALL,
  }),
  asset({
    id: "oderbruch",
    name: "Oderbruch",
    country: "DE",
    timezone: "Europe/Berlin",
    powerKw: 20_000,
    energyKwh: 40_000,
    roundTripEff: 0.87,
    socMinPct: 5,
    socMaxPct: 95,
    maxCyclesPerDay: 1.5,
    stateOfHealthPct: 96,
    gridLimitKw: 20_000,
    commissionedOn: "2023-11-02",
    strategy: "conservative",
    budgetCentsPerMonth: 0,
    enabledMarkets: ALL,
  }),
  asset({
    id: "puglia-nord",
    name: "Puglia Nord",
    country: "IT",
    timezone: "Europe/Rome",
    powerKw: 40_000,
    energyKwh: 60_000,
    roundTripEff: 0.89,
    socMinPct: 5,
    socMaxPct: 95,
    maxCyclesPerDay: 1.5,
    stateOfHealthPct: 94,
    gridLimitKw: 40_000,
    commissionedOn: "2025-04-19",
    strategy: "aggressive",
    budgetCentsPerMonth: 0,
    enabledMarkets: NO_FCR,
  }),
  asset({
    id: "tajo-sur",
    name: "Tajo Sur",
    country: "ES",
    timezone: "Europe/Madrid",
    powerKw: 30_000,
    energyKwh: 60_000,
    roundTripEff: 0.86,
    socMinPct: 5,
    socMaxPct: 95,
    maxCyclesPerDay: 1.5,
    stateOfHealthPct: 99,
    gridLimitKw: 30_000,
    commissionedOn: "2026-09-12",
    strategy: "balanced",
    budgetCentsPerMonth: 0,
    enabledMarkets: ENERGY,
  }),
  asset({
    id: "elbmarsch",
    name: "Elbmarsch",
    country: "DE",
    timezone: "Europe/Berlin",
    powerKw: 10_000,
    energyKwh: 20_000,
    roundTripEff: 0.88,
    socMinPct: 5,
    socMaxPct: 95,
    maxCyclesPerDay: 1.5,
    stateOfHealthPct: 98,
    gridLimitKw: 10_000,
    commissionedOn: "2024-02-08",
    strategy: "balanced",
    budgetCentsPerMonth: 0,
    enabledMarkets: ALL,
  }),
  asset({
    id: "havelland",
    name: "Havelland",
    country: "DE",
    timezone: "Europe/Berlin",
    powerKw: 15_000,
    energyKwh: 30_000,
    roundTripEff: 0.87,
    socMinPct: 5,
    socMaxPct: 95,
    maxCyclesPerDay: 1.5,
    stateOfHealthPct: 95,
    gridLimitKw: 15_000,
    commissionedOn: "2022-09-30",
    strategy: "conservative",
    budgetCentsPerMonth: 0,
    enabledMarkets: ALL,
  }),
];

export const BUDGET_FACTOR: Record<string, number> = {
  "lechfeld-1": 1.2,
  oderbruch: 1.02,
  "puglia-nord": 0.8,
  "tajo-sur": 1,
  elbmarsch: 1,
  havelland: 1.12,
};

export function isTradingAsset(id: string): boolean {
  return id !== "tajo-sur";
}

export function defaultRules(assetId: string): AutonomyRule[] {
  return ACTION_ORDER.map((action) => ({
    assetId,
    action,
    mode: DEFAULT_MODE[action],
  }));
}

const LIVE_STEPS: OnboardingStep["step"][] = [
  "contract",
  "grid",
  "meters",
  "telemetry",
  "prequal",
  "control",
];

export function onboardingFor(asset: Asset): OnboardingStep[] {
  if (asset.id !== "tajo-sur") {
    return LIVE_STEPS.map((step, i) => ({
      assetId: asset.id,
      step,
      state: "done" as const,
      date: ["2023-01-15", "2023-06-01", "2023-08-20", "2023-10-04", "2024-01-18", asset.commissionedOn][i],
      owner: (["client", "dso", "client", "optimiser", "dso", "optimiser"] as const)[i],
      note: "Complete. The asset is in the trading book.",
    }));
  }
  return [
    {
      assetId: asset.id,
      step: "contract",
      state: "done",
      date: "2026-03-02",
      owner: "client",
      note: "Contract signed with Kestrel Fund I.",
    },
    {
      assetId: asset.id,
      step: "grid",
      state: "done",
      date: "2026-06-18",
      owner: "dso",
      note: "Grid connection agreement in place. Export limit 30 MW.",
    },
    {
      assetId: asset.id,
      step: "meters",
      state: "done",
      date: "2026-08-04",
      owner: "client",
      note: "Settlement meter sealed.",
    },
    {
      assetId: asset.id,
      step: "telemetry",
      state: "done",
      date: "2026-09-12",
      owner: "optimiser",
      note: "Monitoring is live. Control has not been handed over.",
    },
    {
      assetId: asset.id,
      step: "prequal",
      state: "blocked",
      owner: "dso",
      note: "Prequalification is waiting on the DSO to confirm the test window. Nothing can be bid until that slot is on the calendar.",
    },
    {
      assetId: asset.id,
      step: "control",
      state: "not_started",
      owner: "optimiser",
      note: "Control handover comes after prequalification. Trading stays off.",
    },
  ];
}

export function countryOf(assets: Asset[], id: string): Country {
  return assets.find((a) => a.id === id)?.country ?? "DE";
}
