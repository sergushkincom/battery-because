"use client";

import { useDemo } from "@/components/demo-store";
import type { AuditEntry } from "@/lib/types";

export function DoneToday({ seed }: { seed: AuditEntry[] }) {
  const demo = useDemo();
  const rows = [...demo.overlay.audit.filter((row) => row.actor.type === "system" || row.type === "approval"), ...seed].slice(0, 8);
  return (
    <section>
      <h2 className="section-title">Done today</h2>
      <ul className="mt-2 grid gap-2">
        {rows.length === 0 && <li className="text-muted-foreground">The system has not closed anything in this window.</li>}
        {rows.map((row) => (
          <li key={row.id} className="card px-4 py-3">
            <span className="font-medium">System</span> · {row.summary}
            <span className="mt-1 block text-[12px] text-muted-foreground">{row.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
