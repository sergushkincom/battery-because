import { expect, test } from "@playwright/test";

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

test("skip link is the first tab stop", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});
