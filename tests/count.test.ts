import { describe, expect, it } from "vitest";
import { formatCount, formatEUR, formatNumber, formatSignedEUR } from "../lib/format";

describe("formatCount", () => {
  it("lands on the same strings the cards already use", () => {
    for (const locale of ["en-GB", "de-DE"] as const) {
      for (const cents of [0, 10381503, -12034932, 50]) {
        expect(formatCount("eur", cents, cents, locale)).toBe(formatEUR(cents, locale, 0));
        expect(formatCount("signed-eur", cents, cents, locale)).toBe(formatSignedEUR(cents, locale, 0));
      }
      expect(formatCount("mwh", 906.793, 906.793, locale)).toBe(`${formatNumber(906.793, locale, 0)} MWh`);
    }
  });

  it("keeps the landing sign while the amount is still zero", () => {
    expect(formatCount("signed-eur", -12034932, 0, "en-GB")).toBe(`−${formatEUR(0, "en-GB", 0)}`);
    expect(formatCount("signed-eur", 7269499, 0, "de-DE")).toBe(`+${formatEUR(0, "de-DE", 0)}`);
    expect(formatCount("eur", 10381503, 0, "en-GB")).toBe(formatEUR(0, "en-GB", 0));
    expect(formatCount("mwh", 906.793, 0, "en-GB")).toBe(`${formatNumber(0, "en-GB", 0)} MWh`);
  });
});