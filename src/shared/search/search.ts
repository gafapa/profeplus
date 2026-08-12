import type {
  Assessment,
  ClassGroup,
  FamilyContact,
  ResourceAttachment,
  Student,
  StudentFollowUp,
  Subject,
  SubjectCourseLink,
  Task,
  TaskSubjectLink
} from "../db/types";

export type SearchResultKind = "student" | "task" | "assessment" | "followUp" | "familyContact" | "resource";

export type SearchResult = {
  id: string;
  kind: SearchResultKind;
  title: string;
  context: string;
  snippet: string;
  href: string;
  classId?: string;
  subjectId?: string;
};

export type SearchData = {
  students: Student[];
  classGroups: ClassGroup[];
  subjects: Subject[];
  tasks: Task[];
  taskSubjectLinks: TaskSubjectLink[];
  subjectCourseLinks: SubjectCourseLink[];
  assessments: Assessment[];
  followUps: StudentFollowUp[];
  familyContacts: FamilyContact[];
  resources: ResourceAttachment[];
};

function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

function matchesQuery(query: string, ...values: Array<string | undefined>): boolean {
  return values.some((value) => normalizeSearchText(value ?? "").includes(query));
}

function snippet(value: string | undefined, fallback: string): string {
  const text = value?.trim() || fallback;
  return text.length > 150 ? `${text.slice(0, 147)}…` : text;
}

export function searchResultKindLabel(kind: SearchResultKind): string {
  switch (kind) {
    case "student": return "Alumno";
    case "task": return "Tarea";
    case "assessment": return "Prueba";
    case "followUp": return "Seguimiento";
    case "familyContact": return "Familia";
    case "resource": return "Recurso";
  }
}

export function buildSearchResults(data: SearchData, rawQuery: string): SearchResult[] {
  const query = normalizeSearchText(rawQuery);
  if (query.length < 2) return [];
  const classById = new Map(data.classGroups.map((item) => [item.id, item]));
  const studentById = new Map(data.students.map((item) => [item.id, item]));
  const subjectById = new Map(data.subjects.map((item) => [item.id, item]));
  const taskById = new Map(data.tasks.map((item) => [item.id, item]));
  const taskLinkByTaskId = new Map<string, TaskSubjectLink>();
  for (const link of data.taskSubjectLinks) if (!taskLinkByTaskId.has(link.taskId)) taskLinkByTaskId.set(link.taskId, link);
  const classIdBySubjectId = new Map(data.subjectCourseLinks.map((item) => [item.subjectId, item.classId]));
  const results: SearchResult[] = [];

  for (const student of data.students) {
    if (!matchesQuery(query, student.fullName, student.firstName, student.lastName, student.email, student.comments)) continue;
    results.push({
      id: `student:${student.id}`,
      kind: "student",
      title: student.fullName,
      context: classById.get(student.classId)?.name ?? "Curso desconocido",
      snippet: snippet(student.comments || student.email, "Ficha del alumno"),
      href: `/management/students?studentId=${encodeURIComponent(student.id)}`,
      classId: student.classId
    });
  }

  for (const task of data.tasks) {
    const link = taskLinkByTaskId.get(task.id);
    const subject = link ? subjectById.get(link.subjectId) : undefined;
    if (!matchesQuery(query, task.title, task.description, subject?.name)) continue;
    results.push({
      id: `task:${task.id}`,
      kind: "task",
      title: task.title,
      context: subject?.name ?? "Sin asignatura",
      snippet: snippet(task.description, `${task.sessionCount} sesiones`),
      href: `/management/tasks?taskId=${encodeURIComponent(task.id)}`,
      classId: link ? classIdBySubjectId.get(link.subjectId) : undefined,
      subjectId: link?.subjectId
    });
  }

  for (const assessment of data.assessments) {
    const subject = subjectById.get(assessment.subjectId);
    if (!matchesQuery(query, assessment.title, assessment.competency, assessment.period, subject?.name)) continue;
    results.push({
      id: `assessment:${assessment.id}`,
      kind: "assessment",
      title: assessment.title,
      context: `${subject?.name ?? "Asignatura desconocida"} · ${classById.get(assessment.classId)?.name ?? "Curso desconocido"}`,
      snippet: snippet(assessment.competency, assessment.period || "Prueba manual"),
      href: "/gradebook",
      classId: assessment.classId,
      subjectId: assessment.subjectId
    });
  }

  for (const followUp of data.followUps) {
    const student = studentById.get(followUp.studentId);
    if (!matchesQuery(query, followUp.title, followUp.notes, followUp.nextStep, followUp.responsiblePerson, student?.fullName)) continue;
    results.push({
      id: `follow-up:${followUp.id}`,
      kind: "followUp",
      title: followUp.title,
      context: `${student?.fullName ?? "Alumno desconocido"} · ${followUp.date}`,
      snippet: snippet(followUp.notes, "Seguimiento tutorial"),
      href: `/management/students?studentId=${encodeURIComponent(followUp.studentId)}`,
      classId: followUp.classId
    });
  }

  for (const contact of data.familyContacts) {
    const student = studentById.get(contact.studentId);
    if (!matchesQuery(query, contact.contactName, contact.relationship, contact.summary, contact.agreements, contact.nextStep, student?.fullName)) continue;
    results.push({
      id: `family-contact:${contact.id}`,
      kind: "familyContact",
      title: contact.contactName,
      context: `${student?.fullName ?? "Alumno desconocido"} · ${contact.date}`,
      snippet: snippet(contact.summary, "Contacto familiar"),
      href: `/management/students?studentId=${encodeURIComponent(contact.studentId)}`,
      classId: contact.classId
    });
  }

  for (const resource of data.resources) {
    const student = resource.ownerType === "student" ? studentById.get(resource.ownerId) : undefined;
    const task = resource.ownerType === "task" ? taskById.get(resource.ownerId) : undefined;
    const link = task ? taskLinkByTaskId.get(task.id) : undefined;
    if (!matchesQuery(query, resource.title, resource.fileName, resource.url, student?.fullName, task?.title)) continue;
    results.push({
      id: `resource:${resource.id}`,
      kind: "resource",
      title: resource.title,
      context: student?.fullName ?? task?.title ?? "Propietario desconocido",
      snippet: snippet(resource.fileName || resource.url, resource.kind === "file" ? "Archivo local" : "Enlace web"),
      href: student
        ? `/management/students?studentId=${encodeURIComponent(student.id)}`
        : `/management/tasks?taskId=${encodeURIComponent(resource.ownerId)}`,
      classId: student?.classId ?? (link ? classIdBySubjectId.get(link.subjectId) : undefined),
      subjectId: link?.subjectId
    });
  }

  return results.sort((left, right) => left.title.localeCompare(right.title) || left.kind.localeCompare(right.kind)).slice(0, 100);
}
