"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { formatCount, type CountKind, type Locale } from "@/lib/format";

const COUNT_MS = 880;

type Phase = "ssr" | "ready" | "wait" | "run" | "in";
type Tone = "up" | "down" | "flat" | "attention";

type Props = {
  id: string;
  label: string;
  meta: string;
  reason: string;
  tone?: Tone;
  locale: Locale;
} & ({ kind: CountKind; target: number } | { kind: "static"; text: string });

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function KpiCard(props: Props) {
  const { id, label, meta, reason, tone = "flat", locale } = props;
  const counting = props.kind !== "static";
  const target = props.kind === "static" ? 0 : props.target;
  const kind = props.kind;
  const [amount, setAmount] = useState(target);
  const [phase, setPhase] = useState<Phase>("ssr");
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!counting || kind === "static") return;
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let cancelled = false;
    let seen: IntersectionObserver | null = null;

    const finish = (next: "ready" | "in") => {
      if (cancelled) return;
      setAmount(target);
      setPhase(next);
    };

    const run = () => {
      if (cancelled) return;
      const started = performance.now();
      setPhase("run");
      const step = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - started) / COUNT_MS);
        if (t >= 1) {
          finish("in");
          return;
        }
        setAmount(target * easeOut(t));
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    const arm = () => {
      if (cancelled) return;
      if (reduced.matches || target === 0) {
        finish("ready");
        return;
      }
      setAmount(0);
      setPhase("wait");
      seen = new IntersectionObserver(
        (entries) => {
          if (cancelled || !entries.some((entry) => entry.isIntersecting)) return;
          seen?.disconnect();
          run();
        },
        { threshold: 0.2 },
      );
      seen.observe(el);
    };

    const onReduce = () => {
      if (!reduced.matches || cancelled) return;
      cancelAnimationFrame(raf);
      seen?.disconnect();
      setAmount(target);
      setPhase("ready");
      cancelled = true;
    };

    reduced.addEventListener("change", onReduce);
    arm();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      seen?.disconnect();
      reduced.removeEventListener("change", onReduce);
    };
  }, [counting, kind, target, locale]);

  const finalText = props.kind === "static" ? props.text : formatCount(props.kind, props.target, props.target, locale);
  const shown =
    props.kind === "static" || phase === "ssr" || phase === "ready" || phase === "in"
      ? finalText
      : formatCount(props.kind, props.target, amount, locale);
  const metaClass =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "attention" ? "text-needs" : "text-muted-foreground";
  const ticking = phase === "wait" || phase === "run";

  return (
    <article ref={ref} className="card flex flex-col px-4 py-4" data-kpi={id}>
      <h2 className="label">{label}</h2>
      <p className="num mt-2 whitespace-nowrap text-[26px] font-medium leading-[30px] tracking-[-0.02em]">
        <span className="inline-grid">
          <span className="invisible col-start-1 row-start-1" aria-hidden="true">
            {finalText}
          </span>
          <span
            className="col-start-1 row-start-1"
            data-shown
            data-zero={props.kind === "static" ? undefined : formatCount(props.kind, props.target, 0, locale)}
            aria-hidden={ticking || undefined}
            suppressHydrationWarning
          >
            {shown}
          </span>
        </span>
        {ticking ? <span className="sr-only">{finalText}</span> : null}
      </p>
      <p className={`num mt-1 text-[12px] font-medium ${metaClass}`}>{meta}</p>
      <p
        className="kpi-reason mt-3 line-clamp-3 border-t border-border pt-3 text-[12px] leading-[18px] text-muted-foreground"
        data-state={phase}
        suppressHydrationWarning
      >
        {reason}
      </p>
    </article>
  );
}
