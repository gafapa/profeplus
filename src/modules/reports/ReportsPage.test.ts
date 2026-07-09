import { describe, expect, it } from "vitest";
import type { Assessment, AttendanceEntry, GradebookGroup } from "../../shared/db/types";
import {
  calculateAttendanceSummary,
  calculateContributions,
  csvPreview,
  joinUnique,
  riskLabel,
  taskStudentKey,
  taskSubjectKey,
  type ReportTaskRow
} from "./ReportsPage";

describe("report helpers", () => {
  it("calculates weighted contributions through gradebook folders", () => {
    const assessments: Assessment[] = [
      {
        id: "assessment-1",
        classId: "class-1",
        subjectId: "subject-1",
        title: "Exam",
        weight: 2,
        period: "",
        groupId: "group-a"
      }
    ];
    const tasks: ReportTaskRow[] = [
      {
        taskId: "task-1",
        subjectId: "subject-1",
        subjectName: "Math",
        title: "Task A",
        gradebookWeight: 1,
        groupId: "group-a"
      },
      {
        taskId: "task-2",
        subjectId: "subject-1",
        subjectName: "Math",
        title: "Task B",
        gradebookWeight: 1,
        groupId: "group-b"
      }
    ];
    const groups: GradebookGroup[] = [
      {
        id: "group-a",
        classId: "class-1",
        subjectId: "subject-1",
        name: "A",
        position: 1,
        weight: 70
      },
      {
        id: "group-b",
        classId: "class-1",
        subjectId: "subject-1",
        name: "B",
        position: 2,
        weight: 30
      }
    ];

    const result = calculateContributions(assessments, tasks, groups);

    expect(result.assessmentContributionById.get("assessment-1")).toBeCloseTo(0.4667, 4);
    expect(result.taskContributionByKey.get(taskSubjectKey("task-1", "subject-1"))).toBeCloseTo(0.2333, 4);
    expect(result.taskContributionByKey.get(taskSubjectKey("task-2", "subject-1"))).toBeCloseTo(0.3, 4);
  });

  it("splits contributions equally when all weights are zero", () => {
    const assessments: Assessment[] = [
      {
        id: "assessment-1",
        classId: "class-1",
        subjectId: "subject-1",
        title: "Exam",
        weight: 0,
        period: ""
      }
    ];
    const tasks: ReportTaskRow[] = [
      {
        taskId: "task-1",
        subjectId: "subject-1",
        subjectName: "Math",
        title: "Task",
        gradebookWeight: 0
      }
    ];

    const result = calculateContributions(assessments, tasks, []);

    expect(result.assessmentContributionById.get("assessment-1")).toBeCloseTo(0.5);
    expect(result.taskContributionByKey.get(taskSubjectKey("task-1", "subject-1"))).toBeCloseTo(0.5);
  });

  it("counts late attendance as valid attendance", () => {
    const rows: AttendanceEntry[] = [
      { id: "1", classId: "class-1", studentId: "student-1", date: "2026-05-20", status: "present" },
      { id: "2", classId: "class-1", studentId: "student-1", date: "2026-05-21", status: "late" },
      { id: "3", classId: "class-1", studentId: "student-1", date: "2026-05-22", status: "absent" },
      { id: "4", classId: "class-1", studentId: "student-2", date: "2026-05-22", status: "present" }
    ];

    expect(calculateAttendanceSummary(rows, "student-1")).toEqual({
      present: 1,
      late: 1,
      absent: 1,
      total: 3,
      rate: 67
    });
  });

  it("keeps report key formats stable", () => {
    expect(taskSubjectKey("task-1", "subject-1")).toBe("task-1:subject-1");
    expect(taskStudentKey("task-1", "subject-1", "student-1")).toBe("task-1:subject-1:student-1");
  });

  it("labels risk from grades, attendance, pending work and support flags", () => {
    expect(riskLabel(4.9, 100, 0)).toBe("Alto");
    expect(riskLabel(8, 70, 0)).toBe("Alto");
    expect(riskLabel(8, 100, 40)).toBe("Alto");
    expect(riskLabel(8, 100, 0, true, false)).toBe("Medio");
    expect(riskLabel(8, 100, 0)).toBe("Bajo");
  });

  it("normalizes CSV previews and deduplicates observations", () => {
    expect(joinUnique(["  Una nota  ", "Una nota", undefined, "Otra\nnota"])).toBe("Una nota | Otra nota");
    expect(
      csvPreview(
        [
          ["Alumno", "Detalle"],
          ["Ana", "  texto\nlargo  "],
          ["Luis", "omitido"]
        ],
        2
      )
    ).toBe("Alumno; Detalle\nAna; texto largo");
  });
});
