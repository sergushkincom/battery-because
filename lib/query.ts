import { parseLocale, type Locale } from "./format";
import { defaultPortfolio, parsePeriod, type PeriodKey } from "./selectors";
import type { Role } from "./types";

export function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseRole(value: string | undefined): Role {
  if (value === "stadtwerk" || value === "operator" || value === "owner") return value;
  return "owner";
}

export interface ViewQuery {
  role: Role;
  portfolio: string;
  period: PeriodKey;
  locale: Locale;
  date?: string;
  from?: string;
  to?: string;
  compare?: "previous" | "forecast";
  focus?: string;
  q?: string;
  audience: "investor" | "board" | "internal";
  asset?: string;
}

export function readQuery(sp: Record<string, string | string[] | undefined>): ViewQuery {
  const role = parseRole(one(sp.role));
  const portfolio = one(sp.portfolio) || defaultPortfolio(role);
  const audienceRaw = one(sp.audience);
  return {
    role,
    portfolio,
    period: parsePeriod(one(sp.period)),
    locale: parseLocale(one(sp.loc)),
    date: one(sp.date),
    from: one(sp.from),
    to: one(sp.to),
    compare: one(sp.compare) === "forecast" ? "forecast" : one(sp.compare) === "previous" ? "previous" : undefined,
    focus: one(sp.focus),
    q: one(sp.q),
    audience: audienceRaw === "board" || audienceRaw === "internal" ? audienceRaw : "investor",
    asset: one(sp.asset),
  };
}

export function withParams(path: string, current: Record<string, string | undefined>, patch: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  const merged = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value == null) delete merged[key];
    else merged[key] = value;
  }
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}
