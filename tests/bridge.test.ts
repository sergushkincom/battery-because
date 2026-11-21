import { describe, expect, it } from "vitest";
import {
  BRIDGE_BAR_MS,
  BRIDGE_LINK_MS,
  bridgeActiveKey,
  bridgeEmphasis,
  bridgeLinkEmphasis,
  bridgeSchedule,
  layoutBridge,
  type BridgeRow,
} from "../lib/bridge";

const rows: BridgeRow[] = [
  { label: "Baseline", cents: 10_000, total: true },
  { label: "Price spread", cents: -3_000 },
  { label: "Availability", cents: -1_500 },
  { label: "Fees and imbalance", cents: 200 },
  { label: "Fees and imbalance", cents: 400 },
  { label: "Actual", cents: 6_100, total: true },
];

describe("revenue bridge hover link", () => {
  const layout = layoutBridge(rows);
  const keys = layout.bars.map((bar) => bar.key);

  it("pairs each bar with the driver row at the same index, even when labels repeat", () => {
    expect(layout.bars.map((bar) => bar.key)).toEqual([
      "0:Baseline",
      "1:Price spread",
      "2:Availability",
      "3:Fees and imbalance",
      "4:Fees and imbalance",
      "5:Actual",
    ]);
    expect(new Set(layout.bars.map((bar) => bar.key)).size).toBe(rows.length);
  });

  it("highlights the same pair whether the pointer is on the bar or the row", () => {
    const fromBar = bridgeActiveKey("2:Availability", null, keys);
    const fromRow = bridgeActiveKey(null, "2:Availability", keys);
    expect(fromBar).toBe("2:Availability");
    expect(fromRow).toBe(fromBar);

    for (const bar of layout.bars) {
      expect(bridgeEmphasis(fromBar, bar.key)).toBe(bar.key === fromBar ? "active" : "dimmed");
      expect(bridgeEmphasis(fromRow, bar.key)).toBe(bar.key === fromRow ? "active" : "dimmed");
    }
  });

  it("lets the pointer win over keyboard focus, then returns to the focused pair", () => {
    expect(bridgeActiveKey("1:Price spread", "5:Actual", keys)).toBe("1:Price spread");
    expect(bridgeActiveKey(null, "5:Actual", keys)).toBe("5:Actual");
    expect(bridgeActiveKey(null, null, keys)).toBeNull();
    expect(bridgeActiveKey("missing", "5:Actual", keys)).toBe("5:Actual");
    expect(bridgeActiveKey("missing", null, keys)).toBeNull();
    expect(bridgeEmphasis(null, "1:Price spread")).toBe("rest");
  });

  it("keeps the connectors that touch the active bar and quiets the others", () => {
    const active = bridgeActiveKey(null, "2:Availability", keys);
    expect(layout.links.map((link) => bridgeLinkEmphasis(active, link))).toEqual([
      "dimmed",
      "active",
      "active",
      "dimmed",
      "dimmed",
    ]);
    expect(layout.links.map((link) => bridgeLinkEmphasis(null, link))).toEqual([
      "rest",
      "rest",
      "rest",
      "rest",
      "rest",
    ]);
  });

  it("draws one connector between neighbours, on the running total", () => {
    expect(layout.links).toEqual([
      { fromKey: "0:Baseline", toKey: "1:Price spread", level: 10_000 },
      { fromKey: "1:Price spread", toKey: "2:Availability", level: 7_000 },
      { fromKey: "2:Availability", toKey: "3:Fees and imbalance", level: 5_500 },
      { fromKey: "3:Fees and imbalance", toKey: "4:Fees and imbalance", level: 5_700 },
      { fromKey: "4:Fees and imbalance", toKey: "5:Actual", level: 6_100 },
    ]);
    expect(layout.bars[1]).toMatchObject({ start: 10_000, end: 7_000, total: false });
    expect(layout.bars[5]).toMatchObject({ start: 0, end: 6_100, total: true });
    expect(layoutBridge([]).links).toEqual([]);
    expect(layoutBridge([{ label: "Only", cents: 40, total: true }]).links).toEqual([]);
  });

  it("starts each bar only after the connector from the previous bar", () => {
    const schedule = bridgeSchedule(layout.bars.length);
    expect(schedule[0]).toEqual({ barDelay: 0, linkDelay: BRIDGE_BAR_MS });
    expect(schedule[1]?.barDelay).toBe(BRIDGE_BAR_MS + BRIDGE_LINK_MS);
    expect(schedule.at(-1)?.linkDelay).toBeNull();
    for (let index = 0; index < schedule.length - 1; index += 1) {
      const current = schedule[index];
      const next = schedule[index + 1];
      expect(current?.linkDelay).toBe((current?.barDelay ?? 0) + BRIDGE_BAR_MS);
      expect(next?.barDelay).toBe((current?.linkDelay ?? 0) + BRIDGE_LINK_MS);
    }
  });
});
