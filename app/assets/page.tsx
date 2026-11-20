import { AssetTable } from "@/components/asset-table";
import { loadView, linkTo, portfolioExplain } from "@/lib/page-model";
import { DEMO_TODAY, addDays } from "@/lib/time";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ds, q } = loadView(await searchParams);
  const view = portfolioExplain(ds, q);
  return (
    <div className="grid gap-4">
      <header>
        <h1 className="text-[20px] font-semibold">Assets</h1>
        <p className="text-muted-foreground">Same book, filtered to the portfolio in the header. Totals sit in the footer.</p>
      </header>
      <p className="text-[12px] text-muted-foreground">{view.window.to === DEMO_TODAY ? "Data delayed — last telemetry 14:05" : "Settled"}</p>
      <AssetTable
        locale={q.locale}
        rows={view.rows.map((row) => ({
          id: row.asset.id,
          name: row.asset.name,
          country: row.asset.country,
          mw: row.asset.powerKw / 1000,
          mwh: row.asset.energyKwh / 1000,
          revenueCents: row.metrics.totalCents,
          planCents: row.metrics.planCents,
          state: row.state,
          position: row.position,
          availability: row.metrics.availabilityPct,
          attention: row.state === "not_live" ? "Prequalification blocked" : row.state === "below_availability" ? "Availability" : "System",
          href: linkTo(q, `/assets/${row.asset.id}`, { date: addDays(DEMO_TODAY, -1) }),
        }))}
      />
    </div>
  );
}
