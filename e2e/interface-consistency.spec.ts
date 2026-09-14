import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`consistent sidebars, forms and seating at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/management/students");
    await page.locator(".group-context-selector select").waitFor();
    await page.evaluate(async () => {
      const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
      await db.classGroups.put({ id: "layout-group", name: "Grupo simulado", level: "ESO", schoolYear: "2026-2027" });
      await db.students.bulkPut([
        { id: "layout-a", classId: "layout-group", firstName: "Ana", lastName: "Prueba", fullName: "Ana Prueba" },
        { id: "layout-b", classId: "layout-group", firstName: "Berta", lastName: "Prueba", fullName: "Berta Prueba" }
      ]);
    });
    await page.reload();
    await page.locator(".group-context-selector select").selectOption("layout-group");
    await page.goto("/classroom");
    const seats = page.locator(".classroom-seat");
    await expect(seats).toHaveCount(4);
    await seats.nth(0).locator(".classroom-seat-student").dragTo(seats.nth(1));
    await expect(seats.nth(1).locator("select")).toHaveValue("layout-a");
    await expect(seats.nth(0).locator("select")).toHaveValue("layout-b");
    await seats.nth(1).locator(".classroom-seat-student").dragTo(seats.nth(3));
    await expect(seats.nth(3).locator("select")).toHaveValue("layout-a");
    await expect(seats.nth(1).locator("select")).toHaveValue("");
    await page.reload();
    await expect(seats.nth(3).locator("select")).toHaveValue("layout-a");
    await seats.nth(2).locator("select").selectOption("layout-a");
    await expect(seats.nth(3).locator("select")).toHaveValue("");
    await page.goto("/today");
    await expect(page.locator(".today-slot-rail").getByLabel("Seleccionar fecha")).toBeVisible();
    await page.screenshot({ path: `.impeccable/review/jornada-consistent-${width}.png`, fullPage: true });
    await page.goto("/agenda");
    const rail = page.getByRole("complementary", { name: "Opciones de agenda" });
    await expect(rail.getByRole("combobox", { name: "Grupo", exact: true })).toHaveValue("layout-group");
    await expect(rail.getByRole("button", { name: "Descargar calendario" })).toBeVisible();
    const sidebar = await rail.boundingBox();
    const content = await page.locator(".agenda-main").boundingBox();
    if (width > 900) expect(sidebar!.x + sidebar!.width).toBeLessThan(content!.x);
    else expect(sidebar!.y + sidebar!.height).toBeLessThanOrEqual(content!.y);
    await page.screenshot({ path: `.impeccable/review/agenda-consistent-${width}.png`, fullPage: true });
    await page.goto("/planner");
    await expect(page.getByText("No hay asignaturas en este grupo.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nueva asignatura", exact: true })).toHaveCount(0);
    for (const route of ["/config/preferences", "/config/database/nextcloud"]) {
      await page.goto(route);
      await page.locator('input[type="password"]').first().waitFor();
      expect(await page.locator('input[type="password"]').evaluateAll((inputs) => inputs.every((input) => Boolean((input as HTMLInputElement).form)))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    await page.goto("/config/database");
    await page.getByRole("button", { name: "Crear copia cifrada", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator('input[type="password"]')).toHaveCount(2);
    expect(await dialog.locator('input[type="password"]').evaluateAll((inputs) => inputs.every((input) => Boolean((input as HTMLInputElement).form)))).toBe(true);
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });
}
