import { expect, test } from "@playwright/test";
import { seedMoodleLocalRecords } from "./moodle-fixture";

test("Moodle metadata stays cancellable, idempotent and safe across backup restore", async ({ page }) => {
  await page.goto("/config/preferences");
  await page.evaluate(async () => {
    const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
    await db.transaction("rw", db.tables, async () => {
      for (const table of db.tables) await table.clear();
    });
  });
  await seedMoodleLocalRecords(page);

  const result = await page.evaluate(async () => {
    const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
    const service = await import(/* @vite-ignore */ "/src/shared/moodle/service.ts");
    const backup = await import(/* @vite-ignore */ "/src/modules/management/ManagementDatabasePage.tsx");
    const site = {
      siteUrl: "https://moodle.example.invalid/school/",
      siteName: "Synthetic Moodle",
      userId: 9,
      fullName: "Synthetic Teacher",
      functions: []
    };

    const abortedController = new AbortController();
    const cancelledSave = service.saveConnection({ ...site, userId: 99 }, abortedController.signal);
    abortedController.abort();
    let cancelled = false;
    try {
      await cancelledSave;
    } catch {
      cancelled = true;
    }
    const cancelledWasNotPersisted = !(await service.listConnections()).some((connection) => connection.userId === 99);

    const connection = await service.saveConnection(site);
    const scope = { courseId: 4, classId: "moodle-local-class", subjectId: "moodle-local-subject" };
    const snapshot = {
      course: { id: 4, fullName: "Remote course", shortName: "RC" },
      groups: [],
      students: [{ id: 12, firstName: "Created", lastName: "Pupil", fullName: "Created Pupil" }],
      activities: [{
        id: 72,
        courseId: 4,
        instanceId: 8,
        module: "assign",
        title: "Created assignment",
        url: "https://moodle.example.invalid/school/mod/assign/view.php?id=72",
        gradeMax: 100,
        advancedGrading: false,
        teamSubmission: false
      }],
      grades: [],
      submissions: [],
      warnings: [],
      fetchedAt: new Date().toISOString()
    };
    const createChoices = [
      { kind: "student" as const, remoteId: 12, action: "create" as const },
      { kind: "activity" as const, remoteId: 72, action: "create" as const }
    ];
    await service.applyMappingPreview(await service.createMappingPreview(connection.id, snapshot, scope, createChoices));
    const afterFirstCreate = { students: await db.students.count(), tasks: await db.tasks.count() };
    await service.applyMappingPreview(await service.createMappingPreview(connection.id, snapshot, scope, createChoices));
    const afterRepeatCreate = { students: await db.students.count(), tasks: await db.tasks.count() };

    await db.classGroups.add({ id: "moodle-other-class", name: "Other group", level: "ESO", schoolYear: "2026-2027" });
    await db.subjects.add({ id: "moodle-other-subject", name: "Other subject", scheduleSlotIds: [] });
    await db.subjectCourseLinks.add({ id: "moodle-other-scl", classId: "moodle-other-class", subjectId: "moodle-other-subject" });
    const otherScope = { courseId: 4, classId: "moodle-other-class", subjectId: "moodle-other-subject" };
    const crossScopePreview = await service.createMappingPreview(connection.id, snapshot, otherScope, [createChoices[0]]);
    let crossScopeCreateRejected = crossScopePreview.rows[0]?.status === "invalid";
    try {
      await service.applyMappingPreview(crossScopePreview);
      crossScopeCreateRejected = false;
    } catch {
      // Expected: creating a second local identity requires an explicit link choice.
    }

    const exported = await backup.buildCurrentPayload();
    const expectedBindingCount = (exported.tables.moodleBindings as unknown[]).length;
    await db.transaction("rw", db.tables, async () => {
      for (const table of db.tables) await table.clear();
    });
    await backup.restoreDatabasePayload(exported);
    const restoredBindingCount = await db.moodleBindings.count();

    const withOrphan = structuredClone(exported);
    const tables = withOrphan.tables as Record<string, Record<string, unknown>[]>;
    tables.moodleBindings.push({
      id: "orphan-binding",
      connectionId: connection.id,
      courseId: 4,
      classId: scope.classId,
      subjectId: scope.subjectId,
      kind: "student",
      remoteId: 999,
      localId: "missing-local-student",
      remoteLabel: "Missing pupil",
      localBaseline: { firstName: "Missing", lastName: "Pupil", fullName: "Missing Pupil", email: null },
      remoteBaseline: { firstName: "Missing", lastName: "Pupil", fullName: "Missing Pupil", email: null },
      updatedAt: new Date().toISOString()
    });
    await backup.restoreDatabasePayload(withOrphan);
    const orphanPruned = !(await db.moodleBindings.get("orphan-binding"));
    const pruningReported = (await service.getOperations(connection.id)).some((operation) =>
      operation.summary.includes("obsoletas") && operation.count === 1);

    return {
      cancelled,
      cancelledWasNotPersisted,
      repeatCreateWasIdempotent: JSON.stringify(afterFirstCreate) === JSON.stringify(afterRepeatCreate),
      crossScopeCreateRejected,
      metadataRoundTripped: restoredBindingCount === expectedBindingCount,
      orphanPruned,
      pruningReported
    };
  });

  expect(result).toEqual({
    cancelled: true,
    cancelledWasNotPersisted: true,
    repeatCreateWasIdempotent: true,
    crossScopeCreateRejected: true,
    metadataRoundTripped: true,
    orphanPruned: true,
    pruningReported: true
  });
});
