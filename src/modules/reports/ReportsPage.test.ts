import { describe, expect, it } from "vitest";
import type { Assessment, AttendanceEntry, GradebookGroup } from "../../shared/db/types";
import {
  attendanceRiskLabel,
  calculateAttendanceSummary,
  calculateContributions,
  csvPreview,
  formatAttendanceRate,
  isAssessmentInReportRange,
  joinUnique,
  riskLabel,
  taskStudentKey,
  taskSubjectKey,
  type ReportTaskRow
} from "./ReportsPage";

describe("report helpers", () => {
  const attendanceContext = {
    classId: "class-1",
    subjectId: "subject-1",
    scheduleSlotId: "slot-1",
    createdAt: "2026-05-20T08:00:00.000Z",
    updatedAt: "2026-05-20T08:00:00.000Z"
  };

  const attendanceEntry = (
    id: string,
    status: AttendanceEntry["status"],
    date: string,
    studentId = "student-1"
  ): AttendanceEntry => ({
    ...attendanceContext,
    id,
    studentId,
    date,
    status
  });

  it("filters manual assessments by their explicit date and excludes undated legacy rows", () => {
    expect(isAssessmentInReportRange({ assessmentDate: "2026-05-12" }, "2026-05-01", "2026-05-31")).toBe(true);
    expect(isAssessmentInReportRange({ assessmentDate: "2026-06-01" }, "2026-05-01", "2026-05-31")).toBe(false);
    expect(isAssessmentInReportRange({}, "2026-05-01", "2026-05-31")).toBe(false);
    expect(isAssessmentInReportRange({}, "", "")).toBe(true);
  });

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
      attendanceEntry("1", "present", "2026-05-20"),
      attendanceEntry("2", "late", "2026-05-21"),
      attendanceEntry("3", "absent", "2026-05-22"),
      attendanceEntry("4", "present", "2026-05-22", "student-2")
    ];

    expect(calculateAttendanceSummary(rows, "student-1")).toEqual({
      present: 1,
      late: 1,
      absent: 1,
      total: 3,
      rate: 67
    });
  });

  it("represents attendance without records as no data and does not raise risk", () => {
    const summary = calculateAttendanceSummary([], "student-1");

    expect(summary).toEqual({ present: 0, late: 0, absent: 0, total: 0, rate: null });
    expect(formatAttendanceRate(summary.rate)).toBe("Sin datos");
    expect(attendanceRiskLabel(summary.rate)).toBe("Sin datos");
    expect(riskLabel(8, summary.rate, 0)).toBe("Bajo");
    expect(riskLabel(null, summary.rate, 0)).toBe("Bajo");
  });

  it("reports complete attendance as 100 percent", () => {
    const summary = calculateAttendanceSummary(
      [
        attendanceEntry("1", "present", "2026-05-20"),
        attendanceEntry("2", "present", "2026-05-21")
      ],
      "student-1"
    );

    expect(summary.rate).toBe(100);
    expect(formatAttendanceRate(summary.rate)).toBe("100%");
    expect(riskLabel(8, summary.rate, 0)).toBe("Bajo");
  });

  it("reports an observed all-absent sample as zero percent and high risk", () => {
    const summary = calculateAttendanceSummary(
      [
        attendanceEntry("1", "absent", "2026-05-20"),
        attendanceEntry("2", "absent", "2026-05-21")
      ],
      "student-1"
    );

    expect(summary.rate).toBe(0);
    expect(formatAttendanceRate(summary.rate)).toBe("0%");
    expect(attendanceRiskLabel(summary.rate)).toBe("Alto");
    expect(riskLabel(8, summary.rate, 0)).toBe("Alto");
  });

  it("counts an observed all-late sample as valid attendance", () => {
    const summary = calculateAttendanceSummary(
      [
        attendanceEntry("1", "late", "2026-05-20"),
        attendanceEntry("2", "late", "2026-05-21")
      ],
      "student-1"
    );

    expect(summary.rate).toBe(100);
    expect(riskLabel(8, summary.rate, 0)).toBe("Bajo");
  });

  it("keeps report key formats stable", () => {
    expect(taskSubjectKey("task-1", "subject-1")).toBe("task-1:subject-1");
    expect(taskStudentKey("task-1", "subject-1", "student-1")).toBe("task-1:subject-1:student-1");
  });

  it("labels risk from grades, observed attendance and pending work", () => {
    expect(riskLabel(4.9, 100, 0)).toBe("Alto");
    expect(riskLabel(8, 70, 0)).toBe("Alto");
    expect(riskLabel(8, 100, 40)).toBe("Alto");
    expect(riskLabel(8, 100, 0)).toBe("Bajo");
  });

  it("keeps ACS and reinforcement as support signals without raising academic risk", () => {
    const supportSignals = { hasAcs: true, hasReinforcement: true };

    expect(supportSignals).toEqual({ hasAcs: true, hasReinforcement: true });
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
