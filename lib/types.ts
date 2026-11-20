export type Country = "DE" | "PL" | "IT" | "ES" | "PT";
export type Market = "DA" | "ID" | "AFRR_CAP" | "AFRR_ENERGY" | "FCR" | "IMBALANCE";
export type Role = "owner" | "stadtwerk" | "operator";
export type PlanState =
  | "on_plan"
  | "below_market"
  | "below_availability"
  | "above_plan"
  | "not_live";
export type MarketPosition = "above" | "inline" | "below";
export type IntervalQuality = "ok" | "missing" | "delayed";
export type OutageReason =
  | "planned_maintenance"
  | "grid_curtailment"
  | "dso_instruction"
  | "inverter_fault"
  | "telemetry_loss";

export interface Portfolio {
  id: string;
  name: string;
  ownerName: string;
  assetIds: string[];
  currency: "EUR";
}

export interface Asset {
  id: string;
  name: string;
  country: Country;
  timezone: string;
  powerKw: number;
  energyKwh: number;
  roundTripEff: number;
  socMinPct: number;
  socMaxPct: number;
  maxCyclesPerDay: number;
  stateOfHealthPct: number;
  gridLimitKw: number;
  commissionedOn: string;
  strategy: "conservative" | "balanced" | "aggressive";
  budgetCentsPerMonth: number;
  enabledMarkets: Market[];
}

export interface MarketPrice {
  country: Country;
  ts: string;
  daEurMwh: number;
  idVwapEurMwh: number;
  afrrPosEnergyEurMwh: number;
  afrrNegEnergyEurMwh: number;
  imbalanceEurMwh: number;
}

export interface CapacityPrice {
  country: Country;
  blockStart: string;
  afrrPosEurMwH: number;
  afrrNegEurMwH: number;
  fcrEurMwH: number;
}

export interface WeatherDriver {
  country: Country;
  ts: string;
  windFcMw: number;
  windActMw: number;
  solarFcMw: number;
  solarActMw: number;
  tempC: number;
  loadMw: number;
}

export interface DailyWeather {
  country: Country;
  date: string;
  windFcMw: number;
  windActMw: number;
  solarFcMw: number;
  solarActMw: number;
  tempC: number;
}

export interface DispatchInterval {
  assetId: string;
  ts: string;
  powerKw: number;
  market: Market | null;
  priceEurMwh: number | null;
  daEurMwh: number | null;
  revenueCents: number;
  socPct: number;
  availableKw: number;
  reservedKw: { afrrPos: number; afrrNeg: number; fcr: number };
  decisionId?: string;
  quality: IntervalQuality;
  outageReason: OutageReason | null;
}

export interface Outage {
  assetId: string;
  start: string;
  end: string;
  lostKw: number;
  reason: OutageReason;
  knownAhead: boolean;
}

export interface DailyRevenue {
  assetId: string;
  date: string;
  byMarketCents: Record<Market, number>;
  totalCents: number;
  forecastCents: number;
  budgetCents: number;
  benchmarkCents: number;
  cycles: number;
  availabilityPct: number;
  state: PlanState;
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
  trading: boolean;
}

export interface Driver {
  kind: "spread" | "wind" | "solar" | "availability" | "cap_price" | "soc" | "cycle_limit";
  valueText: string;
  deltaVsNormal: number;
}

export interface Decision {
  id: string;
  assetId: string;
  ts: string;
  endTs: string;
  market: Market;
  action: "bid" | "charge" | "discharge" | "hold" | "reserve";
  reason: string;
  drivers: Driver[];
  alternative?: { label: string; expectedCents: number };
  revenueCents: number;
  powerKw: number;
}

export type OnboardingStepId =
  | "contract"
  | "grid"
  | "meters"
  | "telemetry"
  | "prequal"
  | "control";

export interface OnboardingStep {
  assetId: string;
  step: OnboardingStepId;
  state: "done" | "in_progress" | "blocked" | "not_started";
  date?: string;
  owner: "client" | "optimiser" | "dso";
  note: string;
}

export interface AutonomyRule {
  assetId: string;
  action: string;
  mode: "auto" | "approval" | "never";
}

export interface ApprovalRequest {
  id: string;
  assetId: string;
  createdAt: string;
  deadline: string;
  action: string;
  reason: string;
  expectedCents: [number, number];
  state: "pending" | "approved" | "rejected" | "expired";
  resolvedBy?: string;
}

export interface AuditEntry {
  id: string;
  ts: string;
  assetId: string;
  actor: { type: "system" | "operator" | "owner"; name: string };
  type: "bid" | "dispatch" | "override" | "approval" | "alert" | "report" | "rule_change";
  summary: string;
  reason: string;
  effectCents?: number;
  state: "executed" | "approved" | "rejected" | "expired" | "reverted" | "failed";
  ref?: { ts?: string; decisionId?: string };
}

export interface ExplanationSentence {
  text: string;
  evidence: { assetId: string; from: string; to: string };
}

export interface UsedFigure {
  value: number;
  source: string;
}

export interface Explanation {
  headline: string;
  sentences: ExplanationSentence[];
  bridge: { label: string; cents: number }[];
  used: UsedFigure[];
  deltaCents: number;
  baselineCents: number;
  actualCents: number;
  inputs: { label: string; value: string }[];
}

export interface ExplainInput {
  assetId: string | null;
  assetName: string;
  actual: DailyRevenue[];
  baseline: DailyRevenue[];
  baselineLabel: string;
  weather: DailyWeather[];
  country: Country;
  outages: Outage[];
  planCents: number;
  benchmarkCents: number;
  locale?: "en-GB" | "de-DE";
  focus?: "default" | "afrr" | "outage" | "benchmark" | "tuesday";
}
