import type {
  ClassGroup,
  ScheduleDay,
  Student,
  Subject,
  SubjectCourseLink
} from "../db/types";

export type OnboardingChecklistItem = {
  id: "course" | "students" | "schedule" | "subjects";
  label: string;
  shortLabel: string;
  description: string;
  benefit: string;
  completionHint: string;
  route: string;
  complete: boolean;
};

type BuildOnboardingChecklistInput = {
  courses: ClassGroup[];
  students: Student[];
  scheduleDays: ScheduleDay[];
  subjects: Subject[];
  subjectCourseLinks: SubjectCourseLink[];
};

export function buildOnboardingChecklist({
  courses,
  students,
  scheduleDays,
  subjects,
  subjectCourseLinks
}: BuildOnboardingChecklistInput): OnboardingChecklistItem[] {
  const activeSlotIds = new Set(
    scheduleDays.flatMap((day) =>
      day.enabled ? day.blocks.filter((block) => !block.isBreak).map((block) => block.id) : []
    )
  );
  const linkedSubjectIds = new Set(subjectCourseLinks.map((link) => link.subjectId));
  const configuredSubjectExists = subjects.some(
    (subject) =>
      linkedSubjectIds.has(subject.id) &&
      subject.scheduleSlotIds.some((slotId) => activeSlotIds.has(slotId))
  );

  return [
    {
      id: "course",
      label: "Crear tu primer grupo",
      shortLabel: "Grupo",
      description: "Define el grupo con el que vas a trabajar y su curso escolar.",
      benefit: "Será el contexto común para alumnado, asignaturas y registros.",
      completionHint: "El paso se completa al guardar un grupo.",
      route: "/management/courses",
      complete: courses.length > 0
    },
    {
      id: "students",
      label: "Incorporar alumnado",
      shortLabel: "Alumnado",
      description: "Añade manualmente o importa al menos un alumno en el grupo.",
      benefit: "Podrás pasar lista, evaluar y hacer seguimiento individual.",
      completionHint: "El paso se completa cuando un alumno pertenece a un grupo.",
      route: "/management/students",
      complete: students.some((student) => courses.some((course) => course.id === student.classId))
    },
    {
      id: "schedule",
      label: "Dibujar tu horario",
      shortLabel: "Horario",
      description: "Activa al menos una franja lectiva de tu semana.",
      benefit: "ProfePlus sabrá qué clase toca y cuándo debe mostrarla en Hoy.",
      completionHint: "El paso se completa al guardar una franja lectiva activa.",
      route: "/management/schedule",
      complete: activeSlotIds.size > 0
    },
    {
      id: "subjects",
      label: "Conectar las asignaturas",
      shortLabel: "Asignaturas",
      description: "Asocia una asignatura al grupo y a una franja activa.",
      benefit: "Une el horario con tu trabajo diario, tareas y cuaderno.",
      completionHint: "El paso se completa al vincular grupo, asignatura y horario.",
      route: "/management/subjects",
      complete: configuredSubjectExists
    }
  ];
}
