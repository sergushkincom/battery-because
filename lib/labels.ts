import type {
  Market,
  MarketPosition,
  OnboardingStepId,
  OutageReason,
  PlanState,
  Role,
} from "./types";

export const MARKET_LABEL: Record<Market, string> = {
  DA: "Day-ahead",
  ID: "Intraday",
  AFRR_CAP: "aFRR capacity",
  AFRR_ENERGY: "aFRR energy",
  FCR: "FCR",
  IMBALANCE: "Imbalance",
};

export const MARKETS: Market[] = ["DA", "ID", "AFRR_CAP", "AFRR_ENERGY", "FCR", "IMBALANCE"];

export const PLAN_LABEL: Record<PlanState, string> = {
  on_plan: "On plan",
  below_market: "Below plan – market",
  below_availability: "Below plan – availability",
  above_plan: "Above plan",
  not_live: "Not live",
};

export const POSITION_LABEL: Record<MarketPosition, string> = {
  above: "Above market",
  inline: "In line with market",
  below: "Below market",
};

export const OUTAGE_LABEL: Record<OutageReason, string> = {
  planned_maintenance: "Planned maintenance",
  grid_curtailment: "Grid curtailment",
  dso_instruction: "DSO instruction",
  inverter_fault: "Inverter fault",
  telemetry_loss: "Telemetry gap",
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Asset owner",
  stadtwerk: "Stadtwerk",
  operator: "Operator",
};

export const STEP_LABEL: Record<OnboardingStepId, string> = {
  contract: "Contract signed",
  grid: "Grid connection",
  meters: "Meters installed",
  telemetry: "Telemetry connected",
  prequal: "Prequalification",
  control: "Control handed over",
};

export const STEP_STATE_LABEL = {
  done: "Done",
  in_progress: "In progress",
  blocked: "Blocked – waiting on DSO",
  not_started: "Not started",
} as const;

export const AUDIT_STATE_LABEL = {
  executed: "Executed",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  reverted: "Reverted",
  failed: "Failed",
} as const;

export const MODE_LABEL = {
  auto: "Acts alone",
  approval: "Needs approval",
  never: "Never alone",
} as const;

export const ACTOR_LABEL = {
  system: "System",
  operator: "Operator",
  owner: "Owner",
} as const;

export const ACTION_ORDER = [
  "Intraday re-optimisation within limits",
  "Day-ahead bidding within strategy",
  "Balancing capacity bid (aFRR/FCR)",
  "Exceed daily cycle budget (>1.5 cycles)",
  "Bid while SoH below threshold / after alarm",
  "Change of strategy (risk profile, market mix)",
  "Trading during reported maintenance window",
] as const;

export const DEFAULT_MODE: Record<(typeof ACTION_ORDER)[number], "auto" | "approval" | "never"> = {
  "Intraday re-optimisation within limits": "auto",
  "Day-ahead bidding within strategy": "auto",
  "Balancing capacity bid (aFRR/FCR)": "auto",
  "Exceed daily cycle budget (>1.5 cycles)": "approval",
  "Bid while SoH below threshold / after alarm": "approval",
  "Change of strategy (risk profile, market mix)": "never",
  "Trading during reported maintenance window": "never",
};

export function emptyMarkets(): Record<Market, number> {
  return { DA: 0, ID: 0, AFRR_CAP: 0, AFRR_ENERGY: 0, FCR: 0, IMBALANCE: 0 };
}
