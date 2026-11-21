import { PriceChart } from "@/components/charts";
import { formatNumber } from "@/lib/format";
import { loadView, resolvedDate } from "@/lib/page-model";
import { COUNTRIES, addDays, formatClock, offsetHours, slotIso } from "@/lib/time";
import type { Country } from "@/lib/types";
import Link from "next/link";

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ds, q } = loadView(await searchParams);
  const country = (COUNTRIES.includes(q.asset as Country) ? q.asset : "DE") as Country;
  const date = resolvedDate(q);
  const start = slotIso(date, 0, offsetHours(country, date));
  const end = slotIso(addDays(date, 1), 0, offsetHours(country, addDays(date, 1)));
  const prices = ds.prices.filter((row) => row.country === country && row.ts >= start && row.ts < end);
  const caps = ds.capacity.filter((row) => row.country === country && row.blockStart >= start && row.blockStart < end);
  const chart = prices.filter((_, index) => index % 2 === 0).map((row) => ({
    label: formatClock(row.ts, "Europe/Berlin"),
    da: row.daEurMwh,
    id: row.idVwapEurMwh,
  }));

  return (
    <div className="grid gap-4">
      <header>
        <h1 className="page-title">Markets</h1>
        <p className="text-muted-foreground">Day-ahead and intraday for one country, on the 15-minute clock. Prices are synthetic.</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {COUNTRIES.map((code) => (
          <Link key={code} href={`?role=${q.role}&portfolio=${q.portfolio}&period=${q.period}&loc=${q.locale}&date=${date}&asset=${code}`} className={code === country ? "font-medium text-primary" : ""}>
            {code}
          </Link>
        ))}
      </div>
      <p className="text-[12px] text-muted-foreground">{date === "2026-11-19" ? "Data delayed — last telemetry 14:05" : "Settled prices for this demo day."}</p>
      <article className="card p-5">
        <h2 className="section-title mb-3">{country} prices · {date}</h2>
        <PriceChart rows={chart} />
      </article>
      <article className="table-wrap">
        <table className="table-grid">
          <caption className="px-4 py-3 text-left section-title">Capacity prices, €/MW/h</caption>
          <thead>
            <tr>
              <th scope="col">Block</th>
              <th scope="col">aFRR+</th>
              <th scope="col">aFRR−</th>
              <th scope="col">FCR</th>
            </tr>
          </thead>
          <tbody>
            {caps.map((row) => (
              <tr key={row.blockStart}>
                <td className="num">{formatClock(row.blockStart, "Europe/Berlin")}</td>
                <td className="num">{formatNumber(row.afrrPosEurMwH, q.locale, 1)}</td>
                <td className="num">{formatNumber(row.afrrNegEurMwH, q.locale, 1)}</td>
                <td className="num">{formatNumber(row.fcrEurMwH, q.locale, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  );
}
