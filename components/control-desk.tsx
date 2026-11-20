"use client";

import { useMemo, useState } from "react";
import { ApprovalActions } from "@/components/approval-actions";
import { useDemo } from "@/components/demo-store";
import { StateChip } from "@/components/state-chip";
import { Button } from "@/components/ui/button";
import { formatEUR, type Locale } from "@/lib/format";
import { MODE_LABEL } from "@/lib/labels";
import { suggestCheaperWindow, windowImpact, type RevenueSlot } from "@/lib/maintenance";
import { formatStamp } from "@/lib/time";
import type { ApprovalRequest, Asset, AutonomyRule, Role } from "@/lib/types";

const ACTOR: Record<Role, string> = {
  owner: "Jonas Adler",
  stadtwerk: "Lina Krüger",
  operator: "Mara Keller",
};

export function ControlDesk({
  asset,
  rules,
  approvals,
  slots,
  role,
  locale,
  timeZone,
}: {
  asset: Asset;
  rules: AutonomyRule[];
  approvals: ApprovalRequest[];
  slots: RevenueSlot[];
  role: Role;
  locale: Locale;
  timeZone: string;
}) {
  const demo = useDemo();
  const canEdit = role === "owner";
  const [start, setStart] = useState("2026-11-23T09:00");
  const [end, setEnd] = useState("2026-11-23T13:00");
  const [mw, setMw] = useState(asset.powerKw / 1000);
  const [reason, setReason] = useState("Inverter service");
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [pauseUntil, setPauseUntil] = useState("2026-11-19T18:00");
  const [pauseReason, setPauseReason] = useState("Check the fans before the evening peak");
  const [capMw, setCapMw] = useState(Math.round(asset.powerKw / 2000));
  const [reserve, setReserve] = useState(20);

  const impact = useMemo(() => {
    const startIso = new Date(start).toISOString();
    const endIso = new Date(end).toISOString();
    const cents = windowImpact(slots, startIso, endIso, mw * 1000, asset.powerKw);
    const suggestion = suggestCheaperWindow(slots, startIso, endIso, mw * 1000, asset.powerKw);
    return { cents, suggestion, startIso, endIso };
  }, [slots, start, end, mw, asset.powerKw]);

  return (
    <div className="grid gap-4">
      <article className="overflow-auto rounded-[6px] border border-border bg-card">
        <table className="table-grid">
          <caption className="px-4 py-3 text-left text-[16px] font-semibold">Autonomy</caption>
          <thead>
            <tr>
              <th scope="col">Action</th>
              <th scope="col">Who acts</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const mode = demo.overlay.rules[`${asset.id}::${rule.action}`] ?? rule.mode;
              return (
                <tr key={rule.action}>
                  <th scope="row" className="bg-transparent font-normal">
                    {rule.action}
                  </th>
                  <td>
                    {canEdit ? (
                      <select
                        aria-label={rule.action}
                        className="h-8 rounded-[4px] border border-border bg-surface px-2"
                        value={mode}
                        onChange={(event) =>
                          demo.setRule(asset.id, rule.action, event.target.value as AutonomyRule["mode"], ACTOR[role], role)
                        }
                      >
                        <option value="auto">Acts alone</option>
                        <option value="approval">Needs approval</option>
                        <option value="never">Never alone</option>
                      </select>
                    ) : (
                      <StateChip tone={mode === "approval" ? "needs" : mode === "never" ? "rejected" : "system"}>{MODE_LABEL[mode]}</StateChip>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!canEdit && <p className="px-4 py-2 text-[12px] text-muted-foreground">Only the asset owner can change who acts alone.</p>}
      </article>

      <section className="grid gap-3">
        <h2 className="text-[16px] font-semibold">Pending approvals</h2>
        {approvals.length === 0 && <p className="text-muted-foreground">Nothing is waiting.</p>}
        {approvals.map((item) => (
          <article key={item.id} className="rounded-[6px] border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold">{item.action}</h3>
              <StateChip tone={item.state === "pending" ? "needs" : "idle"}>
                {item.state === "pending" ? "Needs a decision" : "Expired — system used safe default"}
              </StateChip>
            </div>
            <p className="mt-1">{item.reason}</p>
            <p className="num mt-1 text-[12px]">
              Expected {formatEUR(item.expectedCents[0], locale, 0)} to {formatEUR(item.expectedCents[1], locale, 0)} · gate {formatStamp(item.deadline, timeZone)}
            </p>
            <ApprovalActions item={item} role={role} />
          </article>
        ))}
      </section>

      <section className="rounded-[6px] border border-border bg-card p-4">
        <h2 className="text-[16px] font-semibold">Plan maintenance</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">The impact is the forecast revenue those slots would have earned. Nothing is emailed.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <label>
            Start
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 block h-8 w-full rounded-[4px] border border-border bg-surface px-2" />
          </label>
          <label>
            End
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 block h-8 w-full rounded-[4px] border border-border bg-surface px-2" />
          </label>
          <label>
            MW affected
            <input type="number" min={1} max={asset.powerKw / 1000} value={mw} onChange={(e) => setMw(Number(e.target.value))} className="num mt-1 block h-8 w-full rounded-[4px] border border-border bg-surface px-2" />
          </label>
          <label>
            Reason
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block h-8 w-full rounded-[4px] border border-border bg-surface px-2" />
          </label>
        </div>
        <p className="mt-3">
          Forecast net in this window: <span className="num">{formatEUR(impact.cents, locale, 0)}</span>
          {impact.cents < 0 ? " Taking it offline avoids a charge, so the window is cheap." : " This is revenue the book would give up."}
        </p>
        {impact.suggestion && (
          <p className="mt-1 text-[13px]">
            Moving to {formatStamp(impact.suggestion.start, timeZone)}–{formatStamp(impact.suggestion.end, timeZone)} saves about {formatEUR(impact.suggestion.saveCents, locale, 0)}.
          </p>
        )}
        <Button
          className="mt-3"
          variant="primary"
          onClick={() => {
            demo.planMaintenance(
              {
                assetId: asset.id,
                start: impact.startIso,
                end: impact.endIso,
                lostKw: mw * 1000,
                reason: "planned_maintenance",
                knownAhead: true,
              },
              impact.cents,
              ACTOR[role],
              role,
            );
            setConfirmed(`Confirmed. ${reason}. Trading during this window stays Never alone.`);
          }}
        >
          Confirm window
        </Button>
        {confirmed && (
          <p className="mt-2" role="status">
            <StateChip tone="approved">Confirmed</StateChip> {confirmed}
          </p>
        )}
        {demo.overlay.outages.filter((item) => item.assetId === asset.id).map((item) => (
          <p key={item.start} className="mt-2 text-[12px] text-muted-foreground">
            Confirmed {formatStamp(item.start, timeZone)} to {formatStamp(item.end, timeZone)}, {item.lostKw / 1000} MW.
          </p>
        ))}
      </section>

      <section className="rounded-[6px] border border-border bg-card p-4">
        <h2 className="text-[16px] font-semibold">Override</h2>
        <p className="text-[12px] text-muted-foreground">Every override is time-boxed and written to the audit log.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              demo.addOverride(
                { assetId: asset.id, summary: `Paused trading until ${pauseUntil}`, reason: pauseReason, effectCents: -Math.abs(impact.cents) },
                ACTOR[role],
                role,
                { pauses: [{ id: `pause-${Date.now()}`, assetId: asset.id, until: new Date(pauseUntil).toISOString(), reason: pauseReason }] },
              );
            }}
          >
            <h3 className="font-medium">Pause trading</h3>
            <input type="datetime-local" value={pauseUntil} onChange={(e) => setPauseUntil(e.target.value)} className="h-8 rounded-[4px] border border-border bg-surface px-2" aria-label="Pause until" />
            <input value={pauseReason} onChange={(e) => setPauseReason(e.target.value)} className="h-8 rounded-[4px] border border-border bg-surface px-2" aria-label="Pause reason" />
            <Button type="submit">Pause until then</Button>
          </form>
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              demo.addOverride(
                { assetId: asset.id, summary: `Capped power at ${capMw} MW`, reason: "Time-boxed power cap.", effectCents: undefined },
                ACTOR[role],
                role,
                { caps: [{ id: `cap-${Date.now()}`, assetId: asset.id, until: new Date(pauseUntil).toISOString(), maxKw: capMw * 1000, reason: "Time-boxed power cap." }] },
              );
            }}
          >
            <h3 className="font-medium">Cap power</h3>
            <input type="number" min={1} value={capMw} onChange={(e) => setCapMw(Number(e.target.value))} className="num h-8 rounded-[4px] border border-border bg-surface px-2" aria-label="Cap MW" />
            <Button type="submit">Set cap</Button>
          </form>
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              demo.addOverride(
                { assetId: asset.id, summary: `SoC reserve ${reserve}%`, reason: "Keep a reserve until the time box ends.", effectCents: undefined },
                ACTOR[role],
                role,
                { reserves: [{ id: `soc-${Date.now()}`, assetId: asset.id, until: new Date(pauseUntil).toISOString(), socPct: reserve, reason: "Keep a reserve until the time box ends." }] },
              );
            }}
          >
            <h3 className="font-medium">SoC reserve</h3>
            <input type="number" min={5} max={80} value={reserve} onChange={(e) => setReserve(Number(e.target.value))} className="num h-8 rounded-[4px] border border-border bg-surface px-2" aria-label="Reserve percent" />
            <Button type="submit">Keep reserve</Button>
          </form>
        </div>
        <ul className="mt-3 text-[12px] text-muted-foreground">
          {demo.overlay.pauses.filter((item) => item.assetId === asset.id).map((item) => (
            <li key={item.id}>Paused until {formatStamp(item.until, timeZone)}. {item.reason}</li>
          ))}
          {demo.overlay.caps.filter((item) => item.assetId === asset.id).map((item) => (
            <li key={item.id}>Power cap {item.maxKw / 1000} MW until {formatStamp(item.until, timeZone)}.</li>
          ))}
        </ul>
      </section>

      <section className="rounded-[6px] border border-border bg-card p-4">
        <h2 className="text-[16px] font-semibold">Limits</h2>
        <dl className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Limit label="Grid connection" value={`${asset.gridLimitKw / 1000} MW`} />
          <Limit label="SoC" value={`${asset.socMinPct}–${asset.socMaxPct}%`} />
          <Limit label="Cycles / day" value={String(asset.maxCyclesPerDay)} />
          <Limit label="State of health" value={`${asset.stateOfHealthPct}%`} />
        </dl>
      </section>
    </div>
  );
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}
