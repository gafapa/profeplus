import { describe, expect, it } from "vitest";
import type {
  Assessment,
  GradebookGroup,
  RubricTemplate,
  Student,
  TaskChecklistAssessment,
  TaskDirectGrade,
  TaskGradebookConfig,
  TaskRubricAssessment,
  TaskDailyEvaluationSetting
} from "../db/types";
import {
  calculateGradebookContributions,
  calculateTaskScoresByStudent,
  matchesTaskScope,
  taskStudentKey,
  taskSubjectKey
} from "./calculations";

describe("gradebook calculations", () => {
  it("keeps task score calculations scoped by class and subject", () => {
    const students: Student[] = [
      {
        id: "student-1",
        classId: "class-1",
        firstName: "Ana",
        lastName: "Lopez",
        fullName: "Ana Lopez"
      }
    ];
    const tasks: TaskGradebookConfig[] = [
      {
        id: "config-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        gradebookWeight: 1,
        rubricTemplateId: "rubric-1"
      }
    ];
    const rubricTemplates: RubricTemplate[] = [
      {
        id: "rubric-1",
        classId: "class-1",
        taskId: "task-1",
        name: "Rubric",
        criteria: [
          {
            id: "criterion-1",
            name: "Criterion",
            levels: [
              { id: "low", name: "Low", score: 0 },
              { id: "high", name: "High", score: 10 }
            ]
          }
        ]
      }
    ];
    const settings: TaskDailyEvaluationSetting[] = [
      {
        id: "setting-class-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        date: "2026-05-24",
        scheduleSlotId: "slot-1",
        rubricTemplateId: "rubric-1"
      },
      {
        id: "setting-class-2",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-2",
        date: "2026-05-24",
        scheduleSlotId: "slot-1",
        rubricTemplateId: "rubric-1"
      }
    ];
    const rubricAssessments: TaskRubricAssessment[] = [
      {
        id: "assessment-class-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        date: "2026-05-24",
        scheduleSlotId: "slot-1",
        studentId: "student-1",
        rubricTemplateId: "rubric-1",
        criterionId: "criterion-1",
        levelId: "high",
        score: 10
      },
      {
        id: "assessment-class-2",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-2",
        date: "2026-05-24",
        scheduleSlotId: "slot-1",
        studentId: "student-1",
        rubricTemplateId: "rubric-1",
        criterionId: "criterion-1",
        levelId: "low",
        score: 0
      }
    ];

    const scores = calculateTaskScoresByStudent({
      tasks,
      students,
      selectedClassId: "class-1",
      rubricTemplates,
      checklistTemplates: [],
      taskDailyEvaluationSettings: settings,
      taskRubricAssessments: rubricAssessments,
      taskChecklistAssessments: [],
      taskDirectGrades: []
    });

    expect(scores.get(taskStudentKey("task-1", "subject-1", "student-1"))).toBe(10);
  });

  it("uses direct grades only from the active task subject and class", () => {
    const students: Student[] = [
      {
        id: "student-1",
        classId: "class-1",
        firstName: "Ana",
        lastName: "Lopez",
        fullName: "Ana Lopez"
      }
    ];
    const tasks: TaskGradebookConfig[] = [
      {
        id: "config-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        gradebookWeight: 1,
        directGradeEnabled: true
      }
    ];
    const directGrades: TaskDirectGrade[] = [
      {
        id: "direct-class-2",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-2",
        studentId: "student-1",
        score: 1
      },
      {
        id: "direct-class-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        studentId: "student-1",
        score: 8.5
      }
    ];

    const scores = calculateTaskScoresByStudent({
      tasks,
      students,
      selectedClassId: "class-1",
      rubricTemplates: [],
      checklistTemplates: [],
      taskDailyEvaluationSettings: [],
      taskRubricAssessments: [],
      taskChecklistAssessments: [],
      taskDirectGrades: directGrades
    });

    expect(scores.get(taskStudentKey("task-1", "subject-1", "student-1"))).toBe(8.5);
  });

  it("ignores rubric assessment rows from inactive templates in the same session", () => {
    const students: Student[] = [
      {
        id: "student-1",
        classId: "class-1",
        firstName: "Ana",
        lastName: "Lopez",
        fullName: "Ana Lopez"
      }
    ];
    const tasks: TaskGradebookConfig[] = [
      {
        id: "config-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        gradebookWeight: 1,
        rubricTemplateId: "rubric-active"
      }
    ];
    const rubricTemplates: RubricTemplate[] = [
      {
        id: "rubric-active",
        classId: "class-1",
        taskId: "task-1",
        name: "Active rubric",
        criteria: [
          {
            id: "criterion-1",
            name: "Criterion",
            levels: [
              { id: "low", name: "Low", score: 0 },
              { id: "high", name: "High", score: 10 }
            ]
          }
        ]
      },
      {
        id: "rubric-old",
        classId: "class-1",
        taskId: "task-1",
        name: "Old rubric",
        criteria: [
          {
            id: "old-criterion",
            name: "Old criterion",
            levels: [
              { id: "old-low", name: "Low", score: 0 },
              { id: "old-high", name: "High", score: 10 }
            ]
          }
        ]
      }
    ];
    const settings: TaskDailyEvaluationSetting[] = [
      {
        id: "setting-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        date: "2026-05-24",
        scheduleSlotId: "slot-1",
        rubricTemplateId: "rubric-active"
      }
    ];
    const rubricAssessments: TaskRubricAssessment[] = [
      {
        id: "active-row",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        date: "2026-05-24",
        scheduleSlotId: "slot-1",
        studentId: "student-1",
        rubricTemplateId: "rubric-active",
        criterionId: "criterion-1",
        levelId: "low",
        score: 0
      },
      {
        id: "old-row",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        date: "2026-05-24",
        scheduleSlotId: "slot-1",
        studentId: "student-1",
        rubricTemplateId: "rubric-old",
        criterionId: "old-criterion",
        levelId: "old-high",
        score: 10
      }
    ];

    const scores = calculateTaskScoresByStudent({
      tasks,
      students,
      selectedClassId: "class-1",
      rubricTemplates,
      checklistTemplates: [],
      taskDailyEvaluationSettings: settings,
      taskRubricAssessments: rubricAssessments,
      taskChecklistAssessments: [],
      taskDirectGrades: []
    });

    expect(scores.get(taskStudentKey("task-1", "subject-1", "student-1"))).toBe(0);
  });

  it("ignores checklist assessment rows from inactive templates in the same session", () => {
    const students: Student[] = [
      {
        id: "student-1",
        classId: "class-1",
        firstName: "Ana",
        lastName: "Lopez",
        fullName: "Ana Lopez"
      }
    ];
    const tasks: TaskGradebookConfig[] = [
      {
        id: "config-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        gradebookWeight: 1,
        checklistTemplateId: "checklist-active"
      }
    ];
    const checklistTemplates = [
      {
        id: "checklist-active",
        classId: "class-1",
        taskId: "task-1",
        name: "Active checklist",
        items: [{ id: "item-1", text: "Item" }]
      },
      {
        id: "checklist-old",
        classId: "class-1",
        taskId: "task-1",
        name: "Old checklist",
        items: [{ id: "old-item", text: "Old item" }]
      }
    ];
    const settings: TaskDailyEvaluationSetting[] = [
      {
        id: "setting-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        date: "2026-05-24",
        scheduleSlotId: "slot-1",
        checklistTemplateId: "checklist-active"
      }
    ];
    const checklistAssessments: TaskChecklistAssessment[] = [
      {
        id: "old-row",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        date: "2026-05-24",
        scheduleSlotId: "slot-1",
        studentId: "student-1",
        checklistTemplateId: "checklist-old",
        itemId: "old-item",
        checked: true
      }
    ];

    const scores = calculateTaskScoresByStudent({
      tasks,
      students,
      selectedClassId: "class-1",
      rubricTemplates: [],
      checklistTemplates,
      taskDailyEvaluationSettings: settings,
      taskRubricAssessments: [],
      taskChecklistAssessments: checklistAssessments,
      taskDirectGrades: []
    });

    expect(scores.get(taskStudentKey("task-1", "subject-1", "student-1"))).toBe(0);
  });

  it("counts each rubric criterion only once when duplicate rows exist", () => {
    const students: Student[] = [
      {
        id: "student-1",
        classId: "class-1",
        firstName: "Ana",
        lastName: "Lopez",
        fullName: "Ana Lopez"
      }
    ];
    const tasks: TaskGradebookConfig[] = [
      {
        id: "config-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        gradebookWeight: 1,
        rubricTemplateId: "rubric-1"
      }
    ];
    const rubricTemplates: RubricTemplate[] = [
      {
        id: "rubric-1",
        classId: "class-1",
        taskId: "task-1",
        name: "Rubric",
        criteria: [
          {
            id: "criterion-1",
            name: "Criterion 1",
            levels: [
              { id: "low-1", name: "Low", score: 0 },
              { id: "high-1", name: "High", score: 10 }
            ]
          },
          {
            id: "criterion-2",
            name: "Criterion 2",
            levels: [
              { id: "low-2", name: "Low", score: 0 },
              { id: "high-2", name: "High", score: 10 }
            ]
          }
        ]
      }
    ];
    const settings: TaskDailyEvaluationSetting[] = [
      {
        id: "setting-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        date: "2026-05-24",
        scheduleSlotId: "slot-1",
        rubricTemplateId: "rubric-1"
      }
    ];
    const rubricAssessments: TaskRubricAssessment[] = [
      {
        id: "row-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        date: "2026-05-24",
        scheduleSlotId: "slot-1",
        studentId: "student-1",
        rubricTemplateId: "rubric-1",
        criterionId: "criterion-1",
        levelId: "high-1",
        score: 10
      },
      {
        id: "row-duplicate",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        date: "2026-05-24",
        scheduleSlotId: "slot-1",
        studentId: "student-1",
        rubricTemplateId: "rubric-1",
        criterionId: "criterion-1",
        levelId: "high-1",
        score: 10
      }
    ];

    const scores = calculateTaskScoresByStudent({
      tasks,
      students,
      selectedClassId: "class-1",
      rubricTemplates,
      checklistTemplates: [],
      taskDailyEvaluationSettings: settings,
      taskRubricAssessments: rubricAssessments,
      taskChecklistAssessments: [],
      taskDirectGrades: []
    });

    expect(scores.get(taskStudentKey("task-1", "subject-1", "student-1"))).toBe(5);
  });

  it("counts each checklist item only once when duplicate checked rows exist", () => {
    const students: Student[] = [
      {
        id: "student-1",
        classId: "class-1",
        firstName: "Ana",
        lastName: "Lopez",
        fullName: "Ana Lopez"
      }
    ];
    const tasks: TaskGradebookConfig[] = [
      {
        id: "config-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        gradebookWeight: 1,
        checklistTemplateId: "checklist-1"
      }
    ];
    const checklistTemplates = [
      {
        id: "checklist-1",
        classId: "class-1",
        taskId: "task-1",
        name: "Checklist",
        items: [
          { id: "item-1", text: "Item 1" },
          { id: "item-2", text: "Item 2" }
        ]
      }
    ];
    const settings: TaskDailyEvaluationSetting[] = [
      {
        id: "setting-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        date: "2026-05-24",
        scheduleSlotId: "slot-1",
        checklistTemplateId: "checklist-1"
      }
    ];
    const checklistAssessments: TaskChecklistAssessment[] = [
      {
        id: "row-1",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        date: "2026-05-24",
        scheduleSlotId: "slot-1",
        studentId: "student-1",
        checklistTemplateId: "checklist-1",
        itemId: "item-1",
        checked: true
      },
      {
        id: "row-duplicate",
        taskId: "task-1",
        subjectId: "subject-1",
        classId: "class-1",
        date: "2026-05-24",
        scheduleSlotId: "slot-1",
        studentId: "student-1",
        checklistTemplateId: "checklist-1",
        itemId: "item-1",
        checked: true
      }
    ];

    const scores = calculateTaskScoresByStudent({
      tasks,
      students,
      selectedClassId: "class-1",
      rubricTemplates: [],
      checklistTemplates,
      taskDailyEvaluationSettings: settings,
      taskRubricAssessments: [],
      taskChecklistAssessments: checklistAssessments,
      taskDirectGrades: []
    });

    expect(scores.get(taskStudentKey("task-1", "subject-1", "student-1"))).toBe(5);
  });

  it("calculates the same weighted folder contributions used by reports and gradebook", () => {
    const groups: GradebookGroup[] = [
      { id: "folder-a", classId: "class-1", subjectId: "subject-1", name: "A", position: 1, weight: 60 },
      { id: "folder-b", classId: "class-1", subjectId: "subject-1", name: "B", position: 2, weight: 40 }
    ];
    const result = calculateGradebookContributions(
      [],
      [
        { taskId: "task-a", subjectId: "subject-1", gradebookWeight: 0, groupId: "folder-a" },
        { taskId: "task-b", subjectId: "subject-1", gradebookWeight: 0, groupId: "folder-b" }
      ],
      groups
    );

    expect(result.taskContributionByKey.get(taskSubjectKey("task-a", "subject-1"))).toBeCloseTo(0.6);
    expect(result.taskContributionByKey.get(taskSubjectKey("task-b", "subject-1"))).toBeCloseTo(0.4);
    expect(result.groupLeafContributionById.get("folder-a")).toBeCloseTo(0.6);
  });

  it("distributes contributions across manual assessments and gradebook tasks", () => {
    const assessments: Assessment[] = [
      {
        id: "assessment-1",
        classId: "class-1",
        subjectId: "subject-1",
        title: "Manual exam",
        weight: 30,
        period: ""
      }
    ];
    const result = calculateGradebookContributions(
      assessments,
      [{ taskId: "task-1", subjectId: "subject-1", gradebookWeight: 70 }],
      []
    );

    expect(result.assessmentContributionById.get("assessment-1")).toBeCloseTo(0.3);
    expect(result.taskContributionByKey.get(taskSubjectKey("task-1", "subject-1"))).toBeCloseTo(0.7);
    expect(result.totalDistributedShare).toBeCloseTo(1);
  });

  it("accepts legacy unscoped rows but rejects mismatched scoped rows", () => {
    expect(matchesTaskScope({}, "class-1", "subject-1")).toBe(true);
    expect(matchesTaskScope({ classId: "class-2", subjectId: "subject-1" }, "class-1", "subject-1")).toBe(false);
    expect(matchesTaskScope({ classId: "class-1", subjectId: "subject-2" }, "class-1", "subject-1")).toBe(false);
  });
});
