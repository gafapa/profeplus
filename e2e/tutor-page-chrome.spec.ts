import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`tutor introduction is removed without hiding tools at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/management/tutor");
    await expect(page.locator("main h1")).toHaveText("Tutoría y apoyos");
    await expect(page.locator("main h1")).toHaveClass("sr-only");
    await expect(page.getByText("Espacio de coordinación", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Próximos pasos, familias, agrupamientos transversales y relevos seguros.", { exact: true })).toHaveCount(0);
    await expect(page.locator(".tutor-hero-metrics")).toBeVisible();
    await expect(page.locator(".tutor-tabs")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `.impeccable/review/tutor-page-chrome-${width}.png`, fullPage: true });
  });
}
