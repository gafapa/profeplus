import { expect, test, type Page } from "@playwright/test";
import { installMoodleFixture, seedMoodleLocalRecords } from "./moodle-fixture";
import { connectMoodleToken, openMoodleAccess } from "./moodle-workflow-helpers";

const TOKEN = "1234567890abcdef1234567890abcdef";

async function connectAndLoad(page: Page): Promise<void> {
  await connectMoodleToken(page, TOKEN);
  await page.getByRole("navigation", { name: "Apartados de Moodle" }).getByRole("link", { name: "Conexión entre datos", exact: true }).click();
  await page.getByRole("combobox", { name: "Curso Moodle", exact: true }).selectOption("4");
  await page.getByRole("button", { name: "Cargar curso", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Grupo de Edunoza", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Grupo de Edunoza", exact: true }).selectOption("moodle-local-class");
  await page.getByRole("combobox", { name: "Materia de Edunoza", exact: true }).selectOption("moodle-local-subject");
  await page.getByRole("button", { name: "Continuar a asociaciones", exact: true }).click();
}

for (const width of [390, 1440]) {
  test(`read-only Moodle links existing work and reconnects without loss at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await installMoodleFixture(page);
    await page.goto("/config/moodle");
    await seedMoodleLocalRecords(page);
    await page.reload();
    await connectAndLoad(page);
    await page.getByRole("combobox", { name: "Decisión para Moodle Pupil", exact: true }).selectOption("link");
    await page.getByRole("combobox", { name: "Registro local para Moodle Pupil", exact: true }).selectOption("moodle-local-student");
    await page.locator("summary").filter({ hasText: /^Actividades ·/ }).click();
    await page.getByRole("combobox", { name: "Decisión para Moodle assignment", exact: true }).selectOption("link");
    await page.getByRole("combobox", { name: "Registro local para Moodle assignment", exact: true }).selectOption("moodle-local-task");
    await page.getByRole("button", { name: "Preparar vista previa", exact: true }).click();
    await expect(page.getByRole("region", { name: "Vista previa de asociaciones", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^Aplicar 2 decisión/ }).click();
    await expect(page.getByText("Asociaciones aplicadas.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Continuar a calificaciones", exact: true }).click();
    await page.getByRole("button", { name: "Revisar notas entrantes", exact: true }).click();
    await expect(page.getByText(/Moodle: 70.*100.*7.*10/)).toBeVisible();
    await page.getByRole("radio", { name: "Importar Moodle", exact: true }).check();
    await page.getByRole("button", { name: "Importar selección", exact: true }).click();
    await expect.poll(async () => page.evaluate(async () => {
      const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
      return (await db.taskDirectGrades.get("moodle-local-grade"))?.score;
    })).toBe(7);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `.impeccable/review/moodle-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Desconectar", exact: true }).click();
    await page.getByRole("navigation", { name: "Apartados de Moodle" }).getByRole("link", { name: "Configuración", exact: true }).click();
    await openMoodleAccess(page);
    await expect(page.getByLabel("Token del servicio web", { exact: true })).toHaveValue(TOKEN);
    await connectAndLoad(page);
    await expect(page.getByRole("combobox", { name: "Registro local para Moodle Pupil", exact: true })).toHaveValue("moodle-local-student");
    const wire = await page.evaluate(async () => {
      const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
      const fixture = (window as unknown as { moodleFixture: { calls: { functionName: string; url: string; body: string }[] } }).moodleFixture;
      const persisted = JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, records: await Promise.all(db.tables.map((table) => table.toArray())) });
      return { calls: fixture.calls, persisted, student: await db.students.get("moodle-local-student"), task: await db.tasks.get("moodle-local-task"), studentCount: await db.students.count(), taskCount: await db.tasks.count() };
    });
    expect(wire.persisted).toContain(TOKEN);
    expect(wire.calls.length).toBeGreaterThan(5);
    for (const call of wire.calls) {
      expect(call.url).not.toContain(TOKEN);
      expect(call.functionName).toMatch(/^(?:core_[a-z_]+_get_[a-z_]+|mod_assign_get_[a-z_]+)$/);
      expect(call.body).not.toContain("PRIVATE");
      expect(call.body).not.toContain("moodle-local");
    }
    expect(wire.studentCount).toBe(1);
    expect(wire.taskCount).toBe(1);
    expect(wire.student).toMatchObject({ fullName: "Local Pupil", personId: "stable-person", comments: "PRIVATE student note" });
    expect(wire.task).toMatchObject({ title: "My existing task", description: "PRIVATE task instructions" });
    await page.getByRole("button", { name: "Desconectar", exact: true }).click();
    await page.getByRole("navigation", { name: "Apartados de Moodle" }).getByRole("link", { name: "Configuración", exact: true }).click();
    await page.getByRole("button", { name: "Olvidar", exact: true }).click();
    await page.getByRole("button", { name: "Sí, olvidar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Olvidar", exact: true })).toHaveCount(0);
    expect(await page.evaluate(async () => {
      const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
      return [(await db.students.count()), (await db.tasks.count()), (await db.taskDirectGrades.get("moodle-local-grade"))?.score];
    })).toEqual([1, 1, 7]);
    expect(errors).toEqual([]);
  });
}

test("disconnect during Moodle loading discards pending results and tokens", async ({ page }) => {
  await installMoodleFixture(page);
  await page.goto("/config/moodle");
  await seedMoodleLocalRecords(page);
  await page.reload();
  await connectAndLoad(page);
  await page.getByRole("button", { name: /Curso y destino/ }).click();
  await page.evaluate(() => { (window as unknown as { moodleFixture: { pending: boolean } }).moodleFixture.pending = true; });
  await page.getByRole("button", { name: "Actualizar curso", exact: true }).click();
  await page.getByRole("button", { name: "Desconectar", exact: true }).click();
  await page.getByRole("navigation", { name: "Apartados de Moodle" }).getByRole("link", { name: "Configuración", exact: true }).click();
  await openMoodleAccess(page);
  await expect(page.getByRole("button", { name: "Conectar", exact: true })).toBeVisible();
  await expect(page.getByLabel("Token del servicio web", { exact: true })).toHaveValue(TOKEN);
  await expect(page.getByRole("combobox", { name: "Curso Moodle", exact: true })).toHaveCount(0);
  expect(await page.evaluate(async () => {
    const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
    return await db.moodleBindings.count();
  })).toBe(0);
});
