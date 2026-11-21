"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StateChip, toneForPlan, toneForPosition } from "@/components/state-chip";
import { formatEUR, formatNumber, type Locale } from "@/lib/format";
import { PLAN_LABEL, POSITION_LABEL } from "@/lib/labels";
import type { MarketPosition, PlanState } from "@/lib/types";

export interface AssetRow {
  id: string;
  name: string;
  country: string;
  mw: number;
  mwh: number;
  revenueCents: number;
  planCents: number;
  state: PlanState;
  position: MarketPosition;
  availability: number;
  attention: string;
  href: string;
}

export function AssetTable({ rows, locale }: { rows: AssetRow[]; locale: Locale }) {
  const [key, setKey] = useState<keyof AssetRow>("revenueCents");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [country, setCountry] = useState("all");
  const [state, setState] = useState("all");

  const visible = useMemo(() => {
    const next = rows.filter((row) => (country === "all" || row.country === country) && (state === "all" || row.state === state));
    next.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return dir === "asc" ? cmp : -cmp;
    });
    return next;
  }, [rows, key, dir, country, state]);

  function sort(next: keyof AssetRow) {
    if (key === next) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setKey(next);
      setDir("desc");
    }
  }

  const countries = [...new Set(rows.map((row) => row.country))];
  const power = visible.reduce((s, row) => s + row.mw, 0);
  const revenue = visible.reduce((s, row) => s + row.revenueCents, 0);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        <label className="text-[12px] text-muted-foreground">
          Country
          <select className="field field-sm ml-1.5" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="all">All</option>
            {countries.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-muted-foreground">
          State
          <select className="field field-sm ml-1.5" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="all">All</option>
            {Object.entries(PLAN_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table className="table-grid">
          <thead>
            <tr>
              <Th onClick={() => sort("name")}>Asset</Th>
              <Th onClick={() => sort("country")}>Country</Th>
              <Th onClick={() => sort("mw")}>MW / MWh</Th>
              <Th onClick={() => sort("revenueCents")}>Revenue</Th>
              <Th onClick={() => sort("state")}>Vs plan</Th>
              <Th onClick={() => sort("position")}>Market</Th>
              <Th onClick={() => sort("availability")}>Availability</Th>
              <th scope="col">Attention</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="text-muted-foreground">
                  No assets match these filters.
                </td>
              </tr>
            )}
            {visible.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link href={row.href} className="font-medium text-primary">
                    {row.name}
                  </Link>
                </td>
                <td>{row.country}</td>
                <td className="num">
                  {formatNumber(row.mw, locale, 0)} / {formatNumber(row.mwh, locale, 0)}
                </td>
                <td className="num">{row.state === "not_live" ? "—" : formatEUR(row.revenueCents, locale, 0)}</td>
                <td>
                  <StateChip tone={toneForPlan(row.state)}>{PLAN_LABEL[row.state]}</StateChip>
                </td>
                <td>
                  {row.state === "not_live" ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <StateChip tone={toneForPosition(row.position)}>{POSITION_LABEL[row.position]}</StateChip>
                  )}
                </td>
                <td className="num">{row.state === "not_live" ? "—" : `${Math.round(row.availability)}%`}</td>
                <td className="max-w-[220px] text-[12px] text-muted-foreground">{row.attention}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total</td>
              <td className="num">{formatNumber(power, locale, 0)} MW</td>
              <td className="num">{formatEUR(revenue, locale, 0)}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <th scope="col">
      <button className="font-semibold" onClick={onClick}>
        {children}
      </button>
    </th>
  );
}
