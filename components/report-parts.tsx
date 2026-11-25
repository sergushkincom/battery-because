import type { ReportDay } from "@/lib/reports";
import { formatEUR, formatSignedEUR, type Locale } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One bar per day. Amber marks a day an outage touched. Decorative: the row next to it carries the numbers. */
export function DayBars({ days, className }: { days: ReportDay[]; className?: string }) {
  const max = Math.max(1, ...days.map((day) => day.cents));
  const gap = 1;
  const width = days.length * 4 - gap;
  return (
    <svg viewBox={`0 0 ${width} 20`} preserveAspectRatio="none" className={cn("day-bars block h-5 w-20", className)} aria-hidden="true">
      {days.map((day, index) => {
        const h = Math.max(1, (Math.max(0, day.cents) / max) * 20);
        return <rect key={day.date} x={index * 4} y={20 - h} width={4 - gap} height={h} rx="0.5" fill={day.outage ? "var(--accent)" : "var(--series-da)"} opacity={day.outage ? 1 : 0.55} />;
      })}
    </svg>
  );
}

export interface StatementRow {
  key: string;
  label: string;
  cents: number;
}

/** The bridge read as a statement: the opening figure, one indented line per driver, the result under a double rule. */
export function BridgeStatement({
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
  rows: StatementRow[];
  locale: Locale;
}) {
  return (
    <table className="statement">
      <caption className="sr-only">Revenue bridge</caption>
      <tbody>
        <tr className="open">
          <th scope="row">{openLabel}</th>
          <td>{formatEUR(openCents, locale, 0)}</td>
        </tr>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row" className="indent">
              {row.label}
            </th>
            <td className={row.cents > 0 ? "text-up" : row.cents < 0 ? "text-down" : "text-muted-foreground"}>{formatSignedEUR(row.cents, locale, 0)}</td>
          </tr>
        ))}
        <tr className="close">
          <th scope="row">{closeLabel}</th>
          <td>{formatEUR(closeCents, locale, 0)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function Delta({ cents, locale, className }: { cents: number; locale: Locale; className?: string }) {
  return <span className={cn("num", cents > 0 ? "text-up" : cents < 0 ? "text-down" : "text-muted-foreground", className)}>{formatSignedEUR(cents, locale, 0)}</span>;
}
