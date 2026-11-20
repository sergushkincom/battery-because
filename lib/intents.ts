export interface Intent {
  title: string;
  from: string;
  to: string;
  compare: "previous" | "forecast";
  focus: "default" | "afrr" | "outage" | "benchmark";
}

const INTENTS: { test: RegExp; intent: Intent }[] = [
  {
    test: /tuesday|tue\b|low/,
    intent: {
      title: "Why was Tuesday low?",
      from: "2026-11-17",
      to: "2026-11-17",
      compare: "forecast",
      focus: "outage",
    },
  },
  {
    test: /afrr|sunday|sun\b/,
    intent: {
      title: "Why didn't we trade aFRR on Sunday?",
      from: "2026-11-08",
      to: "2026-11-08",
      compare: "forecast",
      focus: "afrr",
    },
  },
  {
    test: /outage|fault|inverter/,
    intent: {
      title: "How much did the outage cost?",
      from: "2026-11-17",
      to: "2026-11-18",
      compare: "forecast",
      focus: "outage",
    },
  },
  {
    test: /benchmark|market|behind/,
    intent: {
      title: "Are we behind other batteries in this market?",
      from: "2026-11-13",
      to: "2026-11-19",
      compare: "previous",
      focus: "benchmark",
    },
  },
];

export const SUGGESTED: Intent[] = [
  INTENTS[0].intent,
  INTENTS[1].intent,
  INTENTS[2].intent,
  INTENTS[3].intent,
];

export function matchIntent(query: string): Intent | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return INTENTS.find((item) => item.test.test(q))?.intent ?? null;
}
