import Link from "next/link";
import { REPORTS } from "@/lib/reports";
import { linkTo, loadView } from "@/lib/page-model";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { q } = loadView(await searchParams);
  return (
    <div className="grid gap-4">
      <header>
        <h1 className="page-title">Reports</h1>
        <p className="text-muted-foreground">A month or a quarter, for an investor, a board, or the internal book. PDF and CSV stay on this machine.</p>
      </header>
      <ul className="grid gap-2">
        {REPORTS.map((period) => (
          <li key={period.id}>
            <Link className="block card px-4 py-3.5 hover:bg-muted" href={linkTo(q, `/reports/${period.id}`)}>
              <span className="font-medium">{period.label}</span>
              <span className="ml-2 text-[12px] text-muted-foreground">
                {period.from} to {period.to}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
