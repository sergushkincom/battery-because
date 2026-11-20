import { LogMerge } from "@/components/log-merge";
import { loadView } from "@/lib/page-model";

export default async function PortfolioLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ds, q } = loadView(await searchParams);
  return (
    <LogMerge
      seed={ds.audit}
      assets={ds.assets.map((asset) => ({ id: asset.id, name: asset.name, timezone: asset.timezone }))}
      locale={q.locale}
      title="Audit log"
      intro="Every bid, dispatch, override, approval and alert, with the reason and the state."
    />
  );
}
