import { notFound } from "next/navigation";
import { LogMerge } from "@/components/log-merge";
import { findAsset, loadView } from "@/lib/page-model";

export default async function AssetLogPage({
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
  return (
    <LogMerge
      seed={ds.audit.filter((row) => row.assetId === asset.id)}
      assets={[{ id: asset.id, name: asset.name, timezone: asset.timezone }]}
      locale={q.locale}
      title={`${asset.name} audit log`}
      intro="What the system did, what a person changed, and why."
      assetId={asset.id}
    />
  );
}
