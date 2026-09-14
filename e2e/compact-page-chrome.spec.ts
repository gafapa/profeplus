import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`page introductions are hidden and setup lives in the footer at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const [route, title] of [["/agenda", "Agenda"], ["/classroom", "Plano y grupos"], ["/search", "Buscar en Edunoza"]]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toHaveText(title);
      await expect(page.locator("main h1")).toHaveClass(/sr-only/);
      await expect(page.locator(".agenda-eyebrow, .onboarding-coach")).toHaveCount(0);
      const footer = page.getByRole("contentinfo", { name: "Estado de la aplicación" });
      await expect(footer.getByRole("button", { name: /Configuración inicial:/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    await page.goto("/management/courses");
    const button = page.getByRole("contentinfo").getByRole("button", { name: /Configuración inicial:/ });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Guardar para después" }).click();
    await expect(button).toBeFocused();
    await page.goto("/agenda");
    await page.evaluate(async () => {
      const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
      await db.classGroups.put({ id: "setup-group", name: "Grupo simulado", level: "ESO", schoolYear: "2026-2027" });
    });
    await expect(page.getByRole("contentinfo").getByRole("button", { name: "Configuración inicial: 1 de 5 pasos completados", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `.impeccable/review/compact-page-chrome-${width}.png`, fullPage: true });
  });
}
