import Link from "next/link";
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
        <p className="text-[12px] text-muted-foreground">{asset.name}</p>
        <h1 className="text-[20px] font-semibold">Go-live</h1>
        <p className="text-muted-foreground">{blocked ? blocked.note : "Control has been handed over. The asset is in the trading book."}</p>
      </header>
      <nav className="flex gap-3 text-[13px]">
        <Link href={linkTo(q, `/assets/${asset.id}`)}>Day</Link>
        <Link className="font-medium text-primary" href={linkTo(q, `/assets/${asset.id}/journey`)}>Journey</Link>
      </nav>
      <ol className="grid gap-2">
        {steps.map((step, index) => (
          <li key={step.step} className="rounded-[6px] border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[14px] font-semibold">
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
