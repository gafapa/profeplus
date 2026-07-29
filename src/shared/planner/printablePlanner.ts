import type { PrintableReport } from "../reports/printableReports";

export type PrintablePlannerSession = {
  date: string;
  dayName: string;
  time: string;
  className: string;
  subjectName: string;
  taskTitle: string;
  unitName?: string;
  statusLabel: string;
  objectives?: string;
  competencies?: string;
  materials?: string;
  homework?: string;
  teacherNotes?: string;
};

export type PrintablePlannerInput = {
  className: string;
  subjectName?: string;
  weekRange: string;
  generatedAt: string;
  visibleSlotsCount: number;
  unplannedCount: number;
  sessions: PrintablePlannerSession[];
};

function clean(value: string | undefined): string {
  return value?.trim() || "-";
}

export function buildPrintablePlannerReport(input: PrintablePlannerInput): PrintableReport {
  const orderedSessions = [...input.sessions].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.time.localeCompare(b.time) ||
      a.subjectName.localeCompare(b.subjectName) ||
      a.taskTitle.localeCompare(b.taskTitle)
  );

  return {
    title: `Planificador semanal - ${input.className}`,
    generatedAt: input.generatedAt,
    summary: [
      { label: "Semana", value: input.weekRange },
      { label: "Filtro", value: input.subjectName || "Todas las asignaturas" },
      { label: "Sesiones", value: String(orderedSessions.length) },
      { label: "Pendientes", value: String(input.unplannedCount) }
    ],
    tables: [
      {
        title: "Resumen semanal",
        headers: ["Día", "Hora", "Asignatura", "Tarea", "Unidad", "Estado"],
        rows: orderedSessions.map((session) => [
          `${session.dayName} ${session.date}`,
          session.time,
          session.subjectName,
          session.taskTitle,
          clean(session.unitName),
          session.statusLabel
        ])
      },
      {
        title: "Plan didáctico",
        headers: ["Día", "Hora", "Tarea", "Objetivos", "Competencias / saberes", "Materiales", "Deberes", "Notas docentes"],
        rows: orderedSessions.map((session) => [
          `${session.dayName} ${session.date}`,
          session.time,
          session.taskTitle,
          clean(session.objectives),
          clean(session.competencies),
          clean(session.materials),
          clean(session.homework),
          clean(session.teacherNotes)
        ])
      }
    ],
    sections: [
      {
        title: "Control de planificación",
        summary: [
          { label: "Clases visibles", value: String(input.visibleSlotsCount) },
          { label: "Sesiones programadas", value: String(orderedSessions.length) },
          { label: "Sesiones por planificar", value: String(input.unplannedCount) }
        ]
      }
    ]
  };
}
