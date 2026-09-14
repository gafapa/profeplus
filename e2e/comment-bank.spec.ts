import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`comment bank has a dedicated configuration tab at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/config/preferences");
    await expect(page.getByRole("heading", { name: "Preferencias", exact: true })).toBeAttached();
    await expect(page.getByRole("heading", { name: "Banco de comentarios", exact: true })).toHaveCount(0);
    await page.evaluate(async () => {
      const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
      const now = new Date().toISOString();
      await db.feedbackComments.put({ id: "existing-comment", category: "general", text: "Comentario de prueba existente", createdAt: now, updatedAt: now });
    });
    const tab = page.getByRole("link", { name: "Banco de comentarios", exact: true });
    await tab.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/config\/comments$/);
    await expect(tab).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Banco de comentarios", level: 1 })).toBeVisible();
    await expect(page.getByText("Comentario de prueba existente", { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Comentario", exact: true }).fill("Comentario de prueba nuevo");
    await page.getByRole("button", { name: "Añadir comentario", exact: true }).click();
    const row = page.locator(".feedback-bank-list li").filter({ hasText: "Comentario de prueba nuevo" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Editar", exact: true }).click();
    await page.getByRole("textbox", { name: "Comentario", exact: true }).fill("Comentario de prueba editado");
    await page.getByRole("button", { name: "Actualizar comentario", exact: true }).click();
    await expect(page.getByText("Comentario actualizado.", { exact: true })).toBeVisible();
    await page.reload();
    const updatedRow = page.locator(".feedback-bank-list li").filter({ hasText: "Comentario de prueba editado" });
    await expect(updatedRow).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `.impeccable/review/comment-bank-${width}.png`, fullPage: true });
    await updatedRow.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(updatedRow).toHaveCount(0);
    await expect(page.getByText("Comentario de prueba existente", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
