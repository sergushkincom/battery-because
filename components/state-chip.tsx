import { cn } from "@/lib/utils";

const TONE = {
  plan: "bg-muted text-foreground",
  above: "bg-[color:var(--price-up)]/12 text-up",
  below: "bg-[color:var(--price-down)]/10 text-down",
  market: "bg-muted text-foreground",
  system: "bg-[color:var(--system)]/10 text-system",
  needs: "bg-[color:var(--needs-human)]/12 text-needs",
  approved: "bg-muted text-approved",
  rejected: "bg-[color:var(--rejected)]/10 text-rejected",
  idle: "bg-muted text-idle",
  charge: "bg-[color:var(--charge)]/12 text-charge",
  discharge: "bg-[color:var(--discharge)]/14 text-discharge",
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
        "inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.02em]",
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
