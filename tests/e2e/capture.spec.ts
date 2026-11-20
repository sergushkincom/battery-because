import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const dir = "docs/screenshots";

test.use({
  viewport: { width: 1440, height: 900 },
  colorScheme: "light",
  video: { mode: "on", size: { width: 1440, height: 900 } },
});

test("capture screens", async ({ page }) => {
  mkdirSync(dir, { recursive: true });
  const shots: { path: string; file: string }[] = [
    { path: "/?period=7d", file: "portfolio.png" },
    { path: "/assets/lechfeld-1?date=2026-11-18", file: "asset-day.png" },
    { path: "/assets/lechfeld-1/why", file: "why.png" },
    { path: "/assets/lechfeld-1/control", file: "control.png" },
    { path: "/log", file: "audit.png" },
    { path: "/reports/2026-11", file: "reports.png" },
    { path: "/ops?role=operator", file: "ops.png" },
    { path: "/assets/tajo-sur/journey", file: "journey.png" },
  ];
  for (const shot of shots) {
    await page.goto(shot.path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/${shot.file}`, fullPage: true });
  }

});

test("timeline and why revenue changed", async ({ page }) => {
  await page.goto("/assets/lechfeld-1?date=2026-11-18");
  const chart = page.getByRole("img", { name: "Dispatch timeline for the selected day" });
  await chart.scrollIntoViewIfNeeded();
  await expect(chart).toBeVisible();
  await page.waitForTimeout(300);
  const box = await chart.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 120, box.y + box.height * 0.55);
    await page.waitForTimeout(400);
    await page.mouse.move(box.x + box.width * 0.42, box.y + box.height * 0.55, { steps: 20 });
    await page.waitForTimeout(500);
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.48, { steps: 20 });
    await page.waitForTimeout(400);
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.48);
  }
  await page.waitForTimeout(900);
  await page.goto("/assets/lechfeld-1/why");
  await expect(page.getByRole("heading", { name: "Why revenue changed" })).toBeVisible();
  await page.waitForTimeout(700);
  await page.getByRole("link", { name: "Why was Tuesday low?" }).click();
  await expect(page.getByText("Inverter fault")).toBeVisible();
  await page.waitForTimeout(900);
});
