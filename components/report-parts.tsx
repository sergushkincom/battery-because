import type { ReportDay } from "@/lib/reports";
import { formatEUR, formatSignedEUR, type Locale } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One bar per day. Amber marks a day an outage touched. Decorative: the row next to it carries the numbers. */
export function DayBars({ days, className }: { days: ReportDay[]; className?: string }) {
  const max = Math.max(1, ...days.map((day) => day.cents));
  const gap = 1;
  const width = days.length * 4 - gap;
  return (
    <svg viewBox={`0 0 ${width} 20`} preserveAspectRatio="none" className={cn("day-bars block h-5 w-24", className)} aria-hidden="true">
      {days.map((day, index) => {
        const h = Math.max(1, (Math.max(0, day.cents) / max) * 20);
        return <rect key={day.date} x={index * 4} y={20 - h} width={4 - gap} height={h} rx="0.5" fill={day.outage ? "var(--accent)" : "var(--series-da)"} opacity={day.outage ? 1 : 0.55} />;
      })}
    </svg>
  );
}

export interface LedgerRow {
  key: string;
  label: string;
  cents: number;
}

/**
 * The bridge as a ledger: forecast at the top, one row per driver on a shared zero line, actual at the bottom.
 * A waterfall drawn from zero hides drivers that are 1% of the total; here every driver uses the full width.
 */
export function BridgeLedger({
  baselineLabel,
  baselineCents,
  actualCents,
  rows,
  locale,
}: {
  baselineLabel: string;
  baselineCents: number;
  actualCents: number;
  rows: LedgerRow[];
  locale: Locale;
}) {
  const maxAbs = Math.max(1, ...rows.map((row) => Math.abs(row.cents)));
  const net = actualCents - baselineCents;
  return (
    <div className="ledger" role="table" aria-label="Revenue bridge">
      <div className="ledger-row ledger-total" role="row">
        <span role="rowheader">{baselineLabel}</span>
        <span aria-hidden="true" />
        <span role="cell" className="num text-right">
          {formatEUR(baselineCents, locale, 0)}
        </span>
      </div>
      {rows.map((row) => {
        const share = (Math.abs(row.cents) / maxAbs) * 50;
        const up = row.cents > 0;
        return (
          <div key={row.key} className="ledger-row" role="row">
            <span role="rowheader">{row.label}</span>
            <span className="ledger-track" aria-hidden="true">
              <span
                className={cn("ledger-bar", up ? "is-up" : "is-down")}
                style={{ width: `${Math.max(share, 0.6)}%`, [up ? "left" : "right"]: "50%" }}
              />
            </span>
            <span role="cell" className={cn("num text-right", up ? "text-up" : row.cents < 0 ? "text-down" : "text-muted-foreground")}>
              {formatSignedEUR(row.cents, locale, 0)}
            </span>
          </div>
        );
      })}
      <div className="ledger-row ledger-total is-end" role="row">
        <span role="rowheader">Actual</span>
        <span role="cell" className={cn("num text-right text-[12px]", net > 0 ? "text-up" : net < 0 ? "text-down" : "text-muted-foreground")}>
          {formatSignedEUR(net, locale, 0)} net
        </span>
        <span role="cell" className="num text-right">
          {formatEUR(actualCents, locale, 0)}
        </span>
      </div>
    </div>
  );
}

export function Delta({ cents, locale, className }: { cents: number; locale: Locale; className?: string }) {
  return <span className={cn("num", cents > 0 ? "text-up" : cents < 0 ? "text-down" : "text-muted-foreground", className)}>{formatSignedEUR(cents, locale, 0)}</span>;
}
