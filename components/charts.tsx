"use client";

import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatEUR, type Locale } from "@/lib/format";
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
      <button className="text-[12px] text-primary" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? "Hide data" : "Show data"}
      </button>
      {open && (
        <div className="mt-2 max-h-64 overflow-auto rounded-[6px] border border-border">
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
}: {
  points: TimelinePoint[];
  onSelect: (ts: string) => void;
}) {
  return (
    <div>
      <div className="h-[300px] w-full min-w-0" role="img" aria-label="Dispatch timeline for the selected day">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                  <div className="max-w-xs rounded-[4px] border border-border bg-card px-2 py-1.5 text-[12px] shadow-[var(--shadow-sheet)]">
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
                <div className="rounded-[4px] border border-border bg-card px-2 py-1 text-[12px]">
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
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={48} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-[4px] border border-border bg-card px-2 py-1 text-[12px]">
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

export function WaterfallChart({
  rows,
  locale,
}: {
  rows: { label: string; cents: number; total?: boolean }[];
  locale: Locale;
}) {
  const bars = rows.reduce<{ label: string; cents: number; total?: boolean; start: number; end: number; endCursor: number }[]>(
    (acc, row) => {
      const cursor = acc.at(-1)?.endCursor ?? 0;
      if (row.total) return [...acc, { ...row, start: 0, end: row.cents, endCursor: row.cents }];
      return [...acc, { ...row, start: cursor, end: cursor + row.cents, endCursor: cursor + row.cents }];
    },
    [],
  );
  const values = bars.flatMap((b) => [b.start, b.end]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const h = 200;
  const w = 640;
  const pad = 28;
  const y = (value: number) => pad + ((max - value) / span) * (h - pad * 2);
  const gap = w / bars.length;

  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h + 36}`} className="h-auto w-full" role="img" aria-label="Revenue bridge">
        <line x1="0" x2={w} y1={y(0)} y2={y(0)} stroke="var(--border)" />
        {bars.map((bar, index) => {
          const top = y(Math.max(bar.start, bar.end));
          const bottom = y(Math.min(bar.start, bar.end));
          const positive = bar.end >= bar.start;
          const fill = bar.total ? "var(--series-da)" : positive ? "var(--price-up)" : "var(--price-down)";
          return (
            <g key={bar.label}>
              <rect x={index * gap + gap * 0.2} y={top} width={gap * 0.6} height={Math.max(1, bottom - top)} fill={fill} rx="2" />
              <text x={index * gap + gap / 2} y={h + 16} textAnchor="middle" fill="var(--muted-foreground)" fontSize="10">
                {shortBridgeLabel(bar.label)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 grid gap-1">
        {bars.map((bar) => (
          <li key={bar.label} className="flex justify-between gap-3 text-[12px]">
            <span>{bar.label}</span>
            <span className={cn("num", !bar.total && bar.cents < 0 && "text-down", !bar.total && bar.cents > 0 && "text-up")}>
              {bar.total ? formatEUR(bar.cents, locale, 0) : `${bar.cents > 0 ? "+" : bar.cents < 0 ? "−" : ""}${formatEUR(Math.abs(bar.cents), locale, 0)}`}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function RevenueHeatmap({
  cells,
  selected,
}: {
  cells: { date: string; label: string; cents: number; bucket: string; href: string }[];
  selected: string;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {["Quiet", "Soft", "Solid", "Strong"].map((name) => (
          <span key={name} className="inline-flex items-center gap-1">
            <span className={cn("inline-block h-2.5 w-2.5 rounded-[2px]", bucketClass(name))} />
            {name}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: cells.length ? (weekdayIndex(cells[0].date) + 6) % 7 : 0 }, (_, index) => (
          <span key={`pad-${index}`} />
        ))}
        {cells.map((cell) => (
          <a
            key={cell.date}
            href={cell.href}
            aria-label={`${cell.label}, ${cell.bucket}, ${formatEUR(cell.cents)}`}
            aria-current={cell.date === selected ? "date" : undefined}
            className={cn(
              "flex h-8 items-center justify-center rounded-[2px] border text-[10px]",
              bucketClass(cell.bucket),
              cell.date === selected ? "border-primary" : "border-transparent",
            )}
          >
            <span className="sr-only">{cell.bucket}</span>
            {cell.date.slice(8)}
          </a>
        ))}
      </div>
    </div>
  );
}

function shortBridgeLabel(label: string): string {
  const known: Record<string, string> = {
    "Price spread": "Spread",
    "Intraday volatility": "Intraday",
    "Balancing capacity price": "Capacity",
    "Grid constraint": "Grid",
    "Cycle limit": "Cycles",
    "Fees and imbalance": "Fees",
    Availability: "Availability",
  };
  return known[label] ?? label;
}

function bucketClass(bucket: string): string {
  if (bucket === "Strong") return "bg-up/80 text-white";
  if (bucket === "Solid") return "bg-up/45 text-foreground";
  if (bucket === "Soft") return "bg-up/20 text-foreground";
  return "bg-muted text-muted-foreground";
}
