"use client";

import { useState, type CSSProperties } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BRIDGE_BAR_MS,
  BRIDGE_LINK_MS,
  bridgeActiveKey,
  bridgeEmphasis,
  bridgeLinkEmphasis,
  bridgeSchedule,
  layoutBridge,
  type BridgeBar,
} from "@/lib/bridge";
import { formatEUR, formatSignedEUR, type Locale } from "@/lib/format";
import { weekdayIndex } from "@/lib/time";
import { cn } from "@/lib/utils";

export function ShowData({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button className="link text-[12px]" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? "Hide data" : "Show data"}
      </button>
      {open && (
        <div className="table-wrap mt-2 max-h-64 overflow-auto">
          <table className="table-grid">
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header} scope="col">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="num">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export interface TimelinePoint {
  label: string;
  ts: string;
  da: number | null;
  id: number | null;
  charge: number;
  discharge: number;
  soc: number | null;
  story: string;
  powerKw: number;
}

export function DispatchTimeline({
  points,
  onSelect,
  selected,
}: {
  points: TimelinePoint[];
  onSelect: (ts: string) => void;
  selected?: string | null;
}) {
  const selectedLabel = points.find((p) => p.ts === selected)?.label;
  return (
    <div>
      <div className="h-[300px] w-full min-w-0 cursor-crosshair" role="img" aria-label="Dispatch timeline for the selected day">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            // Any quarter-hour can be picked, not only the thin charge and discharge bars.
            onClick={(state) => {
              const byLabel = points.find((p) => p.label === state?.activeLabel);
              const index = state?.activeTooltipIndex == null ? NaN : Number(state.activeTooltipIndex);
              const point = byLabel ?? (Number.isInteger(index) ? points[index] : undefined);
              if (point) onSelect(point.ts);
            }}
          >
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} interval={7} />
            <YAxis yAxisId="eur" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={42} unit="" />
            <YAxis yAxisId="mw" orientation="right" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={36} />
            <YAxis yAxisId="soc" orientation="right" hide domain={[0, 100]} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const row = payload[0].payload as TimelinePoint;
                return (
                  <div className="max-w-xs rounded-[6px] border border-border bg-card px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]">
                    {row.story}
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              yAxisId="mw"
              dataKey="charge"
              name="Charge MW"
              fill="var(--charge)"
              maxBarSize={8}
              onClick={(row) => {
                const point = row as unknown as TimelinePoint;
                if (point.ts) onSelect(point.ts);
              }}
            />
            <Bar
              yAxisId="mw"
              dataKey="discharge"
              name="Discharge MW"
              fill="var(--discharge)"
              maxBarSize={8}
              onClick={(row) => {
                const point = row as unknown as TimelinePoint;
                if (point.ts) onSelect(point.ts);
              }}
            />
            <Line yAxisId="eur" type="monotone" dataKey="da" name="Day-ahead €/MWh" stroke="var(--series-da)" strokeWidth={1.75} dot={false} />
            <Line yAxisId="eur" type="monotone" dataKey="id" name="Intraday €/MWh" stroke="var(--series-id)" strokeWidth={1.5} dot={false} connectNulls />
            <Line yAxisId="soc" type="monotone" dataKey="soc" name="SoC %" stroke="var(--series-soc)" strokeWidth={1.5} dot={false} />
            {selectedLabel && <ReferenceLine yAxisId="mw" x={selectedLabel} stroke="var(--primary)" strokeWidth={2} strokeDasharray="3 3" ifOverflow="extendDomain" />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ShowData
        headers={["Time", "Day-ahead", "Intraday", "Charge MW", "Discharge MW", "SoC %"]}
        rows={points.map((p) => [p.label, p.da ?? "—", p.id ?? "—", p.charge || "—", p.discharge || "—", p.soc ?? "—"])}
      />
    </div>
  );
}

export function PriceChart({ rows }: { rows: { label: string; da: number; id: number }[] }) {
  return (
    <div className="h-[240px] w-full" role="img" aria-label="Day-ahead and intraday prices">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
          <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={42} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-[6px] border border-border bg-card px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]">
                  <p>{label}</p>
                  {payload.map((item) => (
                    <p key={String(item.name)} className="num">
                      {item.name}: {item.value} €/MWh
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line dataKey="da" name="Day-ahead" stroke="var(--series-da)" strokeWidth={1.75} dot={false} />
          <Line dataKey="id" name="Intraday" stroke="var(--series-id)" strokeWidth={1.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StackedMarkets({
  rows,
}: {
  rows: { label: string; DA: number; ID: number; AFRR_CAP: number; AFRR_ENERGY: number; FCR: number; IMBALANCE: number }[];
}) {
  return (
    <div>
      <div className="h-[240px] w-full" role="img" aria-label="Revenue by market">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={48} tickFormatter={compactEuro} axisLine={false} tickLine={false} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-[6px] border border-border bg-card px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]">
                    <p className="font-medium">{label}</p>
                    {payload.map((item) => (
                      <p key={String(item.name)} className="num">
                        {item.name}: {formatEUR(Number(item.value) * 100, "en-GB", 0)}
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="DA" name="Day-ahead" stackId="m" fill="var(--series-da)" />
            <Bar dataKey="ID" name="Intraday" stackId="m" fill="var(--series-id)" />
            <Bar dataKey="AFRR_CAP" name="aFRR capacity" stackId="m" fill="var(--series-cap)" />
            <Bar dataKey="AFRR_ENERGY" name="aFRR energy" stackId="m" fill="var(--discharge)" />
            <Bar dataKey="FCR" name="FCR" stackId="m" fill="var(--series-fcr)" />
            <Bar dataKey="IMBALANCE" name="Imbalance" stackId="m" fill="var(--price-down)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ShowData
        headers={["Day", "Day-ahead", "Intraday", "aFRR capacity", "aFRR energy", "FCR", "Imbalance"]}
        rows={rows.map((r) => [r.label, r.DA, r.ID, r.AFRR_CAP, r.AFRR_ENERGY, r.FCR, r.IMBALANCE])}
      />
    </div>
  );
}

/** 19500 → "€19.5k", so the axis reads at a glance. */
function compactEuro(value: number): string {
  const abs = Math.abs(value);
  const text = abs >= 1000 ? `${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k` : String(Math.round(abs));
  return `${value < 0 ? "−" : ""}€${text}`;
}

const BRIDGE_W = 640;
const BRIDGE_H = 200;
const BRIDGE_PAD = 28;

export function WaterfallChart({
  rows,
  locale,
  animated = false,
}: {
  rows: { label: string; cents: number; total?: boolean }[];
  locale: Locale;
  /** Build the bars left to right. Off for the smaller bridges on the day and report pages. */
  animated?: boolean;
}) {
  const { bars, links } = layoutBridge(rows);
  const [pointerKey, setPointerKey] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const keys = bars.map((bar) => bar.key);
  const activeKey = bridgeActiveKey(pointerKey, focusKey, keys);
  const schedule = bridgeSchedule(bars.length);
  const frame = bridgeFrame(bars);

  if (bars.length === 0 || !frame) return null;

  const point = (key: string) => ({
    onPointerEnter: () => setPointerKey(key),
    onPointerLeave: () => setPointerKey((current) => (current === key ? null : current)),
    onFocus: () => setFocusKey(key),
    onBlur: () => setFocusKey((current) => (current === key ? null : current)),
  });

  return (
    <figure
      className={cn("bridge-chart", animated && "is-animated")}
      key={animated ? bars.map((bar) => `${bar.key}:${bar.cents}`).join("|") : undefined}
      style={{ "--bridge-bar": `${BRIDGE_BAR_MS}ms`, "--bridge-link": `${BRIDGE_LINK_MS}ms` } as CSSProperties}
    >
      <svg viewBox={`0 0 ${BRIDGE_W} ${BRIDGE_H + 36}`} className="bridge-svg h-auto w-full overflow-visible" role="group" aria-label="Revenue bridge">
        <line x1="0" x2={BRIDGE_W} y1={frame.y(0)} y2={frame.y(0)} stroke="var(--border)" />
        {links.map((link, index) => {
          const from = frame.xAt(index) + frame.barWidth;
          const to = frame.xAt(index + 1);
          const delay = schedule[index]?.linkDelay ?? 0;
          const y = frame.y(link.level);
          return (
            <g
              key={`${link.fromKey}-${link.toKey}`}
              className="bridge-link"
              data-state={bridgeLinkEmphasis(activeKey, link)}
              style={{ "--bridge-delay": `${delay}ms` } as CSSProperties}
              aria-hidden="true"
            >
              <rect className="bridge-link-draw" x={from + 1.5} y={y - 0.5} width={Math.max(0, to - from - 3)} height={1} />
            </g>
          );
        })}
        {bars.map((bar, index) => {
          const top = frame.y(Math.max(bar.start, bar.end));
          const bottom = frame.y(Math.min(bar.start, bar.end));
          const up = bar.end >= bar.start;
          const fill = bar.total ? "var(--series-da)" : up ? "var(--price-up)" : "var(--price-down)";
          const emphasis = bridgeEmphasis(activeKey, bar.key);
          const amount = bridgeAmount(bar, locale);
          const delay = schedule[index]?.barDelay ?? 0;
          return (
            <g
              key={bar.key}
              className="bridge-col"
              data-state={emphasis}
              style={{ "--bridge-delay": `${delay}ms` } as CSSProperties}
              {...point(bar.key)}
            >
              <rect className="bridge-hit" x={index * frame.slot} y={0} width={frame.slot} height={BRIDGE_H + 28} fill="transparent" aria-hidden="true" />
              <rect
                className="bridge-bar"
                data-dir={up ? "up" : "down"}
                x={frame.xAt(index)}
                y={top}
                width={frame.barWidth}
                height={Math.max(1.5, bottom - top)}
                fill={fill}
                rx="2"
                tabIndex={0}
                role="img"
                aria-label={`${bar.label}, ${amount}`}
                aria-current={emphasis === "active" ? "true" : undefined}
                style={{ "--bridge-origin": up ? "bottom" : "top" } as CSSProperties}
              />
              <text className="bridge-label" x={frame.xAt(index) + frame.barWidth / 2} y={BRIDGE_H + 16} textAnchor="middle" fill="var(--muted-foreground)" fontSize="10" aria-hidden="true">
                {shortBridgeLabel(bar.label)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 grid gap-0.5">
        {bars.map((bar) => {
          const emphasis = bridgeEmphasis(activeKey, bar.key);
          const tone = bar.total ? "total" : bar.cents < 0 ? "down" : bar.cents > 0 ? "up" : "flat";
          return (
            <li
              key={bar.key}
              className="bridge-row flex justify-between gap-3 px-2 py-1 text-[12px]"
              data-state={emphasis}
              data-tone={tone}
              tabIndex={0}
              aria-current={emphasis === "active" ? "true" : undefined}
              {...point(bar.key)}
            >
              <span>{bar.label}</span>
              <span className={cn("num", !bar.total && bar.cents < 0 && "text-down", !bar.total && bar.cents > 0 && "text-up")}>
                {bridgeAmount(bar, locale)}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

function bridgeAmount(bar: BridgeBar, locale: Locale): string {
  return bar.total ? formatEUR(bar.cents, locale, 0) : formatSignedEUR(bar.cents, locale, 0);
}

function bridgeFrame(bars: BridgeBar[]) {
  if (bars.length === 0) return null;
  const values = bars.flatMap((bar) => [bar.start, bar.end]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const y = (value: number) => BRIDGE_PAD + ((max - value) / span) * (BRIDGE_H - BRIDGE_PAD * 2);
  const slot = BRIDGE_W / bars.length;
  const barWidth = slot * 0.56;
  const xAt = (index: number) => index * slot + (slot - barWidth) / 2;
  return { y, slot, barWidth, xAt };
}

export function RevenueHeatmap({
  cells,
  selected,
}: {
  cells: { date: string; label: string; cents: number; bucket: string; href: string }[];
  selected: string;
}) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="label">Revenue per day · pick a day</p>
        <div className="flex flex-wrap gap-3 text-[12px] text-muted-foreground">
          {["Quiet", "Soft", "Solid", "Strong"].map((name) => (
            <span key={name} className="inline-flex items-center gap-1.5">
              <span className={cn("inline-block size-2.5 rounded-[3px]", bucketClass(name))} />
              {name}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day} className="pb-1 text-center text-[11px] font-medium text-muted-foreground" aria-hidden="true">
            {day}
          </span>
        ))}
        {Array.from({ length: cells.length ? (weekdayIndex(cells[0].date) + 6) % 7 : 0 }, (_, index) => (
          <span key={`pad-${index}`} />
        ))}
        {cells.map((cell) => {
          const first = cell.date.endsWith("-01") || cell === cells[0];
          const on = cell.date === selected;
          return (
            <a
              key={cell.date}
              href={cell.href}
              aria-label={`${cell.label}, ${cell.bucket}, ${formatEUR(cell.cents)}`}
              aria-current={on ? "date" : undefined}
              className={cn(
                "num flex h-8 items-center justify-center rounded-[4px] text-[11px] transition-[box-shadow,transform] duration-150 hover:ring-2 hover:ring-foreground/25",
                bucketClass(cell.bucket),
                on && "ring-2 ring-primary ring-offset-1 ring-offset-card hover:ring-primary",
                first && "font-medium",
              )}
            >
              <span className="sr-only">{cell.bucket}</span>
              {first ? `${MONTH_SHORT[Number(cell.date.slice(5, 7)) - 1]} ${Number(cell.date.slice(8))}` : Number(cell.date.slice(8))}
            </a>
          );
        })}
      </div>
    </div>
  );
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortBridgeLabel(label: string): string {
  const known: Record<string, string> = {
    "Price spread": "Spread",
    "Intraday volatility": "Intraday",
    "Balancing capacity price": "Capacity",
    "Grid constraint": "Grid",
    "Cycle limit": "Cycles",
    "Fees and imbalance": "Fees",
    Availability: "Availability",
    "aFRR capacity": "aFRR cap.",
    "aFRR energy": "aFRR en.",
  };
  return known[label] ?? label;
}

function bucketClass(bucket: string): string {
  if (bucket === "Strong") return "bg-up text-white dark:bg-up/75 dark:text-[#06180d]";
  if (bucket === "Solid") return "bg-up/45 text-foreground";
  if (bucket === "Soft") return "bg-up/20 text-foreground";
  return "bg-muted text-muted-foreground";
}
