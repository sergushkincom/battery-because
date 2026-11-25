export type Locale = "en-GB" | "de-DE";

export function formatEUR(cents: number, locale: Locale = "en-GB", digits = 0): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}

export function formatSignedEUR(cents: number, locale: Locale = "en-GB", digits = 0): string {
  const abs = formatEUR(Math.abs(cents), locale, digits);
  if (cents > 0) return `+${abs}`;
  if (cents < 0) return `−${abs}`;
  return abs;
}

export function formatNumber(value: number, locale: Locale = "en-GB", digits = 0): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPct(value: number, digits = 0): string {
  const rounded = digits === 0 ? Math.round(value) : Number(value.toFixed(digits));
  const body = `${Math.abs(rounded)}%`;
  if (rounded > 0) return `+${body}`;
  if (rounded < 0) return `−${body}`;
  return body;
}

export function formatMw(kw: number, digits = 1): string {
  return `${formatNumber(kw / 1000, "en-GB", digits)} MW`;
}

export function formatMwh(mwh: number, digits = 0): string {
  return `${formatNumber(mwh, "en-GB", digits)} MWh`;
}

export function eurosRounded(cents: number): number {
  return Math.round(cents / 100);
}

export function parseLocale(value: string | undefined): Locale {
  return value === "de-DE" ? "de-DE" : "en-GB";
}

export type CountKind = "eur" | "signed-eur" | "mwh";

/** Same formatters as the static cards. `target` keeps a signed zero on the sign it will land on. */
export function formatCount(kind: CountKind, target: number, amount: number, locale: Locale = "en-GB"): string {
  if (kind === "mwh") return `${formatNumber(amount, locale, 0)} MWh`;
  if (kind === "eur") return formatEUR(amount, locale, 0);
  const sign = target > 0 ? "+" : target < 0 ? "−" : "";
  return `${sign}${formatEUR(Math.abs(amount), locale, 0)}`;
}
