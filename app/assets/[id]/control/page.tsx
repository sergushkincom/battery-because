import Link from "next/link";
import { notFound } from "next/navigation";
import { ControlDesk } from "@/components/control-desk";
import { findAsset, linkTo, loadView } from "@/lib/page-model";
import { MAINTENANCE_START, FORECAST_END, offsetHours, slotIso } from "@/lib/time";

export default async function ControlPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { ds, q } = loadView(await searchParams);
  const asset = findAsset(ds, id);
  if (!asset) notFound();
  const start = slotIso(MAINTENANCE_START, 0, offsetHours(asset.country, MAINTENANCE_START));
  const end = slotIso(FORECAST_END, 0, offsetHours(asset.country, FORECAST_END));
  const slots = ds.forecastIntervals
    .filter((row) => row.assetId === asset.id && row.ts >= start && row.ts < end)
    .map((row) => ({ ts: row.ts, revenueCents: row.revenueCents }));
  const rules = ds.rules.filter((rule) => rule.assetId === asset.id);
  const approvals = ds.approvals.filter((item) => item.assetId === asset.id);

  return (
    <div className="grid gap-4">
      <header>
        <p className="text-[12px] text-muted-foreground">{asset.name}</p>
        <h1 className="text-[20px] font-semibold">Autonomy and control</h1>
      </header>
      <nav className="flex flex-wrap gap-3 text-[13px]">
        <Link href={linkTo(q, `/assets/${asset.id}`)}>Day</Link>
        <Link href={linkTo(q, `/assets/${asset.id}/why`)}>Why</Link>
        <Link className="font-medium text-primary" href={linkTo(q, `/assets/${asset.id}/control`)}>Control</Link>
        <Link href={linkTo(q, `/assets/${asset.id}/log`)}>Log</Link>
        <Link href={linkTo(q, `/assets/${asset.id}/journey`)}>Journey</Link>
      </nav>
      <p className="text-[12px] text-muted-foreground">Settled history, with forecast slots used only to price a maintenance window.</p>
      <ControlDesk asset={asset} rules={rules} approvals={approvals} slots={slots} role={q.role} locale={q.locale} timeZone={asset.timezone} />
    </div>
  );
}
