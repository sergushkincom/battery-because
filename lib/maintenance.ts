export interface RevenueSlot {
  ts: string;
  revenueCents: number;
}

export function windowImpact(slots: RevenueSlot[], start: string, end: string, lostKw: number, powerKw: number): number {
  if (powerKw <= 0 || lostKw <= 0) return 0;
  const fraction = Math.min(1, lostKw / powerKw);
  const cents = slots.filter((s) => s.ts >= start && s.ts < end).reduce((sum, s) => sum + s.revenueCents, 0);
  return Math.round(cents * fraction);
}

/** Suggest another window of the same length inside ±3 days if it gives up less revenue. */
export function suggestCheaperWindow(
  slots: RevenueSlot[],
  start: string,
  end: string,
  lostKw: number,
  powerKw: number,
): { start: string; end: string; cents: number; saveCents: number } | null {
  const length = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(length) || length <= 0) return null;
  const current = windowImpact(slots, start, end, lostKw, powerKw);
  const from = new Date(Date.parse(start) - 3 * 86_400_000).toISOString();
  const to = new Date(Date.parse(end) + 3 * 86_400_000).toISOString();
  const span = slots.filter((s) => s.ts >= from && s.ts < to).map((s) => s.ts);
  let best: { start: string; end: string; cents: number } | null = null;
  for (const ts of span) {
    const endTs = new Date(Date.parse(ts) + length).toISOString();
    if (ts === start) continue;
    const cents = windowImpact(slots, ts, endTs, lostKw, powerKw);
    if (!best || cents < best.cents) best = { start: ts, end: endTs, cents };
  }
  if (!best || current - best.cents < 10_000) return null;
  return { ...best, saveCents: current - best.cents };
}
