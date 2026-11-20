import Link from "next/link";
import { ApprovalActions } from "@/components/approval-actions";
import { StateChip } from "@/components/state-chip";
import { formatEUR } from "@/lib/format";
import { loadView, linkTo } from "@/lib/page-model";
import { planState } from "@/lib/plan";
import { rollup } from "@/lib/explain";
import { sliceDays } from "@/lib/selectors";
import { addDays, DEMO_TODAY, formatStamp } from "@/lib/time";
import { DoneToday } from "@/components/done-today";

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ds, q } = loadView(await searchParams);
  const from = addDays(DEMO_TODAY, -1);
  const approvals = ds.approvals.filter((item) => item.state === "pending" || item.state === "expired");
  const under = ds.assets.filter((asset) => asset.id !== "tajo-sur").flatMap((asset) => {
    const days = sliceDays(ds.daily, asset.id, from, from);
    const metrics = rollup(days);
    const state = planState(metrics.totalCents, metrics.planCents, metrics.availabilityPct, true);
    if (state === "on_plan" || state === "above_plan") return [];
    return [{ asset, state, metrics }];
  });
  const gaps = ds.outages.filter((outage) => outage.reason === "telemetry_loss" || outage.reason === "inverter_fault");

  return (
    <div className="grid gap-4">
      <header>
        <h1 className="text-[20px] font-semibold">Attention</h1>
        <p className="text-muted-foreground">What needs a person now, then what the system already did.</p>
      </header>
      <p className="text-[12px] text-needs">Data delayed — last telemetry 14:05</p>
      <section className="grid gap-3">
        <h2 className="text-[16px] font-semibold">Approvals due</h2>
        {approvals.length === 0 && <p className="text-muted-foreground">No approvals are open.</p>}
        {approvals.map((item) => {
          const asset = ds.assets.find((candidate) => candidate.id === item.assetId)!;
          return (
            <article key={item.id} className="rounded-[6px] border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[14px] font-semibold">
                  {asset.name} · {item.action}
                </h3>
                <StateChip tone={item.state === "expired" ? "needs" : "needs"}>{item.state === "expired" ? "Expired — system used safe default" : "Needs a decision"}</StateChip>
              </div>
              <p className="mt-1">{item.reason}</p>
              <p className="num mt-1 text-[12px] text-muted-foreground">
                {formatEUR(item.expectedCents[0], q.locale, 0)} to {formatEUR(item.expectedCents[1], q.locale, 0)} · {formatStamp(item.deadline, asset.timezone)}
              </p>
              {item.state === "pending" && <ApprovalActions item={item} role={q.role} />}
            </article>
          );
        })}
      </section>
      <section className="grid gap-3">
        <h2 className="text-[16px] font-semibold">Alerts</h2>
        {gaps.map((gap) => {
          const asset = ds.assets.find((candidate) => candidate.id === gap.assetId)!;
          return (
            <article key={gap.start} className="rounded-[6px] border border-border bg-card p-4">
              <h3 className="text-[14px] font-semibold">{asset.name}</h3>
              <p>{gap.reason === "telemetry_loss" ? "Telemetry gap — intervals are missing, not zero." : "Inverter fault — the megawatts are offline."}</p>
              <Link className="text-primary" href={linkTo(q, `/assets/${asset.id}`, { date: gap.start.slice(0, 10) })}>
                Open the day
              </Link>
            </article>
          );
        })}
      </section>
      <section className="grid gap-3">
        <h2 className="text-[16px] font-semibold">Under plan yesterday</h2>
        {under.length === 0 && <p className="text-muted-foreground">Every live asset finished on plan or above.</p>}
        {under.map((row) => (
          <article key={row.asset.id} className="rounded-[6px] border border-border bg-card p-4">
            <h3 className="text-[14px] font-semibold">{row.asset.name}</h3>
            <p>
              {row.state === "below_availability" ? "Below plan – availability." : "Below plan – market."} {formatEUR(row.metrics.totalCents, q.locale, 0)} against a plan of {formatEUR(row.metrics.planCents, q.locale, 0)}.
            </p>
            <Link className="text-primary" href={linkTo(q, `/assets/${row.asset.id}/why`, { from, to: from, compare: "forecast" })}>
              Why
            </Link>
          </article>
        ))}
      </section>
      <DoneToday seed={ds.audit.filter((row) => row.ts.slice(0, 10) >= "2026-11-18" && row.actor.type === "system" && row.state === "executed").slice(0, 8)} />
    </div>
  );
}
