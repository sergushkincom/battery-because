import type { PlanState } from "./types";

export function planState(total: number, budget: number, availabilityPct: number, trading: boolean): PlanState {
  if (!trading) return "not_live";
  if (budget <= 0) return "on_plan";
  const vs = (total - budget) / Math.abs(budget);
  if (vs >= 0.05) return "above_plan";
  if (vs >= -0.07) return "on_plan";
  if (availabilityPct < 97) return "below_availability";
  return "below_market";
}
