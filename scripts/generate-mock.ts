import { mkdirSync, writeFileSync } from "node:fs";
import { explain, rollup } from "../lib/explain";
import { getDataset } from "../lib/mock/generate";
import { formatEUR } from "../lib/format";

const ds = getDataset();
const live = ds.daily.filter((d) => d.trading && d.date <= ds.today);
const byAsset = new Map<string, typeof live>();
for (const row of live) {
  const list = byAsset.get(row.assetId) ?? [];
  list.push(row);
  byAsset.set(row.assetId, list);
}

console.log(`days ${ds.days[0]} → ${ds.days.at(-1)}  intervals ${ds.intervals.length}`);
for (const asset of ds.assets) {
  const rows = (byAsset.get(asset.id) ?? []).filter((d) => d.date < ds.today);
  const mean = rows.reduce((s, r) => s + r.totalCents, 0) / Math.max(1, rows.length);
  console.log(
    `${asset.name.padEnd(14)} mean/day ${formatEUR(mean)}  budget/mo ${formatEUR(asset.budgetCentsPerMonth)}  cycles ${
      rows.length ? (rows.reduce((s, r) => s + r.cycles, 0) / rows.length).toFixed(2) : "-"
    }`,
  );
}

function windowSum(from: string, to: string) {
  return rollup(ds.daily.filter((d) => d.trading && d.date >= from && d.date <= to));
}

const recent = windowSum("2026-11-13", "2026-11-19");
const prior = windowSum("2026-11-06", "2026-11-12");
console.log("recent", formatEUR(recent.totalCents), "spread", recent.capturedSpread.toFixed(1), "avail", recent.availabilityPct.toFixed(1));
console.log("prior ", formatEUR(prior.totalCents), "spread", prior.capturedSpread.toFixed(1), "avail", prior.availabilityPct.toFixed(1));

const lechfeld = ds.daily.filter((d) => d.assetId === "lechfeld-1");
const actual = lechfeld.filter((d) => d.date >= "2026-11-13" && d.date <= "2026-11-19");
const baseline = lechfeld.filter((d) => d.date >= "2026-11-06" && d.date <= "2026-11-12");
const exp = explain({
  assetId: "lechfeld-1",
  assetName: "Lechfeld 1",
  actual,
  baseline,
  baselineLabel: "the previous window",
  weather: ds.weatherDaily,
  country: "DE",
  outages: ds.outages,
  planCents: rollup(actual).planCents,
  benchmarkCents: rollup(actual).benchmarkCents,
});
console.log("\n" + exp.headline);
for (const s of exp.sentences) console.log(" -", s.text);
console.log(
  "bridge",
  exp.bridge.map((b) => `${b.label} ${formatEUR(b.cents)}`).join(" | "),
);
console.log("sum", exp.bridge.reduce((s, b) => s + b.cents, 0), "delta", exp.deltaCents);

const sun = ds.intervals.filter((i) => i.assetId === "lechfeld-1" && i.ts.startsWith("2026-11-08"));
const reserved = sun.reduce((s, i) => s + i.reservedKw.afrrPos + i.reservedKw.afrrNeg + i.reservedKw.fcr, 0);
console.log("Nov 8 reserved kW-slots", reserved);

const fault = ds.daily.find((d) => d.assetId === "lechfeld-1" && d.date === "2026-11-17");
console.log("Nov 17 Lechfeld availability", fault?.availabilityPct.toFixed(1), "revenue", fault && formatEUR(fault.totalCents));

let socBad = 0;
let powerBad = 0;
for (const asset of ds.assets) {
  for (const i of ds.intervals) {
    if (i.assetId !== asset.id) continue;
    if (i.socPct < asset.socMinPct - 0.05 || i.socPct > asset.socMaxPct + 0.05) socBad += 1;
    if (i.availableKw === 0 && i.powerKw !== 0) powerBad += 1;
  }
}
console.log("soc violations", socBad, "power during full outage", powerBad);

mkdirSync("lib/mock/data", { recursive: true });
const summary = {
  seed: 20261119,
  today: ds.today,
  assets: ds.assets.map((a) => ({ id: a.id, name: a.name, budgetCentsPerMonth: a.budgetCentsPerMonth })),
  daily: ds.daily.map((d) => ({
    assetId: d.assetId,
    date: d.date,
    totalCents: d.totalCents,
    forecastCents: d.forecastCents,
    budgetCents: d.budgetCents,
    benchmarkCents: d.benchmarkCents,
    state: d.state,
    availabilityPct: Math.round(d.availabilityPct * 10) / 10,
    cycles: Math.round(d.cycles * 100) / 100,
  })),
};
writeFileSync("lib/mock/data/summary.json", JSON.stringify(summary));
console.log("wrote lib/mock/data/summary.json");
