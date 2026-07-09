import { describe, expect, it } from "vitest";
import { db } from "../../shared/db/database";
import { DATABASE_SCHEMA_VERSION, validateDatabasePayload } from "./ManagementDatabasePage";

function emptyTables(): Record<string, unknown[]> {
  return Object.fromEntries(db.tables.map((table) => [table.name, []]));
}

function validPayload(overrides: Record<string, unknown[]> = {}) {
  const classId = "class-1";
  const studentId = "student-1";
  const subjectId = "subject-1";
  const taskId = "task-1";
  const slotId = "slot-1";
  const rubricTemplateId = "rubric-1";
  const checklistTemplateId = "checklist-1";

  return {
    app: "ProfePlus",
    schemaVersion: DATABASE_SCHEMA_VERSION,
    exportedAt: "2026-05-22T00:00:00.000Z",
    tables: {
      ...emptyTables(),
      classGroups: [{ id: classId, name: "1 ESO A", level: "ESO", schoolYear: "2025-2026" }],
      students: [
        {
          id: studentId,
          classId,
          firstName: "Ana",
          lastName: "Lopez",
          fullName: "Ana Lopez"
        }
      ],
      subjects: [{ id: subjectId, name: "Matematicas", scheduleSlotIds: [slotId] }],
      subjectCourseLinks: [{ id: "subject-course-1", subjectId, classId }],
      subjectStudentLinks: [{ id: "subject-student-1", subjectId, studentId }],
      scheduleDays: [
        {
          id: "day-1",
          dayOfWeek: 1,
          dayName: "Lunes",
          enabled: true,
          blocks: [{ id: slotId, startTime: "09:00", endTime: "10:00" }]
        }
      ],
      tasks: [{ id: taskId, title: "Tarea", description: "", sessionCount: 1, sendToGradebook: true }],
      taskSubjectLinks: [{ id: "task-subject-1", taskId, subjectId }],
      taskSessions: [
        {
          id: "session-1",
          taskId,
          subjectId,
          classId,
          date: "2026-05-22",
          scheduleSlotId: slotId
        }
      ],
      rubricTemplates: [
        {
          id: rubricTemplateId,
          classId,
          taskId,
          name: "Rubrica",
          criteria: [
            {
              id: "criterion-1",
              name: "Criterio",
              levels: [
                { id: "level-1", name: "Nivel alto", score: 2 },
                { id: "level-2", name: "Nivel bajo", score: 1 }
              ]
            }
          ]
        }
      ],
      checklistTemplates: [
        {
          id: checklistTemplateId,
          classId,
          taskId,
          name: "Lista",
          items: [{ id: "item-1", text: "Item" }]
        }
      ],
      ...overrides
    }
  };
}

describe("database payload validation", () => {
  it("rejects backup metadata without a valid export timestamp", () => {
    const payload = validPayload();
    payload.exportedAt = "not-a-date";

    expect(() => validateDatabasePayload(payload)).toThrow(/exportedAt/);
  });

  it("rejects backup metadata with impossible export dates", () => {
    const payload = validPayload();
    payload.exportedAt = "2026-02-31T00:00:00.000Z";

    expect(() => validateDatabasePayload(payload)).toThrow(/fecha inexistente/i);
  });

  it("rejects cycles in gradebook folder trees", () => {
    const payload = validPayload({
      gradebookGroups: [
        {
          id: "group-1",
          classId: "class-1",
          subjectId: "subject-1",
          name: "A",
          parentId: "group-2",
          position: 1
        },
        {
          id: "group-2",
          classId: "class-1",
          subjectId: "subject-1",
          name: "B",
          parentId: "group-1",
          position: 2
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/ciclo de carpetas/i);
  });

  it("rejects rubric assessment rows with unknown criteria", () => {
    const payload = validPayload({
      taskRubricAssessments: [
        {
          id: "rubric-row-1",
          taskId: "task-1",
          date: "2026-05-22",
          scheduleSlotId: "slot-1",
          studentId: "student-1",
          rubricTemplateId: "rubric-1",
          criterionId: "missing-criterion",
          levelId: "level-1",
          score: 1
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/criterio o nivel inexistente/i);
  });

  it("rejects negative rubric assessment scores", () => {
    const payload = validPayload({
      taskRubricAssessments: [
        {
          id: "rubric-row-1",
          taskId: "task-1",
          subjectId: "subject-1",
          classId: "class-1",
          date: "2026-05-22",
          scheduleSlotId: "slot-1",
          studentId: "student-1",
          rubricTemplateId: "rubric-1",
          criterionId: "criterion-1",
          levelId: "level-1",
          score: -1
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/score.*0/i);
  });

  it("accepts legacy lessonPlans in old backups without importing them", () => {
    const payload = validPayload();
    payload.schemaVersion = 5;
    (payload.tables as Record<string, unknown[]>).lessonPlans = [
      {
        id: "lesson-1",
        classId: "class-1",
        date: "2026-05-22",
        unit: "Legacy",
        objective: "",
        activity: ""
      }
    ];

    const validated = validateDatabasePayload(payload);
    expect(validated.lessonPlans).toBeUndefined();
  });

  it("accepts schema 6 backups without student follow-up rows", () => {
    const payload = validPayload();
    payload.schemaVersion = 6;
    delete (payload.tables as Record<string, unknown[]>).studentFollowUps;

    const validated = validateDatabasePayload(payload);
    expect(validated.studentFollowUps).toEqual([]);
  });

  it("rejects student follow-up rows for another class", () => {
    const payload = validPayload({
      classGroups: [
        { id: "class-1", name: "1 ESO A", level: "ESO", schoolYear: "2025-2026" },
        { id: "class-2", name: "1 ESO B", level: "ESO", schoolYear: "2025-2026" }
      ],
      studentFollowUps: [
        {
          id: "follow-up-1",
          studentId: "student-1",
          classId: "class-2",
          date: "2026-05-22",
          kind: "tutorial",
          title: "Meeting",
          notes: "Notes",
          resolved: false
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/fuera del curso/i);
  });

  it("rejects assessment competency values that are not text", () => {
    const payload = validPayload({
      assessments: [
        {
          id: "assessment-1",
          classId: "class-1",
          subjectId: "subject-1",
          title: "Exam",
          weight: 1,
          period: "Term 1",
          competency: 3
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/competency/);
  });

  it("rejects student email values that are not text", () => {
    const payload = validPayload({
      students: [
        {
          id: "student-1",
          classId: "class-1",
          firstName: "Ana",
          lastName: "Lopez",
          fullName: "Ana Lopez",
          email: 123
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/email/);
  });

  it("rejects student photo data URLs that are not supported images", () => {
    const payload = validPayload({
      students: [
        {
          id: "student-1",
          classId: "class-1",
          firstName: "Ana",
          lastName: "Lopez",
          fullName: "Ana Lopez",
          photoDataUrl: "data:text/html;base64,PGgxPk5vPC9oMT4="
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/photoDataUrl/);
  });

  it("rejects oversized student photo data URLs in backups", () => {
    const payload = validPayload({
      students: [
        {
          id: "student-1",
          classId: "class-1",
          firstName: "Ana",
          lastName: "Lopez",
          fullName: "Ana Lopez",
          photoDataUrl: `data:image/jpeg;base64,${"A".repeat(1_500_001)}`
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/demasiado grande/);
  });

  it("rejects attendance rows with invalid status values", () => {
    const payload = validPayload({
      attendanceEntries: [
        {
          id: "attendance-1",
          classId: "class-1",
          studentId: "student-1",
          date: "2026-05-22",
          scheduleSlotId: "slot-1",
          status: "unknown"
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/status/);
  });

  it("rejects attendance rows with malformed dates", () => {
    const payload = validPayload({
      attendanceEntries: [
        {
          id: "attendance-1",
          classId: "class-1",
          studentId: "student-1",
          date: "22/05/2026",
          scheduleSlotId: "slot-1",
          status: "present"
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/fecha/i);
  });

  it("rejects attendance rows that reference unknown schedule slots", () => {
    const payload = validPayload({
      attendanceEntries: [
        {
          id: "attendance-1",
          classId: "class-1",
          studentId: "student-1",
          date: "2026-05-22",
          scheduleSlotId: "missing-slot",
          status: "present"
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/scheduleSlotId/);
  });

  it("rejects malformed rubric criteria in backup templates", () => {
    const payload = validPayload({
      rubricTemplates: [
        {
          id: "rubric-1",
          classId: "class-1",
          taskId: "task-1",
          name: "Rubrica",
          criteria: [
            {
              id: "criterion-1",
              name: "Criterio",
              levels: [
                { id: "level-1", name: "Nivel alto", score: "alto" },
                { id: "level-2", name: "Nivel bajo", score: 1 }
              ]
            }
          ]
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/score/);
  });

  it("rejects rubric templates with fewer than two levels", () => {
    const payload = validPayload({
      rubricTemplates: [
        {
          id: "rubric-1",
          classId: "class-1",
          taskId: "task-1",
          name: "Rubrica",
          criteria: [
            {
              id: "criterion-1",
              name: "Criterio",
              levels: [{ id: "level-1", name: "Nivel", score: 1 }]
            }
          ]
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/dos niveles/);
  });

  it("rejects malformed checklist items in backup templates", () => {
    const payload = validPayload({
      checklistTemplates: [
        {
          id: "checklist-1",
          classId: "class-1",
          taskId: "task-1",
          name: "Lista",
          items: [{ id: "item-1", text: 3 }]
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/text/);
  });

  it("rejects checklist templates without items", () => {
    const payload = validPayload({
      checklistTemplates: [
        {
          id: "checklist-1",
          classId: "class-1",
          taskId: "task-1",
          name: "Lista",
          items: []
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/sin items/);
  });

  it("rejects task gradebook configs with more than one evaluation method", () => {
    const payload = validPayload({
      taskGradebookConfigs: [
        {
          id: "config-1",
          taskId: "task-1",
          subjectId: "subject-1",
          classId: "class-1",
          gradebookWeight: 1,
          rubricTemplateId: "rubric-1",
          checklistTemplateId: "checklist-1"
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/mas de un metodo/i);
  });

  it("rejects daily evaluation settings with rubric and checklist at once", () => {
    const payload = validPayload({
      taskDailyEvaluationSettings: [
        {
          id: "setting-1",
          taskId: "task-1",
          date: "2026-05-22",
          scheduleSlotId: "slot-1",
          rubricTemplateId: "rubric-1",
          checklistTemplateId: "checklist-1"
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/rubrica y lista/i);
  });

  it("rejects subject schedule slots that do not exist in the schedule", () => {
    const payload = validPayload({
      subjects: [{ id: "subject-1", name: "Matematicas", scheduleSlotIds: ["missing-slot"] }]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/scheduleSlotIds/i);
  });

  it("rejects duplicate schedule block ids", () => {
    const payload = validPayload({
      scheduleDays: [
        {
          id: "day-1",
          dayOfWeek: 1,
          dayName: "Lunes",
          enabled: true,
          blocks: [
            { id: "slot-1", startTime: "09:00", endTime: "10:00" },
            { id: "slot-1", startTime: "10:00", endTime: "11:00" }
          ]
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/duplicados/i);
  });

  it("rejects invalid schedule block times", () => {
    const payload = validPayload({
      scheduleDays: [
        {
          id: "day-1",
          dayOfWeek: 1,
          dayName: "Lunes",
          enabled: true,
          blocks: [{ id: "slot-1", startTime: "10:00", endTime: "09:00" }]
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/hora de fin/i);
  });

  it("rejects overlapping schedule blocks in the same day", () => {
    const payload = validPayload({
      scheduleDays: [
        {
          id: "day-1",
          dayOfWeek: 1,
          dayName: "Lunes",
          enabled: true,
          blocks: [
            { id: "slot-1", startTime: "09:00", endTime: "10:00" },
            { id: "slot-2", startTime: "09:30", endTime: "10:30" }
          ]
        }
      ],
      subjects: [{ id: "subject-1", name: "Matematicas", scheduleSlotIds: ["slot-1", "slot-2"] }],
      taskSessions: [
        {
          id: "session-1",
          taskId: "task-1",
          subjectId: "subject-1",
          classId: "class-1",
          date: "2026-05-22",
          scheduleSlotId: "slot-1"
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/solapados/i);
  });

  it("rejects duplicated schedule weekdays", () => {
    const payload = validPayload({
      scheduleDays: [
        {
          id: "day-1",
          dayOfWeek: 1,
          dayName: "Lunes",
          enabled: true,
          blocks: [{ id: "slot-1", startTime: "09:00", endTime: "10:00" }]
        },
        {
          id: "day-2",
          dayOfWeek: 1,
          dayName: "Otro lunes",
          enabled: true,
          blocks: []
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/dias de la semana duplicados/i);
  });

  it("rejects schedule days outside the supported weekday range", () => {
    const payload = validPayload({
      scheduleDays: [
        {
          id: "day-1",
          dayOfWeek: 9,
          dayName: "Día inválido",
          enabled: true,
          blocks: [{ id: "slot-1", startTime: "09:00", endTime: "10:00" }]
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/1-7/i);
  });

  it("rejects impossible calendar dates in dated rows", () => {
    const payload = validPayload({
      taskSessions: [
        {
          id: "session-1",
          taskId: "task-1",
          subjectId: "subject-1",
          classId: "class-1",
          date: "2026-02-31",
          scheduleSlotId: "slot-1"
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/fecha inexistente/i);
  });

  it("rejects schedule settings outside the supported block duration range", () => {
    const payload = validPayload({
      scheduleSettings: [
        {
          id: "default",
          defaultBlockDurationMinutes: 5
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/15-240/i);
  });

  it("rejects tasks with fewer than one planned session", () => {
    const payload = validPayload({
      tasks: [{ id: "task-1", title: "Tarea", description: "", sessionCount: 0, sendToGradebook: true }]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/sessionCount.*1/i);
  });

  it("rejects unit blocks with invalid numeric ranges", () => {
    const payload = validPayload({
      unitBlocks: [
        {
          id: "unit-1",
          subjectId: "subject-1",
          name: "Unit",
          description: "",
          sessionCount: -1,
          position: 0
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/sessionCount.*1/i);
  });

  it("rejects negative gradebook weights in backups", () => {
    const payload = validPayload({
      assessments: [
        {
          id: "assessment-1",
          classId: "class-1",
          subjectId: "subject-1",
          title: "Exam",
          weight: -1,
          period: ""
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/weight.*0/i);
  });

  it("rejects task comments for a student outside the session class", () => {
    const payload = validPayload({
      classGroups: [
        { id: "class-1", name: "1 ESO A", level: "ESO", schoolYear: "2025-2026" },
        { id: "class-2", name: "1 ESO B", level: "ESO", schoolYear: "2025-2026" }
      ],
      students: [
        {
          id: "student-1",
          classId: "class-2",
          firstName: "Ana",
          lastName: "Lopez",
          fullName: "Ana Lopez"
        }
      ],
      subjectCourseLinks: [
        { id: "subject-course-1", subjectId: "subject-1", classId: "class-1" },
        { id: "subject-course-2", subjectId: "subject-1", classId: "class-2" }
      ],
      taskStudentComments: [
        {
          id: "comment-1",
          taskId: "task-1",
          date: "2026-05-22",
          scheduleSlotId: "slot-1",
          studentId: "student-1",
          comment: "Fuera de grupo"
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/fuera del curso/i);
  });

  it("rejects task student comments that are not text", () => {
    const payload = validPayload({
      taskStudentComments: [
        {
          id: "comment-1",
          taskId: "task-1",
          subjectId: "subject-1",
          classId: "class-1",
          date: "2026-05-22",
          scheduleSlotId: "slot-1",
          studentId: "student-1",
          comment: 3
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/comment/);
  });

  it("rejects daily evaluation general comments that are not text", () => {
    const payload = validPayload({
      taskDailyEvaluationSettings: [
        {
          id: "setting-1",
          taskId: "task-1",
          subjectId: "subject-1",
          classId: "class-1",
          date: "2026-05-22",
          scheduleSlotId: "slot-1",
          generalComment: 3
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/generalComment/);
  });

  it("accepts scoped task session data when the same task shares date and slot in another class", () => {
    const payload = validPayload({
      classGroups: [
        { id: "class-1", name: "1 ESO A", level: "ESO", schoolYear: "2025-2026" },
        { id: "class-2", name: "1 ESO B", level: "ESO", schoolYear: "2025-2026" }
      ],
      students: [
        {
          id: "student-1",
          classId: "class-1",
          firstName: "Ana",
          lastName: "Lopez",
          fullName: "Ana Lopez"
        },
        {
          id: "student-2",
          classId: "class-2",
          firstName: "Luis",
          lastName: "Diaz",
          fullName: "Luis Diaz"
        }
      ],
      subjects: [
        { id: "subject-1", name: "Matematicas", scheduleSlotIds: ["slot-1"] },
        { id: "subject-2", name: "Lengua", scheduleSlotIds: ["slot-1"] }
      ],
      subjectCourseLinks: [
        { id: "subject-course-1", subjectId: "subject-1", classId: "class-1" },
        { id: "subject-course-2", subjectId: "subject-2", classId: "class-2" }
      ],
      subjectStudentLinks: [
        { id: "subject-student-1", subjectId: "subject-1", studentId: "student-1" },
        { id: "subject-student-2", subjectId: "subject-2", studentId: "student-2" }
      ],
      taskSubjectLinks: [
        { id: "task-subject-1", taskId: "task-1", subjectId: "subject-1" },
        { id: "task-subject-2", taskId: "task-1", subjectId: "subject-2" }
      ],
      taskSessions: [
        {
          id: "session-1",
          taskId: "task-1",
          subjectId: "subject-1",
          classId: "class-1",
          date: "2026-05-22",
          scheduleSlotId: "slot-1"
        },
        {
          id: "session-2",
          taskId: "task-1",
          subjectId: "subject-2",
          classId: "class-2",
          date: "2026-05-22",
          scheduleSlotId: "slot-1"
        }
      ],
      taskDailyEvaluationSettings: [
        {
          id: "setting-1",
          taskId: "task-1",
          subjectId: "subject-2",
          classId: "class-2",
          date: "2026-05-22",
          scheduleSlotId: "slot-1"
        }
      ],
      taskStudentComments: [
        {
          id: "comment-1",
          taskId: "task-1",
          subjectId: "subject-2",
          classId: "class-2",
          date: "2026-05-22",
          scheduleSlotId: "slot-1",
          studentId: "student-2",
          comment: "Comentario correcto"
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).not.toThrow();
  });

  it("rejects scoped task comments that point to a different class session", () => {
    const payload = validPayload({
      taskStudentComments: [
        {
          id: "comment-1",
          taskId: "task-1",
          subjectId: "subject-1",
          classId: "class-missing",
          date: "2026-05-22",
          scheduleSlotId: "slot-1",
          studentId: "student-1",
          comment: "Sesion incorrecta"
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/classId/i);
  });

  it("accepts manual grade observations without numeric grades", () => {
    const payload = validPayload({
      assessments: [
        {
          id: "assessment-1",
          classId: "class-1",
          subjectId: "subject-1",
          title: "Exam",
          weight: 1,
          period: ""
        }
      ],
      gradeEntries: [
        {
          id: "entry-1",
          classId: "class-1",
          assessmentId: "assessment-1",
          studentId: "student-1",
          comment: "Needs review"
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).not.toThrow();
  });

  it("rejects manual grade entries outside the 0 to 10 range", () => {
    const payload = validPayload({
      assessments: [
        {
          id: "assessment-1",
          classId: "class-1",
          subjectId: "subject-1",
          title: "Exam",
          weight: 1,
          period: ""
        }
      ],
      gradeEntries: [
        {
          id: "entry-1",
          classId: "class-1",
          assessmentId: "assessment-1",
          studentId: "student-1",
          numericValue: 12
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/0-10/i);
  });

  it("rejects duplicate manual grade entries for the same assessment and student", () => {
    const payload = validPayload({
      assessments: [
        {
          id: "assessment-1",
          classId: "class-1",
          subjectId: "subject-1",
          title: "Exam",
          weight: 1,
          period: ""
        }
      ],
      gradeEntries: [
        {
          id: "entry-1",
          classId: "class-1",
          assessmentId: "assessment-1",
          studentId: "student-1",
          numericValue: 6
        },
        {
          id: "entry-2",
          classId: "class-1",
          assessmentId: "assessment-1",
          studentId: "student-1",
          numericValue: 8
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/filas duplicadas.*assessmentId\+studentId/i);
  });

  it("rejects duplicate attendance entries for the same student session", () => {
    const payload = validPayload({
      attendanceEntries: [
        {
          id: "attendance-1",
          classId: "class-1",
          studentId: "student-1",
          date: "2026-05-22",
          scheduleSlotId: "slot-1",
          status: "present"
        },
        {
          id: "attendance-2",
          classId: "class-1",
          studentId: "student-1",
          date: "2026-05-22",
          scheduleSlotId: "slot-1",
          status: "absent"
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/filas duplicadas.*classId\+studentId\+date\+scheduleSlotId/i);
  });

  it("rejects duplicate direct task grades for the same task subject class and student", () => {
    const payload = validPayload({
      taskDirectGrades: [
        {
          id: "direct-1",
          taskId: "task-1",
          subjectId: "subject-1",
          classId: "class-1",
          studentId: "student-1",
          score: 6
        },
        {
          id: "direct-2",
          taskId: "task-1",
          subjectId: "subject-1",
          classId: "class-1",
          studentId: "student-1",
          score: 9
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/filas duplicadas.*taskId\+subjectId\+classId\+studentId/i);
  });

  it("rejects task sessions that collide in the same class schedule slot", () => {
    const payload = validPayload({
      tasks: [
        { id: "task-1", title: "Tarea 1", description: "", sessionCount: 1, sendToGradebook: true },
        { id: "task-2", title: "Tarea 2", description: "", sessionCount: 1, sendToGradebook: true }
      ],
      taskSubjectLinks: [
        { id: "task-subject-1", taskId: "task-1", subjectId: "subject-1" },
        { id: "task-subject-2", taskId: "task-2", subjectId: "subject-1" }
      ],
      taskSessions: [
        {
          id: "session-1",
          taskId: "task-1",
          subjectId: "subject-1",
          classId: "class-1",
          date: "2026-05-22",
          scheduleSlotId: "slot-1"
        },
        {
          id: "session-2",
          taskId: "task-2",
          subjectId: "subject-1",
          classId: "class-1",
          date: "2026-05-22",
          scheduleSlotId: "slot-1"
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/filas duplicadas.*classId\+date\+scheduleSlotId/i);
  });

  it("rejects duplicate rubric rows for the same criterion in a task session", () => {
    const payload = validPayload({
      taskRubricAssessments: [
        {
          id: "rubric-row-1",
          taskId: "task-1",
          subjectId: "subject-1",
          classId: "class-1",
          date: "2026-05-22",
          scheduleSlotId: "slot-1",
          studentId: "student-1",
          rubricTemplateId: "rubric-1",
          criterionId: "criterion-1",
          levelId: "level-1",
          score: 2
        },
        {
          id: "rubric-row-2",
          taskId: "task-1",
          subjectId: "subject-1",
          classId: "class-1",
          date: "2026-05-22",
          scheduleSlotId: "slot-1",
          studentId: "student-1",
          rubricTemplateId: "rubric-1",
          criterionId: "criterion-1",
          levelId: "level-2",
          score: 1
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/filas duplicadas.*criterionId/i);
  });

  it("rejects direct grades outside the 0 to 10 range", () => {
    const payload = validPayload({
      taskDirectGrades: [
        {
          id: "direct-1",
          taskId: "task-1",
          subjectId: "subject-1",
          classId: "class-1",
          studentId: "student-1",
          score: 12
        }
      ]
    });

    expect(() => validateDatabasePayload(payload)).toThrow(/0-10/i);
  });
});
