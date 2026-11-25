import { expect, test, type Page } from "@playwright/test";
import { formatCount } from "../../lib/format";
import { rollup } from "../../lib/explain";
import { getDataset } from "../../lib/mock/generate";
import { portfolioExplain } from "../../lib/page-model";
import { readQuery } from "../../lib/query";

const routes: { path: string; heading: string }[] = [
  { path: "/", heading: "Kestrel Fund I" },
  { path: "/assets", heading: "Assets" },
  { path: "/markets", heading: "Markets" },
  { path: "/ops", heading: "Attention" },
  { path: "/log", heading: "Audit log" },
  { path: "/reports", heading: "Reports" },
  { path: "/reports/2026-11", heading: "November 2026" },
  { path: "/assets/lechfeld-1?date=2026-11-18", heading: "Lechfeld 1" },
  { path: "/assets/lechfeld-1/why", heading: "Why revenue changed" },
  { path: "/assets/lechfeld-1/control", heading: "Autonomy and control" },
  { path: "/assets/lechfeld-1/log", heading: "Lechfeld 1 audit log" },
  { path: "/assets/lechfeld-1/journey", heading: "Go-live" },
  { path: "/assets/tajo-sur/journey", heading: "Go-live" },
];

test("main screens render with a reason near the numbers", async ({ page }) => {
  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
  }
  await page.goto("/");
  await expect(page.getByText(/Revenue fell|Revenue rose|versus/)).toBeVisible();
  await page.goto("/assets/does-not-exist");
  await expect(page.getByRole("heading", { name: "That page is not in the book" })).toBeVisible();
});

test("audit log exports a csv", async ({ page }) => {
  await page.goto("/log");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toContain(".csv");
});

test("investor report exports a pdf", async ({ page }) => {
  await page.goto("/reports/2026-11");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toContain(".pdf");
});

function bookFigures() {
  const q = readQuery({});
  const view = portfolioExplain(getDataset(), q);
  const metrics = rollup(view.actual);
  return {
    revenue: formatCount("eur", metrics.totalCents, metrics.totalCents, q.locale),
    plan: formatCount("signed-eur", metrics.totalCents - metrics.planCents, metrics.totalCents - metrics.planCents, q.locale),
    benchmark: formatCount(
      "signed-eur",
      metrics.totalCents - metrics.benchmarkCents,
      metrics.totalCents - metrics.benchmarkCents,
      q.locale,
    ),
    energy: formatCount("mwh", metrics.dischargedMwh, metrics.dischargedMwh, q.locale),
    headline: view.explanation.headline,
  };
}

function figure(page: Page, id: string) {
  return page.locator(`[data-kpi="${id}"] [data-shown]`);
}

function digits(text: string): number {
  const n = Number(text.replace(/[^\d]/g, ""));
  return text.includes("−") ? -n : n;
}

test("reduced motion shows the finished portfolio figures", async ({ page }) => {
  const book = bookFigures();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const revenue = figure(page, "revenue");
  await expect(page.locator("[data-kpi='revenue'] .kpi-reason")).toHaveAttribute("data-state", "ready");
  await expect(revenue).toHaveText(book.revenue);
  await expect(figure(page, "plan")).toHaveText(book.plan);
  await expect(figure(page, "benchmark")).toHaveText(book.benchmark);
  await expect(figure(page, "energy")).toHaveText(book.energy);
  await expect(page.locator("[data-kpi='revenue'] .kpi-reason")).toHaveText(book.headline);
  await page.waitForTimeout(500);
  await expect(revenue).toHaveText(book.revenue);
  await expect(page.locator("[data-kpi='revenue'] .kpi-reason")).toHaveCSS("opacity", "1");
});

test("portfolio figures count up from zero, then the reason slides in", async ({ page }) => {
  const book = bookFigures();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const samples: Record<string, string[]> = { revenue: [], plan: [], benchmark: [], energy: [] };
    (window as unknown as { __kpi: typeof samples }).__kpi = samples;
    const started = performance.now();
    const tick = () => {
      let done = true;
      for (const id of Object.keys(samples)) {
        const card = document.querySelector(`[data-kpi="${id}"]`);
        const text = card?.querySelector("[data-shown]")?.textContent?.trim();
        if (text && samples[id][samples[id].length - 1] !== text) samples[id].push(text);
        if (card?.querySelector(".kpi-reason")?.getAttribute("data-state") !== "in") done = false;
      }
      if (!done && performance.now() - started < 4000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto("/");
  for (const id of ["revenue", "plan", "benchmark", "energy"] as const) {
    await expect(page.locator(`[data-kpi="${id}"] .kpi-reason`)).toHaveAttribute("data-state", "in");
    await expect(figure(page, id)).toHaveText(book[id]);
    await expect(page.locator(`[data-kpi="${id}"] .kpi-reason`)).toHaveCSS("opacity", "1");
  }
  await expect(page.locator("[data-kpi='revenue'] .kpi-reason")).toHaveText(book.headline);
  const samples = await page.evaluate(() => (window as unknown as { __kpi: Record<string, string[]> }).__kpi);
  for (const id of ["revenue", "plan", "benchmark", "energy"] as const) {
    const seen = samples[id];
    const landed = digits(book[id]);
    expect(seen.some((text) => digits(text) === 0)).toBe(true);
    expect(seen.some((text) => {
      const value = Math.abs(digits(text));
      return value > 0 && value < Math.abs(landed);
    })).toBe(true);
    expect(digits(seen[seen.length - 1])).toBe(landed);
  }
});

test("skip link is the first tab stop", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});
