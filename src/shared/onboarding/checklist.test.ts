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
      subjectCourseLinks: [{ id: "math-class", subjectId: "math", classId: "class-1" }]
    });

    expect(ready.every((item) => item.complete)).toBe(true);
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
  });
});
