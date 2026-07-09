import { describe, expect, it } from "vitest";
import { normalizeSessionPlanDraft, sessionPlanDraftFromSession, sessionStatusLabel } from "./sessionPlan";

describe("session plan helpers", () => {
  it("builds a draft from an existing task session", () => {
    expect(
      sessionPlanDraftFromSession({
        id: "session-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        date: "2026-07-08",
        scheduleSlotId: "slot-1",
        status: "done",
        objectives: "Objective"
      })
    ).toMatchObject({
      status: "done",
      objectives: "Objective",
      competencies: ""
    });
  });

  it("normalizes optional planning fields", () => {
    expect(
      normalizeSessionPlanDraft({
        status: "planned",
        objectives: "  Read text ",
        competencies: "",
        materials: " Worksheet ",
        homework: "",
        teacherNotes: "  Review group B "
      })
    ).toEqual({
      status: "planned",
      objectives: "Read text",
      competencies: undefined,
      materials: "Worksheet",
      homework: undefined,
      teacherNotes: "Review group B"
    });
  });

  it("returns Spanish labels for session statuses", () => {
    expect(sessionStatusLabel("planned")).toBe("Planificada");
    expect(sessionStatusLabel("cancelled")).toBe("Cancelada");
  });
});
