import { describe, expect, it } from "vitest";
import type {
  ClassGroup,
  DailyClassRecord,
  ScheduleDay,
  Subject,
  SubjectCourseLink,
  Task,
  TaskSession
} from "../../shared/db/types";
import { buildTodaySlots } from "./todaySlots";

const classGroups: ClassGroup[] = [
  { id: "class-a", name: "1º ESO A", level: "1º ESO", schoolYear: "2026/2027" },
  { id: "class-b", name: "1º ESO B", level: "1º ESO", schoolYear: "2026/2027" }
];

const subjects: Subject[] = [
  { id: "math", name: "Matemáticas", scheduleSlotIds: ["monday-1", "tuesday-1"] }
];

const subjectCourseLinks: SubjectCourseLink[] = [
  { id: "math-a", subjectId: "math", classId: "class-a" },
  { id: "math-b", subjectId: "math", classId: "class-b" }
];

const scheduleDays: ScheduleDay[] = [
  {
    id: "monday",
    dayOfWeek: 1,
    dayName: "Lunes",
    enabled: true,
    blocks: [{ id: "monday-1", startTime: "08:00", endTime: "08:55" }]
  },
  {
    id: "tuesday",
    dayOfWeek: 2,
    dayName: "Martes",
    enabled: true,
    blocks: [{ id: "tuesday-1", startTime: "09:00", endTime: "09:55" }]
  }
];

function taskSession(overrides: Partial<TaskSession> = {}): TaskSession {
  return {
    id: "session-1",
    taskId: "task-1",
    subjectId: "math",
    classId: "class-a",
    date: "2026-07-06",
    scheduleSlotId: "monday-1",
    ...overrides,
    status: overrides.status ?? "planned"
  };
}

const tasks: Task[] = [
  { id: "task-1", title: "Calentamiento", description: "", sessionCount: 1, sendToGradebook: false },
  { id: "task-2", title: "Tarea principal", description: "", sessionCount: 1, sendToGradebook: true }
];

function exceptionalRecord(overrides: Partial<DailyClassRecord> = {}): DailyClassRecord {
  return {
    id: "record-1",
    classId: "class-a",
    subjectId: "math",
    date: "2026-07-07",
    scheduleSlotId: "exception-1",
    sessionKind: "rescheduled",
    sessionTitle: "Recovered lesson",
    startTime: "11:00",
    endTime: "11:45",
    originalDate: "2026-07-06",
    originalScheduleSlotId: "monday-1",
    generalComment: "",
    studentComments: {},
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    ...overrides
  };
}

describe("buildTodaySlots", () => {
  it("uses only blocks from the active schedule day", () => {
    const slots = buildTodaySlots({
      selectedDate: "2026-07-06",
      classGroups,
      subjects,
      subjectCourseLinks,
      scheduleDays,
      taskSessions: [taskSession({ scheduleSlotId: "tuesday-1" })]
    });

    expect(slots.map((slot) => slot.slotId)).toEqual(["monday-1", "monday-1"]);
  });

  it("uses the planned session to resolve the exact class for a shared subject", () => {
    const slots = buildTodaySlots({
      selectedDate: "2026-07-06",
      classGroups,
      subjects,
      subjectCourseLinks,
      scheduleDays,
      taskSessions: [taskSession({ classId: "class-b" })]
    });

    expect(slots).toHaveLength(1);
    expect(slots[0].classId).toBe("class-b");
  });

  it("emits one slot per task when several tasks share the same period", () => {
    const slots = buildTodaySlots({
      selectedDate: "2026-07-06",
      classGroups,
      subjects,
      subjectCourseLinks,
      scheduleDays,
      taskSessions: [
        taskSession({ id: "session-1", taskId: "task-1" }),
        taskSession({ id: "session-2", taskId: "task-2" })
      ],
      tasks
    });

    expect(slots).toHaveLength(2);
    expect(slots.every((slot) => slot.classId === "class-a")).toBe(true);
    expect(slots.map((slot) => slot.taskId).sort()).toEqual(["task-1", "task-2"]);
    expect(slots.map((slot) => slot.taskTitle).sort()).toEqual(["Calentamiento", "Tarea principal"]);
  });

  it("ignores a cancelled session instead of showing a ghost task row", () => {
    const slots = buildTodaySlots({
      selectedDate: "2026-07-06",
      classGroups,
      subjects,
      subjectCourseLinks,
      scheduleDays,
      taskSessions: [taskSession({ status: "cancelled" })],
      tasks
    });

    expect(slots.map((slot) => slot.classId)).toEqual(["class-a", "class-b"]);
    expect(slots.every((slot) => !slot.taskId && !slot.taskTitle)).toBe(true);
  });

  it("falls back to all linked classes when the day has no planned session", () => {
    const slots = buildTodaySlots({
      selectedDate: "2026-07-06",
      classGroups,
      subjects,
      subjectCourseLinks,
      scheduleDays,
      taskSessions: []
    });

    expect(slots.map((slot) => slot.classId)).toEqual(["class-a", "class-b"]);
  });

  it("does not show planner sessions on disabled schedule days", () => {
    const slots = buildTodaySlots({
      selectedDate: "2026-07-06",
      classGroups,
      subjects,
      subjectCourseLinks,
      scheduleDays: scheduleDays.map((day) => ({ ...day, enabled: false })),
      taskSessions: [taskSession()]
    });

    expect(slots).toEqual([]);
  });

  it("replaces only the recurring occurrence identified by a single-date exception", () => {
    const record = exceptionalRecord();
    const originalSlots = buildTodaySlots({
      selectedDate: "2026-07-06",
      classGroups,
      subjects,
      subjectCourseLinks,
      scheduleDays,
      taskSessions: [],
      dailyClassRecords: [record]
    });
    const targetSlots = buildTodaySlots({
      selectedDate: "2026-07-07",
      classGroups,
      subjects,
      subjectCourseLinks,
      scheduleDays,
      taskSessions: [],
      dailyClassRecords: [record]
    });

    expect(originalSlots.map((slot) => slot.classId)).toEqual(["class-b"]);
    expect(targetSlots.some((slot) => slot.kind === "rescheduled" && slot.startTime === "11:00")).toBe(true);
  });

  it("shows an ad-hoc session even when the recurring day is disabled", () => {
    const slots = buildTodaySlots({
      selectedDate: "2026-07-07",
      classGroups,
      subjects,
      subjectCourseLinks,
      scheduleDays: scheduleDays.map((day) => ({ ...day, enabled: false })),
      taskSessions: [],
      dailyClassRecords: [
        exceptionalRecord({
          sessionKind: "adHoc",
          originalDate: undefined,
          originalScheduleSlotId: undefined
        })
      ]
    });

    expect(slots).toMatchObject([
      {
        classId: "class-a",
        subjectId: "math",
        kind: "adHoc",
        title: "Recovered lesson"
      }
    ]);
  });
});
