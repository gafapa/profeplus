import { expect, test, type Download, type Page } from "@playwright/test";

test.use({ timezoneId: "Europe/Madrid" });

async function readDownload(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function downloadReport(page: Page, name: string) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name, exact: true }).click()
  ]);
  return { filename: download.suggestedFilename(), content: await readDownload(download) };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/management/students");
  await page.locator(".group-context-selector select").waitFor();
  await page.evaluate(async () => {
    const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
    await db.open();
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    await db.classGroups.put({ id: "review", name: "3 ESO A", level: "ESO", schoolYear: "2026-2027" });
    await db.subjects.put({ id: "math", name: "Matemáticas", scheduleSlotIds: ["slot"] });
    await db.subjectCourseLinks.put({ id: "link", classId: "review", subjectId: "math" });
    for (const [id, firstName] of [["graded", "Ana"], ["pending", "Bruno"], ["notSubmitted", "Clara"], ["exempt", "Diego"]]) {
      await db.students.put({ id, classId: "review", firstName, lastName: "Simulado", fullName: `${firstName} Simulado` });
      await db.subjectStudentLinks.put({ id: `link-${id}`, subjectId: "math", studentId: id });
    }
    await db.assessments.put({ id: "assessment", classId: "review", subjectId: "math", title: "Prueba", period: "Primera evaluación", assessmentDate: date, weight: 100 });
    await db.gradeEntries.bulkPut([
      { id: "entry-graded", classId: "review", studentId: "graded", assessmentId: "assessment", status: "graded", numericValue: 8 },
      { id: "entry-notSubmitted", classId: "review", studentId: "notSubmitted", assessmentId: "assessment", status: "notSubmitted" },
      { id: "entry-exempt", classId: "review", studentId: "exempt", assessmentId: "assessment", status: "exempt" }
    ]);
    await db.scheduleDays.put({ id: "day", dayOfWeek: now.getDay(), dayName: "Día de prueba", enabled: true, blocks: [{ id: "slot", startTime: "09:00", endTime: "09:50" }] });
    await db.tasks.put({ id: "task", title: "Clase simulada", description: "", sessionCount: 1, sendToGradebook: false });
    await db.taskSessions.put({ id: "session", taskId: "task", subjectId: "math", classId: "review", date, scheduleSlotId: "slot", status: "planned" });
    await db.studentFollowUps.put({ id: "follow", studentId: "graded", classId: "review", date, dueDate: date, kind: "tutorial", title: "Revisar acuerdo", notes: "Simulado", resolved: false });
  });
  await page.reload();
  await page.locator(".group-context-selector select").selectOption("review");
});

test("downloaded reports identify their scope and distinguish ungraded from not submitted", async ({ page, context }) => {
  await page.getByRole("link", { name: "Seguimiento: Revisar asistencia, tutoría e informes", exact: true }).click();
  await page.getByRole("link", { name: "Informes", exact: true }).click();
  const report = await downloadReport(page, "Descargar informe imprimible en HTML");
  expect(report.filename).toContain("3-eso-a-2026-2027");
  const document = await context.newPage();
  await document.setContent(report.content);
  await expect(document.getByText("Grupo: 3 ESO A · Curso escolar: 2026-2027 · Periodo: Todo el curso", { exact: true })).toBeVisible();
  const pending = document.getByRole("row").filter({ hasText: "Bruno Simulado" }).first();
  await expect(pending).toContainText("Sin evidencia académica suficiente");
  await expect(pending).toContainText("1 pendiente(s) de evaluar, 0 no presentado(s)");
  await expect(pending).not.toContainText("Revisar:");
  await expect(document.getByRole("row").filter({ hasText: "Clara Simulado" }).first()).toContainText("1 no presentado(s) expresamente");
  expect(report.content).not.toContain("<td>Alto</td>");
  await page.getByRole("button", { name: /Tutoría y familias/ }).click();
  const individual = await downloadReport(page, "Descargar informes individuales imprimibles en HTML");
  await document.setContent(individual.content);
  await expect(document.getByRole("heading", { name: /Informe individual - Bruno Simulado · 3 ESO A · 2026-2027 · Todo el curso/ })).toBeVisible();
  await expect(document.getByText("No presentado", { exact: true })).toBeVisible();
  await expect(document.getByText("Exento", { exact: true })).toBeVisible();
  await document.close();
});

test("report filename and printable header retain an explicit date range", async ({ page }) => {
  await page.goto("/reports");
  await page.getByLabel("Desde", { exact: true }).fill("2026-01-01");
  await page.getByLabel("Hasta", { exact: true }).fill("2026-12-31");
  const report = await downloadReport(page, "Descargar informe imprimible en HTML");
  expect(report.content).toContain("Periodo: 2026-01-01 — 2026-12-31");
  expect(report.filename).toContain("2026-01-01-2026-12-31");
});

test("calendar downloads preserve timed classes and all-day follow-up dates", async ({ page }) => {
  await page.goto("/agenda");
  const calendar = await downloadReport(page, "Descargar calendario");
  const expected = await page.evaluate(() => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const utc = (time: string) => new Date(`${date}T${time}:00`).toISOString().replace(/[-:]/g, "").replace(/\.000Z$/, "Z");
    return { date: date.replace(/-/g, ""), start: utc("09:00"), end: utc("09:50") };
  });
  expect(calendar.content).toContain(`DTSTART:${expected.start}`);
  expect(calendar.content).toContain(`DTEND:${expected.end}`);
  expect(calendar.content).toContain(`DTSTART;VALUE=DATE:${expected.date}`);
  expect(calendar.content).toContain("SUMMARY:Seguimiento: Revisar acuerdo");
  await expect(page.getByText(/09:00–09:50/)).toBeVisible();
});
