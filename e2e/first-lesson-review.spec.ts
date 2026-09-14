import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.use({ viewport: { width: 1366, height: 768 } });

test("first lesson creates its task in place and completes onboarding", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
    await db.classGroups.put({ id: "first-class", name: "3 Primaria · Simulado", level: "3 Primaria", schoolYear: "2026-2027" });
    await db.students.put({ id: "first-student", classId: "first-class", firstName: "Alba", lastName: "Ejemplo", fullName: "Alba Ejemplo" });
    await db.subjects.put({ id: "first-subject", name: "Matemáticas", scheduleSlotIds: ["first-slot"] });
    await db.subjectCourseLinks.put({ id: "first-link", classId: "first-class", subjectId: "first-subject" });
    await db.subjectStudentLinks.put({ id: "first-member", studentId: "first-student", subjectId: "first-subject" });
    await db.scheduleDays.put({ id: "first-day", dayOfWeek: 2, dayName: "Martes", enabled: true, blocks: [{ id: "first-slot", startTime: "09:00", endTime: "09:50" }] });
    localStorage.setItem("profeplus.teacher-onboarding", JSON.stringify({ version: 1, status: "active", currentStepId: "subjects" }));
  });
  await page.goto("/management/subjects");
  await expect(page.getByRole("button", { name: "Configuración inicial: 4 de 5 pasos completados", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Configuración inicial: 4 de 5 pasos completados", exact: true })).toHaveAttribute("title", "Siguiente paso: Preparar tu primera clase");
  await page.goto("/planner?date=2026-09-08&classId=first-class&subjectId=first-subject");
  await page.getByRole("button", { name: "Programar tarea el 8 de septiembre de 2026, 09:00 - 09:50", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/09:00 - 09:50/)).toBeVisible();
  const submit = dialog.getByRole("button", { name: "Crear tarea y programar sesión", exact: true });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Título de la nueva tarea").fill("Sumamos con bloques · Simulado");
  await page.screenshot({ path: "artifacts/persona-review/novice/fix-first-lesson-form.png", fullPage: true });
  await dialog.getByText("Objetivos y otros detalles de la sesión (opcional)", { exact: true }).click();
  await dialog.getByLabel("Objetivos", { exact: true }).fill("Comprender las llevadas");
  await submit.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Primera sesión guardada. La tarea está disponible en Tareas y la clase en Hoy.")).toBeVisible();
  const records = await page.evaluate(async () => {
    const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
    return { tasks: await db.tasks.toArray(), links: await db.taskSubjectLinks.toArray(), sessions: await db.taskSessions.toArray() };
  });
  expect(records.tasks).toHaveLength(1);
  expect(records.links).toHaveLength(1);
  expect(records.sessions).toHaveLength(1);
  expect(records.sessions[0]).toMatchObject({ classId: "first-class", subjectId: "first-subject", date: "2026-09-08", scheduleSlotId: "first-slot", objectives: "Comprender las llevadas", taskId: records.tasks[0].id });
  await page.goto("/today?date=2026-09-08&classId=first-class&subjectId=first-subject&slotId=first-slot");
  await expect(page.getByText("Sumamos con bloques · Simulado", { exact: true }).first()).toBeVisible();
  await page.goto("/management/subjects");
  await expect(page.getByRole("heading", { name: "Detalle de asignatura" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Configuración inicial:/ })).toHaveCount(0);
  await page.goto("/management/tasks");
  await expect(page.getByRole("button", { name: "Usar nota directa", exact: true })).toBeVisible();
  await expect(page.getByLabel("Incluir en cuaderno", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/persona-review/novice/fix-task-labels.png", fullPage: true });
});

test("downloaded empty CSV template supports preview and confirmed import", async ({ page }) => {
  await page.goto("/config/student-import");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar plantilla CSV" }).click()
  ]);
  const template = await readFile((await download.path())!, "utf8");
  expect(template).toContain("NOMBRE;APELLIDO 1;CURSO;GRUPO");
  await page.locator('input[type="file"]').setInputFiles({ name: "fictional-class.csv", mimeType: "text/csv", buffer: Buffer.from(`${template}Lucía;Ejemplo;3 Primaria;A\r\n`) });
  await expect(page.getByText("Alumnado válido", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/persona-review/novice/fix-import-template.png", fullPage: true });
  await page.getByRole("button", { name: "Seleccionar todos", exact: true }).click();
  await page.getByRole("button", { name: "Importar 1 alumno", exact: true }).click();
  await expect(page.getByText(/Importación completada: 1 grupo creado, 1 alumno importado/)).toBeVisible();
});
