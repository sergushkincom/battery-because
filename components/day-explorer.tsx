"use client";

import { useMemo, useState } from "react";
import { DispatchTimeline, type TimelinePoint } from "@/components/charts";
import { formatEUR, type Locale } from "@/lib/format";
import { formatClock } from "@/lib/time";
import type { Decision, DispatchInterval, MarketPrice, WeatherDriver } from "@/lib/types";
import { slotStory } from "@/lib/story";

export function DayExplorer({
  intervals,
  prices,
  weather,
  decisions,
  timeZone,
  locale,
  forecast,
}: {
  intervals: DispatchInterval[];
  prices: MarketPrice[];
  weather: WeatherDriver[];
  decisions: Decision[];
  timeZone: string;
  locale: Locale;
  forecast: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const priceByTs = useMemo(() => new Map(prices.map((price) => [price.ts, price])), [prices]);
  const points: TimelinePoint[] = intervals.map((interval) => {
    const price = priceByTs.get(interval.ts);
    const hour = weather.find((item) => interval.ts >= item.ts && Date.parse(interval.ts) - Date.parse(item.ts) < 3_600_000) ?? null;
    const story = slotStory(interval, timeZone, hour, locale);
    return {
      label: formatClock(interval.ts, timeZone),
      ts: interval.ts,
      da: price?.daEurMwh ?? interval.daEurMwh,
      id: price?.idVwapEurMwh ?? null,
      charge: interval.quality === "ok" && interval.powerKw < 0 ? interval.powerKw / 1000 : 0,
      discharge: interval.quality === "ok" && interval.powerKw > 0 ? interval.powerKw / 1000 : 0,
      soc: interval.quality === "delayed" ? null : Math.round(interval.socPct),
      story,
      powerKw: interval.powerKw,
    };
  });
  const decision = decisions.find((item) => selected && selected >= item.ts && selected <= item.endTs) ?? decisions.find((item) => item.ts === selected);

  return (
    <div className="grid gap-3">
      {forecast && <p className="text-[12px] text-needs">Forecast — this day has not settled. The chart is the morning expectation, not a result.</p>}
      <DispatchTimeline points={points} onSelect={setSelected} />
      <Lane intervals={intervals} weather={weather} timeZone={timeZone} />
      {decision && (
        <aside className="rounded-[6px] border border-border bg-card p-4" aria-live="polite">
          <p className="text-[11px] font-semibold tracking-[0.02em] text-muted-foreground">Trade decision</p>
          <h3 className="text-[14px] font-semibold">{decision.action === "hold" ? "Held" : decision.action === "charge" ? "Charged" : "Discharged"}</h3>
          <p className="mt-1">{decision.reason}</p>
          {decision.alternative && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Alternative considered: {decision.alternative.label}, expected {formatEUR(decision.alternative.expectedCents, locale, 0)}.
            </p>
          )}
          <p className="num mt-2 text-[12px]">Result {formatEUR(decision.revenueCents, locale, 0)}</p>
          <a className="mt-2 inline-block text-[12px] text-primary" href={`log?focus=${decision.id}`}>
            Open in the audit log
          </a>
        </aside>
      )}
    </div>
  );
}

function Lane({
  intervals,
  weather,
  timeZone,
}: {
  intervals: DispatchInterval[];
  weather: WeatherDriver[];
  timeZone: string;
}) {
  const maxWind = Math.max(1, ...weather.map((item) => Math.max(item.windActMw, item.windFcMw)));
  return (
    <div className="grid gap-2 text-[11px] text-muted-foreground">
      <LaneRow label="Reserved">
        {intervals.map((interval) => {
          const kw = interval.reservedKw.afrrPos + interval.reservedKw.afrrNeg + interval.reservedKw.fcr;
          const title = kw ? `Reserved ${Math.round(kw / 1000)} MW` : "No reserve";
          return <i key={interval.ts} title={title} className="h-3 flex-1" style={{ background: kw ? "var(--series-cap)" : "var(--muted)", opacity: kw ? 0.3 + Math.min(kw / 20000, 0.7) : 1 }} />;
        })}
      </LaneRow>
      <LaneRow label="Available">
        {intervals.map((interval) => (
          <i
            key={interval.ts}
            title={interval.outageReason ? interval.outageReason : `${Math.round(interval.availableKw / 1000)} MW`}
            className="h-3 flex-1"
            style={{
              background: interval.outageReason ? "repeating-linear-gradient(135deg, var(--idle), var(--idle) 2px, transparent 2px, transparent 4px)" : "var(--series-da)",
              opacity: interval.availableKw > 0 ? 0.45 : 0.9,
            }}
          />
        ))}
      </LaneRow>
      <LaneRow label="Wind">
        {weather.map((item) => (
          <i key={item.ts} title={`${formatClock(item.ts, timeZone)} wind ${Math.round(item.windActMw)} MW actual, ${Math.round(item.windFcMw)} forecast`} className="h-3 flex-1 bg-charge" style={{ opacity: 0.25 + (item.windActMw / maxWind) * 0.75 }} />
        ))}
      </LaneRow>
    </div>
  );
}

function LaneRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0">{label}</span>
      <div className="flex min-w-0 flex-1 gap-px">{children}</div>
    </div>
  );
}
