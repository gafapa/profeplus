import { expect, test } from "@playwright/test";
import { installMoodleFixture, seedMoodleLocalRecords } from "./moodle-fixture";
import { connectMoodleToken } from "./moodle-workflow-helpers";

async function prepareLinkedAccount(page: import("@playwright/test").Page) {
  await installMoodleFixture(page);
  await page.goto("/config/moodle");
  await seedMoodleLocalRecords(page);
  await page.evaluate(async () => {
    const { saveConnection, createMappingPreview, applyMappingPreview } = await import(/* @vite-ignore */ "/src/shared/moodle/service.ts");
    const { createMoodleClient } = await import(/* @vite-ignore */ "/src/shared/moodle/client.ts");
    const client = createMoodleClient("https://centros.edu.xunta.gal/iesmontevila/aulavirtual/", "syntheticToken123");
    const site = await client.getSiteInfo();
    const connection = await saveConnection(site);
    const [course] = await client.getCourses();
    const snapshot = await client.getCourseSnapshot(course);
    await applyMappingPreview(await createMappingPreview(connection.id, snapshot, { courseId: 4, classId: "moodle-local-class", subjectId: "moodle-local-subject" }, [
      { kind: "student", remoteId: 11, action: "link", localId: "moodle-local-student" },
      { kind: "activity", remoteId: 71, action: "link", localId: "moodle-local-task" }
    ]));
    client.dispose();
  });
  await page.reload();
  await connectMoodleToken(page, "syntheticToken123");
  await page.getByRole("navigation", { name: "Apartados de Moodle" }).getByRole("link", { name: "Conexión entre datos" }).click();
  await page.getByRole("combobox", { name: "Curso Moodle", exact: true }).selectOption("4");
  await page.getByRole("button", { name: "Cargar curso", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Grupo de Edunoza", exact: true })).toHaveValue("moodle-local-class");
}

test("quick update reviews fresh changes without repeating associations", async ({ page }) => {
  await prepareLinkedAccount(page);
  await page.evaluate(() => {
    const fixture = (window as unknown as { moodleFixture: { activityTitle: string; modifiedAt: number; grade: number } }).moodleFixture;
    fixture.activityTitle = "Updated Moodle title";
    fixture.modifiedAt = 200;
    fixture.grade = 80;
  });
  await page.getByRole("button", { name: "Buscar cambios", exact: true }).click();
  // Preparing a review never writes the user's records.
  expect(await page.evaluate(async () => {
    const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
    return [(await db.tasks.get("moodle-local-task"))?.title, (await db.taskDirectGrades.get("moodle-local-grade"))?.score];
  })).toEqual(["My existing task", 6]);
  const titleField = page.locator("fieldset").filter({ has: page.locator("legend").filter({ hasText: "Título" }) });
  await expect(titleField.getByRole("radio", { name: "Usar Moodle Updated Moodle title", exact: true })).toBeVisible();
  await titleField.getByRole("radio", { name: /Usar Moodle/ }).check();
  await page.getByRole("button", { name: "Aplicar decisiones y continuar", exact: true }).click();
  await expect.poll(async () => page.evaluate(async () => {
    const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
    return (await db.tasks.get("moodle-local-task"))?.title;
  })).toBe("Updated Moodle title");
  await page.getByRole("button", { name: "Revisar notas entrantes", exact: true }).click();
  await page.getByRole("radio", { name: "Importar Moodle", exact: true }).check();
  await page.getByRole("button", { name: "Importar selección", exact: true }).click();
  await expect.poll(async () => page.evaluate(async () => {
    const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
    return (await db.taskDirectGrades.get("moodle-local-grade"))?.score;
  })).toBe(8);
  expect(await page.evaluate(async () => {
    const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
    return [await db.students.count(), await db.tasks.count(), (await db.students.get("moodle-local-student"))?.comments];
  })).toEqual([1, 1, "PRIVATE student note"]);
});

test("failed refresh cannot leave an old update actionable", async ({ page }) => {
  await prepareLinkedAccount(page);
  await page.getByRole("button", { name: "Buscar cambios", exact: true }).click();
  const review = page.getByRole("button", { name: "Revisar cambios", exact: true });
  if (await review.isVisible()) await review.click();
  await page.evaluate(() => { (window as unknown as { moodleFixture: { failFunction: string } }).moodleFixture.failFunction = "core_course_get_contents"; });
  await page.getByRole("navigation", { name: "Pasos para revisar datos de Moodle" }).getByRole("button", { name: /Curso y destino/ }).click();
  await page.getByRole("button", { name: "Buscar cambios", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aplicar decisiones y continuar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Importar selección", exact: true })).toHaveCount(0);
});
