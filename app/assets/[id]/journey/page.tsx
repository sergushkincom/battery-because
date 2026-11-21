import Link from "next/link";
import { AssetTabs } from "@/components/asset-tabs";
import { notFound } from "next/navigation";
import { StateChip } from "@/components/state-chip";
import { STEP_LABEL, STEP_STATE_LABEL } from "@/lib/labels";
import { findAsset, linkTo, loadView } from "@/lib/page-model";

export default async function JourneyPage({
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
  const steps = ds.onboarding.filter((step) => step.assetId === asset.id);
  const blocked = steps.find((step) => step.state === "blocked" || step.state === "in_progress");

  return (
    <div className="grid gap-4">
      <header>
        <p className="eyebrow">{asset.name}</p>
        <h1 className="page-title">Go-live</h1>
        <p className="text-muted-foreground">{blocked ? blocked.note : "Control has been handed over. The asset is in the trading book."}</p>
      </header>
      <AssetTabs assetId={asset.id} active="journey" href={(path) => linkTo(q, path)} />
      <ol className="grid gap-2">
        {steps.map((step, index) => (
          <li key={step.step} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="item-title">
                {index + 1}. {STEP_LABEL[step.step]}
              </h2>
              <StateChip tone={step.state === "blocked" ? "needs" : step.state === "done" ? "approved" : step.state === "in_progress" ? "system" : "idle"}>
                {STEP_STATE_LABEL[step.state]}
              </StateChip>
            </div>
            <p className="mt-1">{step.note}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Owner: {step.owner}
              {step.date ? ` · ${step.date}` : ""}
              {step.state === "blocked" ? " · What's needed: confirmation of the test window from the DSO." : ""}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
