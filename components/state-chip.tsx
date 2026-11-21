import { cn } from "@/lib/utils";

// Each tone: a tinted fill, a matching dot and AA text. The dot carries the colour, the word carries the meaning.
const TONE = {
  plan: "bg-muted text-foreground before:bg-idle",
  above: "bg-[color:var(--price-up)]/10 text-up before:bg-up",
  below: "bg-[color:var(--price-down)]/10 text-down before:bg-down",
  market: "bg-muted text-foreground before:bg-idle",
  system: "bg-[color:var(--system)]/10 text-system before:bg-system",
  needs: "bg-accent-soft text-needs before:bg-accent",
  approved: "bg-muted text-approved before:bg-approved",
  rejected: "bg-[color:var(--rejected)]/10 text-rejected before:bg-rejected",
  idle: "bg-muted text-idle before:bg-idle",
  charge: "bg-[color:var(--charge)]/10 text-charge before:bg-charge",
  discharge: "bg-[color:var(--discharge)]/12 text-discharge before:bg-discharge",
} as const;

export function StateChip({
  children,
  tone = "plan",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full pl-2 pr-2.5 text-[12px] font-medium leading-none before:size-1.5 before:shrink-0 before:rounded-full before:content-['']",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function toneForPlan(state: string): keyof typeof TONE {
  if (state === "above_plan") return "above";
  if (state === "below_market" || state === "below_availability") return "below";
  if (state === "not_live") return "idle";
  return "plan";
}

export function toneForPosition(position: string): keyof typeof TONE {
  if (position === "above") return "above";
  if (position === "below") return "below";
  return "market";
}

export function toneForAudit(state: string): keyof typeof TONE {
  if (state === "failed" || state === "rejected") return "rejected";
  if (state === "expired") return "needs";
  if (state === "approved" || state === "executed") return "approved";
  return "idle";
}
