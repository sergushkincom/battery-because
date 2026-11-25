"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { useDemo } from "@/components/demo-store";
import type { ReportDay } from "@/lib/reports";
import { formatEUR, formatSignedEUR, type Locale } from "@/lib/format";
import { formatDayShort } from "@/lib/time";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/** The report audience as plain words. The amber underline slides to the chosen one; reduced motion makes it jump. */
export function AudienceSwitch({ options, current }: { options: { id: string; label: string; href: string }[]; current: string }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: EASE }}>
      <nav aria-label="Audience" className="audience-tabs">
        {options.map((option) => {
          const active = option.id === current;
          return (
            <Link key={option.id} href={option.href} scroll={false} aria-current={active ? "true" : undefined}>
              {option.label}
              {active && <motion.span layoutId="audience-line" className="audience-tabs-line" aria-hidden="true" />}
            </Link>
          );
        })}
      </nav>
    </MotionConfig>
  );
}

/** Revenue per day with the plan as a step line. Hover, or focus and use the arrow keys, to read one day. */
export function DailyChart({ days, locale }: { days: ReportDay[]; locale: Locale }) {
  const [index, setIndex] = useState<number | null>(null);
  const max = Math.max(1, ...days.flatMap((day) => [day.cents, day.planCents]));
  const n = days.length;
  const slot = 100 / n;
  const planPath = days.map((day, i) => `${i === 0 ? "M" : "L"}${i * slot},${100 - (day.planCents / max) * 100} L${(i + 1) * slot},${100 - (day.planCents / max) * 100}`).join(" ");
  const shown = index === null ? null : days[index];
  const total = days.reduce((sum, day) => sum + day.cents, 0);
  const plan = days.reduce((sum, day) => sum + day.planCents, 0);

  return (
    <figure className="grid gap-3">
      <div className="flex min-h-[20px] flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[12px]" aria-live="polite">
        {shown ? (
          <>
            <span className="font-medium">{formatDayShort(shown.date)}</span>
            <span className="flex gap-3">
              <span className="num">{formatEUR(shown.cents, locale, 0)}</span>
              <span className="text-muted-foreground">
                plan <span className="num">{formatEUR(shown.planCents, locale, 0)}</span>
              </span>
              <span className={cn("num", shown.cents - shown.planCents >= 0 ? "text-up" : "text-down")}>{formatSignedEUR(shown.cents - shown.planCents, locale, 0)}</span>
              {shown.outage && <span className="text-accent">Outage</span>}
            </span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">
              {n} days · <span className="num text-foreground">{formatEUR(total, locale, 0)}</span> against a plan of <span className="num text-foreground">{formatEUR(plan, locale, 0)}</span>
            </span>
            <span className="flex gap-3 text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <i className="legend-swatch bg-[var(--series-da)]" /> Revenue
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="legend-line" /> Plan
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="legend-swatch bg-accent" /> Outage day
              </span>
            </span>
          </>
        )}
      </div>
      <div
        className="daily-chart relative mt-2 h-40 outline-none"
        role="img"
        tabIndex={0}
        aria-label={`Revenue per day against plan, ${n} days. Use the arrow keys to read one day.`}
        onPointerLeave={() => setIndex(null)}
        onBlur={() => setIndex(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") setIndex((i) => Math.min(n - 1, (i ?? -1) + 1));
          else if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, (i ?? n) - 1));
          else if (event.key === "Escape") setIndex(null);
          else return;
          event.preventDefault();
        }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          {[0, 25, 50, 75].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="var(--border)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1="0" x2="100" y1="100" y2="100" stroke="var(--border-strong)" vectorEffect="non-scaling-stroke" />
          {days.map((day, i) => {
            const h = (Math.max(0, day.cents) / max) * 100;
            return (
              <rect
                key={day.date}
                x={i * slot + slot * 0.18}
                y={100 - h}
                width={slot * 0.64}
                height={h}
                fill={day.outage ? "var(--accent)" : "var(--series-da)"}
                opacity={index === null || index === i ? (day.outage ? 1 : 0.82) : 0.3}
                className="transition-opacity duration-150"
              />
            );
          })}
          <path d={planPath} fill="none" stroke="var(--foreground)" strokeWidth="1.25" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" opacity="0.55" />
        </svg>
        <div className="absolute inset-0 flex">
          {days.map((day, i) => (
            <span key={day.date} className="h-full flex-1" onPointerEnter={() => setIndex(i)} />
          ))}
        </div>
        <span className="num pointer-events-none absolute right-0 top-0 -translate-y-1/2 bg-card pl-1.5 text-[11px] leading-none text-muted-foreground">{formatEUR(max, locale, 0)}</span>
      </div>
      <div className="num flex justify-between text-[11px] text-muted-foreground" aria-hidden="true">
        <span>{formatDayShort(days[0].date)}</span>
        {n > 6 && <span>{formatDayShort(days[Math.floor(n / 2)].date)}</span>}
        <span>{formatDayShort(days[n - 1].date)}</span>
      </div>
    </figure>
  );
}

/** The manager's note lives in this browser and goes into the PDF. */
export function ManagerNote({ periodId }: { periodId: string }) {
  const demo = useDemo();
  const [note, setNote] = useState(demo.overlay.notes[periodId] ?? "");
  const saved = (demo.overlay.notes[periodId] ?? "") === note;
  return (
    <label className="grid gap-2">
      <span className="flex items-baseline justify-between gap-3">
        <span className="item-title">Manager&apos;s note</span>
        <span className="text-[12px] text-muted-foreground">{note ? (saved ? "Saved in this browser" : "Editing") : "Goes into the PDF"}</span>
      </span>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        onBlur={() => demo.setNote(periodId, note)}
        rows={4}
        className="field h-auto min-h-24 resize-y py-2"
        placeholder="What should the reader take away? A decision, a risk, or what happens next."
      />
    </label>
  );
}
