import { describe, expect, it } from "vitest";
import type {
  AcademicPeriod,
  GradebookPeriodSnapshotData
} from "../db/types";
import {
  buildPeriodClosureRecords,
  buildReopenedAcademicPeriod,
  buildSchoolYearRolloverRows,
  validateAcademicPeriodDraft,
  type SchoolYearRolloverSource
} from "./periods";

function buildPeriod(overrides: Partial<AcademicPeriod> = {}): AcademicPeriod {
  return {
    id: "period-1",
    classId: "class-1",
    name: "First term",
    startDate: "2025-09-01",
    endDate: "2025-12-20",
    position: 0,
    status: "open",
    createdAt: "2025-08-01T00:00:00.000Z",
    updatedAt: "2025-08-01T00:00:00.000Z",
    closureVersion: 0,
    ...overrides
  };
}

function buildSnapshotData(): GradebookPeriodSnapshotData {
  return {
    classGroup: { id: "class-1", name: "2 ESO A", level: "2 ESO", schoolYear: "2025-2026" },
    students: [
      {
        id: "student-1",
        classId: "class-1",
        firstName: "Ana",
        lastName: "Lopez",
        fullName: "Ana Lopez"
      }
    ],
    subjects: [{ id: "subject-1", name: "Mathematics", scheduleSlotIds: ["slot-1"] }],
    subjectCourseLinks: [{ id: "subject-course-1", subjectId: "subject-1", classId: "class-1" }],
    subjectStudentLinks: [{ id: "subject-student-1", subjectId: "subject-1", studentId: "student-1" }],
    assessments: [
      {
        id: "assessment-1",
        classId: "class-1",
        subjectId: "subject-1",
        academicPeriodId: "period-1",
        assessmentDate: "2024-02-29",
        title: "Exam",
        weight: 1,
        period: "First term"
      }
    ],
    gradeEntries: [
      {
        id: "grade-1",
        classId: "class-1",
        assessmentId: "assessment-1",
        studentId: "student-1",
        numericValue: 8
      }
    ],
    gradebookGroups: [],
    taskGradebookConfigs: [],
    tasks: [],
    taskSubjectLinks: [],
    taskSessions: [],
    taskDailyEvaluationSettings: [],
    taskRubricAssessments: [],
    taskChecklistAssessments: [],
    taskDirectGrades: [],
    rubricTemplates: [],
    checklistTemplates: []
  };
}

describe("academic periods", () => {
  it("rejects overlapping periods in the same class", () => {
    expect(() =>
      validateAcademicPeriodDraft(
        {
          name: "Second term",
          startDate: "2025-12-15",
          endDate: "2026-03-20"
        },
        [buildPeriod()]
      )
    ).toThrow(/must not overlap/);
  });

  it("creates versioned immutable closure snapshots and preserves previous versions", () => {
    const sourceData = buildSnapshotData();
    const firstClosure = buildPeriodClosureRecords(
      buildPeriod(),
      sourceData,
      "snapshot-1",
      "2025-12-21T00:00:00.000Z"
    );
    sourceData.gradeEntries[0].numericValue = 3;

    expect(firstClosure.snapshot.version).toBe(1);
    expect(firstClosure.snapshot.data.gradeEntries[0].numericValue).toBe(8);
    expect(firstClosure.period.status).toBe("closed");

    const reopened = buildReopenedAcademicPeriod(
      firstClosure.period,
      "2026-01-05T00:00:00.000Z"
    );
    const secondClosure = buildPeriodClosureRecords(
      reopened,
      sourceData,
      "snapshot-2",
      "2026-01-06T00:00:00.000Z"
    );

    expect(firstClosure.snapshot.version).toBe(1);
    expect(firstClosure.snapshot.data.gradeEntries[0].numericValue).toBe(8);
    expect(secondClosure.snapshot.version).toBe(2);
    expect(secondClosure.snapshot.data.gradeEntries[0].numericValue).toBe(3);
  });

  it("builds an isolated next-year structure without carrying historical evidence", () => {
    const snapshot = buildSnapshotData();
    const source: SchoolYearRolloverSource = {
      classGroup: snapshot.classGroup,
      students: snapshot.students,
      subjects: snapshot.subjects,
      subjectCourseLinks: snapshot.subjectCourseLinks,
      subjectStudentLinks: snapshot.subjectStudentLinks,
      units: [
        {
          id: "unit-1",
          subjectId: "subject-1",
          name: "Numbers",
          description: "",
          sessionCount: 5,
          position: 0
        }
      ],
      tasks: [{ id: "task-1", title: "Worksheet", description: "", sessionCount: 1, sendToGradebook: true }],
      taskSubjectLinks: [{ id: "task-subject-1", taskId: "task-1", subjectId: "subject-1", unitId: "unit-1" }],
      taskGradebookConfigs: [
        {
          id: "config-1",
          taskId: "task-1",
          subjectId: "subject-1",
          classId: "class-1",
          academicPeriodId: "period-1",
          gradebookWeight: 1,
          directGradeEnabled: true
        }
      ],
      gradebookGroups: [],
      assessments: snapshot.assessments,
      rubricTemplates: [],
      checklistTemplates: [],
      academicPeriods: [buildPeriod({ startDate: "2024-02-29", endDate: "2024-06-30" })]
    };
    let nextId = 0;
    const rows = buildSchoolYearRolloverRows(
      source,
      { id: "class-2", name: "3 ESO A", level: "3 ESO", schoolYear: "2026-2027" },
      () => `new-${++nextId}`,
      "2026-07-01T00:00:00.000Z"
    );

    expect(rows.classGroup.id).toBe("class-2");
    expect(rows.students[0]).toMatchObject({
      classId: "class-2",
      personId: "student-1"
    });
    expect(rows.students[0].id).not.toBe("student-1");
    expect(rows.subjects[0].id).not.toBe("subject-1");
    expect(rows.taskGradebookConfigs[0]).toMatchObject({
      classId: "class-2",
      taskId: rows.tasks[0].id,
      subjectId: rows.subjects[0].id
    });
    expect(rows.assessments[0].assessmentDate).toBe("2025-02-28");
    expect(rows.academicPeriods[0]).toMatchObject({
      classId: "class-2",
      startDate: "2025-02-28",
      endDate: "2025-06-30",
      status: "open",
      closureVersion: 0
    });
    expect(rows).not.toHaveProperty("gradeEntries");
    expect(rows).not.toHaveProperty("taskSessions");
  });
});
