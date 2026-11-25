import type { ReportDay } from "@/lib/reports";
import { formatEUR, formatSignedEUR, type Locale } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One bar per day. Amber marks a day an outage touched. Decorative: the row next to it carries the numbers. */
export function DayBars({ days, className }: { days: ReportDay[]; className?: string }) {
  const max = Math.max(1, ...days.map((day) => day.cents));
  const gap = 1;
  const width = days.length * 4 - gap;
  return (
    <svg viewBox={`0 0 ${width} 20`} preserveAspectRatio="none" className={cn("day-bars block h-4 w-20", className)} aria-hidden="true">
      {days.map((day, index) => {
        const h = Math.max(1, (Math.max(0, day.cents) / max) * 20);
        return <rect key={day.date} x={index * 4} y={20 - h} width={4 - gap} height={h} rx="0.5" fill={day.outage ? "var(--accent)" : "var(--series-da)"} opacity={day.outage ? 1 : 0.55} />;
      })}
    </svg>
  );
}

export interface BridgeRow {
  key: string;
  label: string;
  cents: number;
}

/**
 * The bridge as a table: forecast, one row per driver with a bar on a shared zero line, actual.
 * Rows use the shared table pattern, so they are as high as every other table row.
 */
export function BridgeTable({
  openLabel,
  openCents,
  closeLabel,
  closeCents,
  rows,
  locale,
}: {
  openLabel: string;
  openCents: number;
  closeLabel: string;
  closeCents: number;
  rows: BridgeRow[];
  locale: Locale;
}) {
  const maxAbs = Math.max(1, ...rows.map((row) => Math.abs(row.cents)));
  const net = closeCents - openCents;
  return (
    <div className="overflow-x-auto">
      <table className="table-grid">
        <caption className="sr-only">Revenue bridge from forecast to actual</caption>
        <thead>
          <tr>
            <th scope="col">Driver</th>
            <th scope="col" className="hidden sm:table-cell">
              <span className="sr-only">Size</span>
            </th>
            <th scope="col" className="text-right">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="font-semibold">
            <th scope="row" className="whitespace-nowrap">
              {openLabel}
            </th>
            <td className="hidden sm:table-cell" />
            <td className="num text-right">{formatEUR(openCents, locale, 0)}</td>
          </tr>
          {rows.map((row) => {
            const up = row.cents > 0;
            return (
              <tr key={row.key}>
                <th scope="row" className="whitespace-nowrap">
                  {row.label}
                </th>
                <td className="hidden w-[40%] sm:table-cell">
                  <span className="bridge-track" aria-hidden="true">
                    <i className={up ? "bg-primary" : "bg-down"} style={{ width: `${Math.max(0.8, (Math.abs(row.cents) / maxAbs) * 50)}%`, [up ? "left" : "right"]: "50%" }} />
                  </span>
                </td>
                <td className={cn("num text-right", up ? "text-up" : row.cents < 0 ? "text-down" : "text-muted-foreground")}>{formatSignedEUR(row.cents, locale, 0)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="whitespace-nowrap text-left font-semibold">
              {closeLabel}
            </th>
            <td className={cn("num hidden sm:table-cell", net > 0 ? "text-up" : net < 0 ? "text-down" : "text-muted-foreground")}>{formatSignedEUR(net, locale, 0)} net</td>
            <td className="num text-right">{formatEUR(closeCents, locale, 0)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function Delta({ cents, locale, className }: { cents: number; locale: Locale; className?: string }) {
  return <span className={cn("num", cents > 0 ? "text-up" : cents < 0 ? "text-down" : "text-muted-foreground", className)}>{formatSignedEUR(cents, locale, 0)}</span>;
}
