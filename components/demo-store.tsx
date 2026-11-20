"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuditEntry, AutonomyRule, Outage, Role } from "@/lib/types";

const KEY = "because-demo-v1";

export interface Pause {
  id: string;
  assetId: string;
  until: string;
  reason: string;
}

export interface PowerCapOverlay {
  id: string;
  assetId: string;
  until: string;
  maxKw: number;
  reason: string;
}

export interface SocReserve {
  id: string;
  assetId: string;
  until: string;
  socPct: number;
  reason: string;
}

export interface Overlay {
  approvals: Record<string, { state: "approved" | "rejected"; resolvedBy: string; note?: string }>;
  rules: Record<string, AutonomyRule["mode"]>;
  audit: AuditEntry[];
  outages: Outage[];
  notes: Record<string, string>;
  pauses: Pause[];
  caps: PowerCapOverlay[];
  reserves: SocReserve[];
  notifyBelowPct: number;
}

const EMPTY: Overlay = {
  approvals: {},
  rules: {},
  audit: [],
  outages: [],
  notes: {},
  pauses: [],
  caps: [],
  reserves: [],
  notifyBelowPct: 15,
};

interface DemoContextValue {
  overlay: Overlay;
  ready: boolean;
  reset: () => void;
  approve: (item: { id: string; assetId: string; action: string }, actor: string, role: Role) => void;
  reject: (item: { id: string; assetId: string; action: string }, actor: string, role: Role, note: string) => void;
  setRule: (assetId: string, action: string, mode: AutonomyRule["mode"], actor: string, role: Role) => void;
  planMaintenance: (outage: Outage, impactCents: number, actor: string, role: Role) => void;
  setNote: (key: string, text: string) => void;
  addOverride: (
    entry: { assetId: string; summary: string; reason: string; effectCents?: number },
    actor: string,
    role: Role,
    extra: Partial<Pick<Overlay, "pauses" | "caps" | "reserves">>,
  ) => void;
  setNotify: (pct: number, actor: string, role: Role) => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

function actorType(role: Role): AuditEntry["actor"]["type"] {
  return role === "operator" ? "operator" : "owner";
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        // Hydrate after paint so the server HTML matches the seed, then the visitor's demo edits appear.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOverlay({ ...EMPTY, ...JSON.parse(raw) });
      }
    } catch {
      /* keep the seed */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify(overlay));
  }, [overlay, ready]);

  const api = useMemo<DemoContextValue>(() => {
    const push = (entry: AuditEntry, patch: (current: Overlay) => Overlay) => {
      setOverlay((current) => {
        const next = patch(current);
        next.audit = [entry, ...next.audit];
        return next;
      });
    };
    return {
      overlay,
      ready,
      reset: () => {
        localStorage.removeItem(KEY);
        setOverlay(EMPTY);
      },
      approve: (item, actor, role) => {
        push(
          {
            id: `aud-user-${item.id}-${Date.now()}`,
            ts: new Date().toISOString(),
            assetId: item.assetId,
            actor: { type: actorType(role), name: actor },
            type: "approval",
            summary: `Approved: ${item.action}`,
            reason: "Approved once. The standing rule stays Needs approval.",
            state: "approved",
          },
          (current) => ({
            ...current,
            approvals: { ...current.approvals, [item.id]: { state: "approved", resolvedBy: actor } },
          }),
        );
      },
      reject: (item, actor, role, note) => {
        push(
          {
            id: `aud-user-${item.id}-${Date.now()}`,
            ts: new Date().toISOString(),
            assetId: item.assetId,
            actor: { type: actorType(role), name: actor },
            type: "approval",
            summary: `Rejected: ${item.action}`,
            reason: note || "Rejected. The system keeps the safe default.",
            state: "rejected",
          },
          (current) => ({
            ...current,
            approvals: { ...current.approvals, [item.id]: { state: "rejected", resolvedBy: actor, note } },
          }),
        );
      },
      setRule: (assetId, action, mode, actor, role) => {
        const label = mode === "auto" ? "Acts alone" : mode === "approval" ? "Needs approval" : "Never alone";
        push(
          {
            id: `aud-rule-${assetId}-${Date.now()}`,
            ts: new Date().toISOString(),
            assetId,
            actor: { type: actorType(role), name: actor },
            type: "rule_change",
            summary: `${action} → ${label}`,
            reason: "The owner changed who is allowed to act.",
            state: "executed",
          },
          (current) => ({ ...current, rules: { ...current.rules, [`${assetId}::${action}`]: mode } }),
        );
      },
      planMaintenance: (outage, impactCents, actor, role) => {
        push(
          {
            id: `aud-maint-${Date.now()}`,
            ts: new Date().toISOString(),
            assetId: outage.assetId,
            actor: { type: actorType(role), name: actor },
            type: "override",
            summary: "Maintenance window confirmed",
            reason: outage.reason === "planned_maintenance" ? "Confirmed. Trading during this window stays Never alone." : "Confirmed.",
            effectCents: -Math.abs(impactCents),
            state: "executed",
          },
          (current) => ({ ...current, outages: [...current.outages, outage] }),
        );
      },
      setNote: (key, text) => setOverlay((current) => ({ ...current, notes: { ...current.notes, [key]: text } })),
      addOverride: (entry, actor, role, extra) => {
        push(
          {
            id: `aud-over-${Date.now()}`,
            ts: new Date().toISOString(),
            assetId: entry.assetId,
            actor: { type: actorType(role), name: actor },
            type: "override",
            summary: entry.summary,
            reason: entry.reason,
            effectCents: entry.effectCents,
            state: "executed",
          },
          (current) => ({
            ...current,
            pauses: extra.pauses ? [...current.pauses, ...extra.pauses] : current.pauses,
            caps: extra.caps ? [...current.caps, ...extra.caps] : current.caps,
            reserves: extra.reserves ? [...current.reserves, ...extra.reserves] : current.reserves,
          }),
        );
      },
      setNotify: (pct, actor, role) => {
        push(
          {
            id: `aud-notify-${Date.now()}`,
            ts: new Date().toISOString(),
            assetId: "portfolio",
            actor: { type: actorType(role), name: actor },
            type: "rule_change",
            summary: `Flag days more than ${pct}% under plan`,
            reason: "Notification rule saved on this browser. Nothing is emailed.",
            state: "executed",
          },
          (current) => ({ ...current, notifyBelowPct: pct }),
        );
      },
    };
  }, [overlay, ready]);

  return <DemoContext.Provider value={api}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("Demo store missing");
  return ctx;
}
