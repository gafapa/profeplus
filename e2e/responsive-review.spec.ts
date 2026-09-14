import { expect, test, type Page } from "@playwright/test";

async function seedClassroom(page: Page) {
  await page.goto("/management/students");
  await page.locator(".group-context-selector select").waitFor();
  await page.evaluate(async () => {
    const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
    const now = new Date().toISOString();
    await db.classGroups.put({ id: "responsive-a", name: "1 ESO A", level: "ESO", schoolYear: "2026-2027" });
    await db.subjects.put({ id: "responsive-math", name: "Matemáticas", scheduleSlotIds: ["responsive-slot"] });
    await db.subjectCourseLinks.put({ id: "responsive-link", classId: "responsive-a", subjectId: "responsive-math" });
    const tuesday = await db.scheduleDays.where("dayOfWeek").equals(2).first();
    await db.scheduleDays.put({ id: tuesday?.id ?? "responsive-tue", dayOfWeek: 2, dayName: "Martes", enabled: true, blocks: [{ id: "responsive-slot", startTime: "09:00", endTime: "09:50" }] });
    await db.unitBlocks.put({ id: "responsive-unit", subjectId: "responsive-math", name: "Fracciones", description: "Fictional responsive fixture", position: 0, sessionCount: 1 });
    await db.tasks.put({ id: "responsive-task", title: "Comparar fracciones", description: "Fictional responsive fixture", sessionCount: 1, sendToGradebook: true });
    await db.taskSubjectLinks.put({ id: "responsive-task-link", taskId: "responsive-task", subjectId: "responsive-math", unitId: "responsive-unit" });
    await db.taskSessions.put({ id: "responsive-session", taskId: "responsive-task", subjectId: "responsive-math", classId: "responsive-a", date: "2026-09-08", scheduleSlotId: "responsive-slot", status: "planned" });
    for (let index = 0; index < 12; index++) {
      const studentId = `responsive-student-${index}`;
      const firstName = index === 0 ? "María de los Ángeles" : `Simulated ${index}`;
      const lastName = index === 0 ? "Fernández de la Torre y García-López" : "Student";
      await db.students.put({ id: studentId, classId: "responsive-a", firstName, lastName, fullName: `${firstName} ${lastName}` });
      await db.subjectStudentLinks.put({ id: `responsive-enrolment-${index}`, studentId, subjectId: "responsive-math" });
      await db.attendanceEntries.put({ id: `responsive-attendance-${index}`, classId: "responsive-a", subjectId: "responsive-math", studentId, date: "2026-09-08", scheduleSlotId: "responsive-slot", status: index === 0 ? "late" : "present", note: "", createdAt: now, updatedAt: now });
    }
  });
  await page.reload();
  await page.locator(".group-context-selector select").selectOption("responsive-a");
}

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 384, height: 512 }, { width: 1440, height: 1000 }]) {
  test(`classroom forms and history stay contained at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await seedClassroom(page);
    for (const [route, heading] of [["/management/units", "Detalle de unidad"], ["/journal/attendance", "Historial de asistencia"], ["/classroom", "Plano y grupos"]]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      if (route === "/journal/attendance") await page.locator('input[type="month"]').fill("2026-09");
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
        await testInfo.attach("overflow-geometry", { contentType: "application/json", body: JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("main *")].filter((element) => element.getBoundingClientRect().right > innerWidth).map((element) => ({ tag: element.tagName, className: element.className, rectangle: element.getBoundingClientRect().toJSON() })))) });
      }
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      if (route === "/classroom") {
        await page.getByRole("button", { name: "Generar grupos", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Grupos generados", exact: true })).toBeVisible();
      }
      await page.screenshot({ path: testInfo.outputPath(`${route.replaceAll("/", "-")}.png`), fullPage: true });
    }
  });
}

test("phone save and modal controls remain usable while the reminder is visible", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedClassroom(page);
  await page.goto("/today?classId=responsive-a&date=2026-09-08");
  const reminder = page.getByRole("status", { name: "Recordatorio de copia de seguridad" });
  await expect(reminder).toBeVisible();
  await page.getByLabel("Registro real de la sesión").fill("Fictional lesson completed.");
  const save = page.locator(".today-close-session");
  await save.scrollIntoViewIfNeeded();
  await expect.poll(async () => {
    const saveBox = await save.boundingBox();
    const reminderBox = await reminder.boundingBox();
    return Boolean(saveBox && reminderBox && saveBox.y + saveBox.height <= reminderBox.y);
  }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("save-with-reminder.png") });
  await save.click();
  await expect(save).toHaveText("Clase guardada");
  await page.getByRole("button", { name: /Editar detalles de asistencia y trabajo de María/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: /Cerrar/ }).first();
  await close.click();
  await expect(dialog).not.toBeVisible();
  await reminder.getByRole("button", { name: "Descartar recordatorio durante esta sesión" }).click();
  await expect(reminder).not.toBeVisible();
});

test("frequent configuration controls have at least 44px touch targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedClassroom(page);
  for (const [route, selector] of [["/gradebook", ".gradebook-internal-tabs .section-tab"], ["/management/courses", ".year-stepper-btn"], ["/management/subjects", ".schedule-slot-pill"]]) {
    await page.goto(route);
    if (route === "/management/subjects") await page.getByRole("button", { name: /Matemáticas/ }).first().click();
    await page.locator(selector).first().waitFor();
    for (const control of await page.locator(selector).all()) {
      const box = await control.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  }
});
