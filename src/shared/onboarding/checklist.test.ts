import { describe, expect, it } from "vitest";
import { buildOnboardingChecklist } from "./checklist";

describe("onboarding checklist", () => {
  it("reports each dependency without creating provisional records", () => {
    const empty = buildOnboardingChecklist({
      courses: [],
      students: [],
      scheduleDays: [],
      subjects: [],
      subjectCourseLinks: []
    });

    expect(empty.every((item) => !item.complete)).toBe(true);

    const ready = buildOnboardingChecklist({
      courses: [{ id: "class-1", name: "4º Primaria A", level: "4º", schoolYear: "2026-2027" }],
      students: [
        {
          id: "student-1",
          classId: "class-1",
          firstName: "Ana",
          lastName: "López",
          fullName: "Ana López"
        }
      ],
      scheduleDays: [
        {
          id: "monday",
          dayOfWeek: 1,
          dayName: "Lunes",
          enabled: true,
          blocks: [{ id: "monday-1", startTime: "09:00", endTime: "10:00" }]
        }
      ],
      subjects: [{ id: "math", name: "Matemáticas", scheduleSlotIds: ["monday-1"] }],
      subjectCourseLinks: [{ id: "math-class", subjectId: "math", classId: "class-1" }],
      taskSessions: [{ id: "lesson", taskId: "task", subjectId: "math", classId: "class-1", date: "2026-09-07", scheduleSlotId: "monday-1", status: "planned" }]
    });

    expect(ready.every((item) => item.complete)).toBe(true);
    expect(ready).toHaveLength(5);
  });

  it("does not mark a subject ready when it only references an inactive slot", () => {
    const checklist = buildOnboardingChecklist({
      courses: [{ id: "class-1", name: "4º Primaria A", level: "4º", schoolYear: "2026-2027" }],
      students: [],
      scheduleDays: [
        {
          id: "monday",
          dayOfWeek: 1,
          dayName: "Lunes",
          enabled: false,
          blocks: [{ id: "monday-1", startTime: "09:00", endTime: "10:00" }]
        }
      ],
      subjects: [{ id: "math", name: "Matemáticas", scheduleSlotIds: ["monday-1"] }],
      subjectCourseLinks: [{ id: "math-class", subjectId: "math", classId: "class-1" }]
    });

    expect(checklist.find((item) => item.id === "subjects")?.complete).toBe(false);
    expect(checklist.find((item) => item.id === "lesson")?.complete).toBe(false);
  });

  it("keeps the first lesson pending for cancelled or unrelated sessions", () => {
    const base = {
      courses: [{ id: "class", name: "Primary", level: "3", schoolYear: "2026-2027" }],
      students: [], scheduleDays: [], subjects: [{ id: "math", name: "Math", scheduleSlotIds: [] }], subjectCourseLinks: []
    };
    const session = { id: "lesson", taskId: "task", subjectId: "math", classId: "class", date: "2026-09-07", scheduleSlotId: "slot", status: "planned" as const };
    for (const taskSessions of [[], [{ ...session, status: "cancelled" as const }], [{ ...session, classId: "other" }]]) {
      expect(buildOnboardingChecklist({ ...base, taskSessions }).find((item) => item.id === "lesson")?.complete).toBe(false);
    }
  });
});
