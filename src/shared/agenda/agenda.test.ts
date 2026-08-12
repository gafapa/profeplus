import { describe, expect, it } from "vitest";
import { buildAgendaIcs, buildAgendaItems, type AgendaSource } from "./agenda";

function source(overrides: Partial<AgendaSource> = {}): AgendaSource {
  return {
    today: "2026-08-12",
    horizonDays: 30,
    classGroups: [{ id: "class-1", name: "2º ESO A", level: "2º ESO", schoolYear: "2026-2027" }],
    students: [
      {
        id: "student-1",
        classId: "class-1",
        firstName: "Ana",
        lastName: "López",
        fullName: "Ana López"
      }
    ],
    subjects: [{ id: "subject-1", name: "Lengua", scheduleSlotIds: [] }],
    tasks: [{ id: "task-1", title: "Reseña", description: "", sessionCount: 1, sendToGradebook: true }],
    followUps: [],
    familyContacts: [],
    taskSessions: [],
    academicPeriods: [],
    assessments: [],
    ...overrides
  };
}

describe("agenda", () => {
  it("combines actionable records and sorts them by date and priority", () => {
    const items = buildAgendaItems(
      source({
        followUps: [
          {
            id: "follow-up-1",
            studentId: "student-1",
            classId: "class-1",
            date: "2026-08-01",
            dueDate: "2026-08-12",
            kind: "tutorial",
            title: "Revisar adaptación",
            notes: "",
            priority: "high",
            status: "open",
            resolved: false
          }
        ],
        familyContacts: [
          {
            id: "contact-1",
            studentId: "student-1",
            classId: "class-1",
            date: "2026-08-01",
            dueDate: "2026-08-11",
            channel: "email",
            contactName: "Familia",
            relationship: "Madre",
            summary: "",
            nextStep: "Enviar acuerdos",
            createdAt: "2026-08-01T10:00:00.000Z",
            updatedAt: "2026-08-01T10:00:00.000Z"
          }
        ],
        taskSessions: [
          {
            id: "session-1",
            taskId: "task-1",
            subjectId: "subject-1",
            classId: "class-1",
            date: "2026-08-13",
            scheduleSlotId: "slot-1",
            status: "planned"
          }
        ]
      })
    );

    expect(items.map((item) => item.kind)).toEqual(["familyContact", "followUp", "taskSession"]);
    expect(items[0]?.urgency).toBe("overdue");
    expect(items[1]?.urgency).toBe("today");
    expect(items[2]?.route).toContain("classId=class-1");
  });

  it("excludes completed, cancelled, undated, and out-of-range records", () => {
    const items = buildAgendaItems(
      source({
        followUps: [
          {
            id: "done",
            studentId: "student-1",
            classId: "class-1",
            date: "2026-08-01",
            dueDate: "2026-08-10",
            kind: "tutorial",
            title: "Done",
            notes: "",
            status: "done",
            resolved: true
          },
          {
            id: "undated",
            studentId: "student-1",
            classId: "class-1",
            date: "2026-08-01",
            kind: "tutorial",
            title: "Undated",
            notes: "",
            status: "open",
            resolved: false
          }
        ],
        taskSessions: [
          {
            id: "cancelled",
            taskId: "task-1",
            subjectId: "subject-1",
            classId: "class-1",
            date: "2026-08-13",
            scheduleSlotId: "slot-1",
            status: "cancelled"
          },
          {
            id: "distant",
            taskId: "task-1",
            subjectId: "subject-1",
            classId: "class-1",
            date: "2026-10-13",
            scheduleSlotId: "slot-2",
            status: "planned"
          }
        ]
      })
    );

    expect(items).toEqual([]);
  });

  it("includes open period endings and upcoming dated assessments", () => {
    const items = buildAgendaItems(
      source({
        academicPeriods: [
          {
            id: "period-1",
            classId: "class-1",
            name: "Primera evaluación",
            startDate: "2026-09-01",
            endDate: "2026-09-10",
            position: 0,
            status: "open",
            createdAt: "2026-08-01T10:00:00.000Z",
            updatedAt: "2026-08-01T10:00:00.000Z",
            closureVersion: 0
          }
        ],
        assessments: [
          {
            id: "assessment-1",
            classId: "class-1",
            subjectId: "subject-1",
            assessmentDate: "2026-08-20",
            title: "Comentario de texto",
            weight: 20,
            period: "Primera evaluación"
          }
        ]
      })
    );

    expect(items.map((item) => item.kind)).toEqual(["assessment", "academicPeriod"]);
  });

  it("keeps only the latest family contact action for each student", () => {
    const contact = {
      studentId: "student-1",
      classId: "class-1",
      dueDate: "2026-08-20",
      channel: "email" as const,
      contactName: "Familia",
      relationship: "Madre",
      summary: "",
      nextStep: "Enviar acuerdos",
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z"
    };
    const items = buildAgendaItems(
      source({
        familyContacts: [
          { ...contact, id: "old", date: "2026-08-01" },
          { ...contact, id: "latest", date: "2026-08-10", nextStep: "Confirmar la reunión" }
        ]
      })
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.sourceId).toBe("latest");
  });

  it("exports safe all-day calendar events", () => {
    const [item] = buildAgendaItems(
      source({
        followUps: [
          {
            id: "follow-up-1",
            studentId: "student-1",
            classId: "class-1",
            date: "2026-08-01",
            dueDate: "2026-08-12",
            kind: "tutorial",
            title: "Familia, acuerdos; revisión",
            notes: "",
            nextStep: "Línea 1\nLínea 2",
            status: "open",
            resolved: false
          }
        ]
      })
    );

    const calendar = buildAgendaIcs([item], new Date("2026-08-12T10:11:12.000Z"));

    expect(calendar).toContain("DTSTART;VALUE=DATE:20260812");
    expect(calendar).toContain("DTEND;VALUE=DATE:20260813");
    expect(calendar).toContain("DTSTAMP:20260812T101112Z");
    expect(calendar).toContain("SUMMARY:Seguimiento: Familia\\, acuerdos\\; revisión");
    expect(calendar.endsWith("\r\n")).toBe(true);
  });

  it("folds long calendar lines without breaking Unicode characters", () => {
    const item = {
      id: "long",
      sourceId: "long",
      kind: "followUp" as const,
      date: "2026-08-12",
      urgency: "today" as const,
      title: `Seguimiento ${"á".repeat(80)}`,
      detail: "Detalle",
      classId: "class-1",
      route: "/management/tutor",
      priority: 1
    };

    const calendar = buildAgendaIcs([item], new Date("2026-08-12T10:11:12.000Z"));

    expect(calendar).toContain("\r\n ");
    expect(calendar).not.toContain("�");
  });
});
