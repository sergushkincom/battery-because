/**
 * Layout and hover pairing for the revenue bridge.
 * A bar and the driver row under it share one key, so a pointer or
 * keyboard focus on either side highlights the same pair.
 */

export type BridgeRow = {
  label: string;
  cents: number;
  total?: boolean;
};

export type BridgeBar = {
  key: string;
  label: string;
  cents: number;
  total: boolean;
  /** Running total where this bar begins, in cents. Totals begin at zero. */
  start: number;
  /** Running total where this bar ends, in cents. */
  end: number;
};

export type BridgeLink = {
  fromKey: string;
  toKey: string;
  /** Running total the connector sits on, in cents. */
  level: number;
};

export type BridgeLayout = {
  bars: BridgeBar[];
  links: BridgeLink[];
};

/** How a bar, its row, or a connector should look while someone is reading the bridge. */
export type BridgeEmphasis = "rest" | "active" | "dimmed";

/**
 * Each bar grows, then the connector to the next bar draws.
 * The curve lives in CSS: a quick ease-out with no overshoot.
 */
export const BRIDGE_BAR_MS = 260;
export const BRIDGE_LINK_MS = 140;

export function bridgeKey(index: number, label: string): string {
  return `${index}:${label}`;
}

export function layoutBridge(rows: BridgeRow[]): BridgeLayout {
  const bars: BridgeBar[] = [];
  let cursor = 0;
  rows.forEach((row, index) => {
    const total = row.total === true;
    const start = total ? 0 : cursor;
    const end = total ? row.cents : cursor + row.cents;
    bars.push({
      key: bridgeKey(index, row.label),
      label: row.label,
      cents: row.cents,
      total,
      start,
      end,
    });
    cursor = end;
  });
  const links: BridgeLink[] = [];
  for (let index = 0; index < bars.length - 1; index += 1) {
    const from = bars[index];
    const to = bars[index + 1];
    if (!from || !to) continue;
    links.push({ fromKey: from.key, toKey: to.key, level: from.end });
  }
  return { bars, links };
}

/**
 * The pointer wins while it is over a bar or a row. Keyboard focus shows
 * when the pointer is elsewhere, including after the pointer leaves.
 * A key that is not on this bridge clears the highlight instead of dimming everything.
 */
export function bridgeActiveKey(
  pointerKey: string | null,
  focusKey: string | null,
  keys: readonly string[],
): string | null {
  if (pointerKey != null && keys.includes(pointerKey)) return pointerKey;
  if (focusKey != null && keys.includes(focusKey)) return focusKey;
  return null;
}

export function bridgeEmphasis(activeKey: string | null, key: string): BridgeEmphasis {
  if (activeKey == null) return "rest";
  return activeKey === key ? "active" : "dimmed";
}

/** A connector stays bright when either bar it joins is the one being read. */
export function bridgeLinkEmphasis(activeKey: string | null, link: BridgeLink): BridgeEmphasis {
  if (activeKey == null) return "rest";
  if (activeKey === link.fromKey || activeKey === link.toKey) return "active";
  return "dimmed";
}

export function bridgeSchedule(count: number): { barDelay: number; linkDelay: number | null }[] {
  const step = BRIDGE_BAR_MS + BRIDGE_LINK_MS;
  return Array.from({ length: count }, (_, index) => ({
    barDelay: index * step,
    linkDelay: index < count - 1 ? index * step + BRIDGE_BAR_MS : null,
  }));
}
