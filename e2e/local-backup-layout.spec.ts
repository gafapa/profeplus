import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`local backup screen focuses on create and restore at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/config/database");
    await expect(page.getByRole("button", { name: "Crear copia cifrada", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Seleccionar copia para restaurar", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Verificar datos actuales", exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "Borrar todo", exact: true })).toBeHidden();
    await expect(page.locator("main h1")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `.impeccable/review/local-backup-simple-${width}.png`, fullPage: true });
    const checks = page.locator("summary").filter({ hasText: /^Comprobaciones$/ });
    await checks.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Verificar datos actuales", exact: true }).click();
    await expect(page.getByText("Integridad verificada: no se han encontrado referencias rotas.", { exact: true })).toBeVisible();
    await page.locator("summary").filter({ hasText: /^Opciones avanzadas$/ }).click();
    await page.getByRole("button", { name: "Borrar todo", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Crear copia cifrada y borrar", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  });
}
