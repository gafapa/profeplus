import { describe, expect, it } from "vitest";
import type { TaskSession } from "../../shared/db/types";
import {
  filterTaskSessionsByAcademicContext,
  filterTaskSessionsForEvaluation,
  selectTaskSessionByDateAndSlot
} from "./taskSessionScope";

function buildSession(
  id: string,
  overrides: Partial<TaskSession> = {}
): TaskSession {
  return {
    id,
    taskId: "shared-task",
    classId: "class-a",
    subjectId: "math",
    date: "2026-09-15",
    scheduleSlotId: "slot-1",
    status: "planned",
    ...overrides
  };
}

describe("task session academic scope", () => {
  const sessions = [
    buildSession("math-class-a"),
    buildSession("history-class-a", {
      subjectId: "history",
      scheduleSlotId: "slot-2"
    }),
    buildSession("math-class-b", {
      classId: "class-b",
      scheduleSlotId: "slot-3"
    }),
    buildSession("other-task-math-class-a", {
      taskId: "other-task",
      scheduleSlotId: "slot-4"
    })
  ];

  it("keeps only sessions from the selected class and subject", () => {
    expect(
      filterTaskSessionsByAcademicContext(sessions, {
        classId: "class-a",
        subjectId: "math"
      }).map((session) => session.id)
    ).toEqual(["math-class-a", "other-task-math-class-a"]);
  });

  it("does not mix a shared task across subjects or classes during evaluation", () => {
    expect(
      filterTaskSessionsForEvaluation(sessions, {
        taskId: "shared-task",
        classId: "class-a",
        subjectId: "math"
      }).map((session) => session.id)
    ).toEqual(["math-class-a"]);

    expect(
      filterTaskSessionsForEvaluation(sessions, {
        taskId: "shared-task",
        classId: "class-a",
        subjectId: "history"
      }).map((session) => session.id)
    ).toEqual(["history-class-a"]);

    expect(
      filterTaskSessionsForEvaluation(sessions, {
        taskId: "shared-task",
        classId: "class-b",
        subjectId: "math"
      }).map((session) => session.id)
    ).toEqual(["math-class-b"]);
  });

  it("preserves exact date and slot selection before applying existing fallbacks", () => {
    const scopedSessions = [
      buildSession("older-slot", { date: "2026-09-08" }),
      buildSession("exact-slot", { date: "2026-09-15" }),
      buildSession("other-slot", {
        date: "2026-09-15",
        scheduleSlotId: "slot-2"
      })
    ];

    expect(selectTaskSessionByDateAndSlot(scopedSessions, "2026-09-15", "slot-1")?.id).toBe("exact-slot");
    expect(selectTaskSessionByDateAndSlot(scopedSessions, "2026-09-22", "slot-1")?.id).toBe("older-slot");
    expect(selectTaskSessionByDateAndSlot(scopedSessions, "2026-09-22", "missing-slot")?.id).toBe("older-slot");
  });
});
