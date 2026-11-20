"use client";

import { useMemo, useState } from "react";
import { useDemo } from "@/components/demo-store";
import { DownloadCsv } from "@/components/download-csv";
import { StateChip, toneForAudit } from "@/components/state-chip";
import { formatEUR, type Locale } from "@/lib/format";
import { ACTOR_LABEL, AUDIT_STATE_LABEL } from "@/lib/labels";
import { formatStamp } from "@/lib/time";
import type { AuditEntry } from "@/lib/types";

export function LogMerge({
  seed,
  assets,
  locale,
  title,
  intro,
  assetId,
}: {
  seed: AuditEntry[];
  assets: { id: string; name: string; timezone: string }[];
  locale: Locale;
  title: string;
  intro: string;
  assetId?: string;
  query?: unknown;
}) {
  const demo = useDemo();
  const [actor, setActor] = useState("all");
  const [type, setType] = useState("all");
  const [limit, setLimit] = useState(40);
  const names = new Map(assets.map((asset) => [asset.id, asset]));
  const rows = useMemo(() => {
    const merged = [...demo.overlay.audit, ...seed].filter((row) => (assetId ? row.assetId === assetId : true));
    return merged
      .filter((row) => (actor === "all" || row.actor.type === actor) && (type === "all" || row.type === type))
      .sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }, [demo.overlay.audit, seed, assetId, actor, type]);
  const visible = rows.slice(0, limit);

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold">{title}</h1>
          <p className="text-muted-foreground">{intro}</p>
        </div>
        <DownloadCsv
          label="Export CSV"
          filename="because-audit.csv"
          rows={rows.map((row) => ({
            time: row.ts,
            asset: names.get(row.assetId)?.name ?? row.assetId,
            actor: row.actor.name,
            type: row.type,
            summary: row.summary,
            reason: row.reason,
            state: row.state,
            effect_eur: row.effectCents != null ? (row.effectCents / 100).toFixed(2) : "",
          }))}
        />
      </header>
      <div className="flex flex-wrap gap-2">
        <label className="text-[12px]">
          Actor
          <select className="ml-1 h-8 rounded-[4px] border border-border bg-surface px-2" value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="all">All</option>
            <option value="system">System</option>
            <option value="operator">Operator</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        <label className="text-[12px]">
          Type
          <select className="ml-1 h-8 rounded-[4px] border border-border bg-surface px-2" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All</option>
            {["bid", "dispatch", "override", "approval", "alert", "report", "rule_change"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      {visible.length === 0 && <p className="rounded-[6px] border border-border bg-card p-4 text-muted-foreground">No entries match these filters.</p>}
      <ol className="grid gap-2">
        {visible.map((row) => {
          const asset = names.get(row.assetId);
          return (
            <li key={row.id} className="rounded-[6px] border border-border bg-card px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{row.summary}</p>
                <StateChip tone={toneForAudit(row.state)}>{AUDIT_STATE_LABEL[row.state]}</StateChip>
              </div>
              <p className="mt-1">{row.reason}</p>
              <p className="num mt-1 text-[12px] text-muted-foreground">
                {formatStamp(row.ts, asset?.timezone ?? "Europe/Berlin")} · {asset?.name ?? "Portfolio"} · {ACTOR_LABEL[row.actor.type]} {row.actor.name}
                {row.effectCents != null ? ` · ${formatEUR(row.effectCents, locale, 0)}` : ""}
              </p>
            </li>
          );
        })}
      </ol>
      {limit < rows.length && (
        <button className="justify-self-start text-primary" onClick={() => setLimit((value) => value + 40)}>
          Show more
        </button>
      )}
    </div>
  );
}
