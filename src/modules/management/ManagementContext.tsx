import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { db } from "../../shared/db/database";
import type {
  ClassGroup,
  ScheduleDay,
  ScheduleSettings,
  Student,
  Subject,
  UnitBlock,
  SubjectCourseLink,
  SubjectStudentLink,
  TaskGradebookConfig,
  TaskSubjectLink,
  Task
} from "../../shared/db/types";
import { compareStudentsByField } from "../../shared/utils/student";
import { completeScheduleDays, defaultScheduleDays } from "../../shared/schedule/weekDays";
import { useAppSelector } from "../../app/hooks";

export type EnrollmentRow = {
  student: Student;
  courseName: string;
  derivedIncluded: boolean;
  effectiveIncluded: boolean;
};

type ManagementContextValue = {
  courses: ClassGroup[];
  students: Student[];
  subjects: Subject[];
  units: UnitBlock[];
  scheduleDays: ScheduleDay[];
  scheduleSettings: ScheduleSettings;
  subjectCourseLinks: SubjectCourseLink[];
  taskSubjectLinks: TaskSubjectLink[];
  allTasks: Task[];
  notice: string;
  isBusy: boolean;
  setNotice: (value: string) => void;
  refreshAll: () => Promise<void>;
  createCourse: (name: string, schoolYear: string, comments?: string) => Promise<void>;
  createEmptyCourse: () => Promise<string | null>;
  updateCourse: (courseId: string, name: string, schoolYear: string, comments?: string) => Promise<void>;
  deleteCourse: (courseId: string) => Promise<void>;
  createStudent: (
    firstName: string,
    lastName: string,
    courseId: string,
    photoDataUrl?: string,
    comments?: string,
    email?: string,
    hasAcs?: boolean,
    hasReinforcement?: boolean
  ) => Promise<void>;
  createEmptyStudent: (courseId?: string) => Promise<string | null>;
  updateStudent: (
    studentId: string,
    firstName: string,
    lastName: string,
    courseId: string,
    photoDataUrl?: string,
    comments?: string,
    email?: string,
    hasAcs?: boolean,
    hasReinforcement?: boolean
  ) => Promise<void>;
  addStudentToCourse: (studentId: string, courseId: string) => Promise<void>;
  removeStudentFromCourse: (studentId: string, courseId: string) => Promise<void>;
  deleteStudent: (studentId: string) => Promise<void>;
  createSubject: (
    name: string,
    teachingHours: string,
    scheduleSlotIds: string[],
    courseIds: string[]
  ) => Promise<void>;
  createEmptySubject: (courseIds?: string[]) => Promise<string | null>;
  updateSubject: (
    subjectId: string,
    name: string,
    teachingHours: string,
    scheduleSlotIds: string[],
    courseIds: string[]
  ) => Promise<void>;
  deleteSubject: (subjectId: string) => Promise<void>;
  setStudentEnrollment: (subjectId: string, studentId: string, included: boolean) => Promise<void>;
  bulkAssignCourseStudentsToSubject: (courseId: string, subjectId: string) => Promise<void>;
  getEnrollmentRows: (subjectId: string) => EnrollmentRow[];
  updateScheduleDay: (day: ScheduleDay) => Promise<void>;
  updateScheduleSettings: (settings: ScheduleSettings) => Promise<void>;
  createUnit: (
    subjectId: string,
    name: string,
    description: string,
    sessionCount: number
  ) => Promise<void>;
  createEmptyUnit: (subjectId: string) => Promise<string | null>;
  updateUnit: (unitId: string, name: string, description: string, sessionCount: number) => Promise<void>;
  deleteUnit: (unitId: string) => Promise<void>;
  createEmptyTask: () => Promise<string | null>;
  updateTask: (
    taskId: string,
    title: string,
    description: string,
    sessionCount: number,
    sendToGradebook: boolean
  ) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  addTaskSubjectLink: (taskId: string, subjectId: string, unitId?: string) => Promise<void>;
  removeTaskSubjectLink: (linkId: string) => Promise<void>;
  updateTaskSubjectLink: (linkId: string, unitId: string | undefined) => Promise<void>;
};

const ManagementContext = createContext<ManagementContextValue | null>(null);

export function ManagementProvider({ children }: { children: ReactNode }) {
  const studentSortBy = useAppSelector((state) => state.app.studentSortBy);
  const [courses, setCourses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<UnitBlock[]>([]);
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([]);
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings>({
    id: "default",
    defaultBlockDurationMinutes: 50
  });
  const [subjectCourseLinks, setSubjectCourseLinks] = useState<SubjectCourseLink[]>([]);
  const [subjectStudentLinks, setSubjectStudentLinks] = useState<SubjectStudentLink[]>([]);
  const [taskSubjectLinks, setTaskSubjectLinks] = useState<TaskSubjectLink[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [notice, setNotice] = useState("");
  const [pendingActions, setPendingActions] = useState(0);
  const isBusy = pendingActions > 0;

  const runWithProgress = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    setPendingActions((current) => current + 1);
    try {
      return await action();
    } finally {
      setPendingActions((current) => Math.max(0, current - 1));
    }
  }, []);

  const formatDependencies = (items: Array<[string, number]>): string[] =>
    items.filter(([, count]) => count > 0).map(([label, count]) => `${label}:${count}`);

  const isMeaningfulTaskGradebookConfig = (config: TaskGradebookConfig): boolean =>
    Number(config.gradebookWeight ?? 0) > 0 ||
    Boolean(config.groupId) ||
    Boolean(config.rubricTemplateId) ||
    Boolean(config.checklistTemplateId) ||
    Boolean(config.directGradeEnabled);

  const countStudentRecordedData = async (studentId: string): Promise<Array<[string, number]>> => {
    const [
      gradesCount,
      attendanceCount,
      taskCommentsCount,
      rubricAssessmentsCount,
      checklistAssessmentsCount,
      directGradesCount,
      followUpsCount
    ] = await Promise.all([
      db.gradeEntries.where("studentId").equals(studentId).count(),
      db.attendanceEntries.where("studentId").equals(studentId).count(),
      db.taskStudentComments.where("studentId").equals(studentId).count(),
      db.taskRubricAssessments.where("studentId").equals(studentId).count(),
      db.taskChecklistAssessments.where("studentId").equals(studentId).count(),
      db.taskDirectGrades.where("studentId").equals(studentId).count(),
      db.studentFollowUps.where("studentId").equals(studentId).count()
    ]);

    return [
      ["notas", gradesCount],
      ["asistencia", attendanceCount],
      ["comentarios_tareas", taskCommentsCount],
      ["evaluaciones_rubrica", rubricAssessmentsCount],
      ["evaluaciones_checklist", checklistAssessmentsCount],
      ["notas_directas_tareas", directGradesCount],
      ["seguimiento_tutorial", followUpsCount]
    ];
  };

  const countStudentSubjectRecordedData = async (
    studentId: string,
    subjectId: string
  ): Promise<Array<[string, number]>> => {
    const [subjectAssessments, subjectTaskLinks] = await Promise.all([
      db.assessments.where("subjectId").equals(subjectId).toArray(),
      db.taskSubjectLinks.where("subjectId").equals(subjectId).toArray()
    ]);
    const assessmentIds = new Set(subjectAssessments.map((assessment) => assessment.id));
    const taskIds = new Set(subjectTaskLinks.map((link) => link.taskId));

    const [grades, taskComments, rubricAssessments, checklistAssessments, directGrades] = await Promise.all([
      db.gradeEntries
        .where("studentId")
        .equals(studentId)
        .filter((entry) => assessmentIds.has(entry.assessmentId))
        .count(),
      db.taskStudentComments
        .where("studentId")
        .equals(studentId)
        .filter((row) => taskIds.has(row.taskId))
        .count(),
      db.taskRubricAssessments
        .where("studentId")
        .equals(studentId)
        .filter((row) => taskIds.has(row.taskId))
        .count(),
      db.taskChecklistAssessments
        .where("studentId")
        .equals(studentId)
        .filter((row) => taskIds.has(row.taskId))
        .count(),
      db.taskDirectGrades
        .where("studentId")
        .equals(studentId)
        .filter((row) => taskIds.has(row.taskId))
        .count()
    ]);

    return [
      ["notas", grades],
      ["comentarios_tareas", taskComments],
      ["evaluaciones_rubrica", rubricAssessments],
      ["evaluaciones_checklist", checklistAssessments],
      ["notas_directas_tareas", directGrades]
    ];
  };

  const countTaskSubjectUsage = async (
    taskId: string,
    subjectId: string
  ): Promise<Array<[string, number]>> => {
    const [sessionsCount, gradebookConfigs, directGradesCount] = await Promise.all([
      db.taskSessions
        .where("taskId")
        .equals(taskId)
        .filter((session) => session.subjectId === subjectId)
        .count(),
      db.taskGradebookConfigs
        .where("taskId")
        .equals(taskId)
        .filter((config) => config.subjectId === subjectId)
        .toArray(),
      db.taskDirectGrades
        .where("taskId")
        .equals(taskId)
        .filter((grade) => grade.subjectId === subjectId)
        .count()
    ]);
    const gradebookConfigsCount = gradebookConfigs.filter(isMeaningfulTaskGradebookConfig).length;

    return [
      ["sesiones", sessionsCount],
      ["config_tareas_cuaderno", gradebookConfigsCount],
      ["notas_directas_tareas", directGradesCount]
    ];
  };

  const loadAll = useCallback(async (): Promise<void> => {
    const existingScheduleDays = await db.scheduleDays.orderBy("dayOfWeek").toArray();
    const completedScheduleDays =
      existingScheduleDays.length === 0 ? defaultScheduleDays() : completeScheduleDays(existingScheduleDays);
    if (completedScheduleDays.length !== existingScheduleDays.length) {
      await db.scheduleDays.bulkPut(completedScheduleDays);
    }
    if (!(await db.scheduleSettings.get("default"))) {
      await db.scheduleSettings.put({ id: "default", defaultBlockDurationMinutes: 50 });
    }

    const [
      coursesData,
      studentsData,
      subjectsData,
      unitsData,
      linksData,
      studentLinksData,
      scheduleDaysData,
      scheduleSettingsData,
      taskSubjectLinksData,
      allTasksData
    ] = await Promise.all([
      db.classGroups.orderBy("name").toArray(),
      db.students.toArray(),
      db.subjects.orderBy("name").toArray(),
      db.unitBlocks.orderBy("[subjectId+position]").toArray(),
      db.subjectCourseLinks.toArray(),
      db.subjectStudentLinks.toArray(),
      Promise.resolve(completedScheduleDays),
      db.scheduleSettings.get("default"),
      db.taskSubjectLinks.toArray(),
      db.tasks.toArray()
    ]);

    setCourses(coursesData);
    setStudents(studentsData.sort(compareStudentsByField(studentSortBy)));
    setSubjects(subjectsData);
    setUnits(unitsData);
    setScheduleDays(scheduleDaysData);
    setScheduleSettings(
      scheduleSettingsData ?? {
        id: "default",
        defaultBlockDurationMinutes: 50
      }
    );
    setSubjectCourseLinks(linksData);
    setSubjectStudentLinks(studentLinksData);
    setTaskSubjectLinks(taskSubjectLinksData);
    setAllTasks(allTasksData);
  }, []);

  useEffect(() => {
    void runWithProgress(loadAll);
  }, [loadAll, runWithProgress]);

  // Re-ordenar alumnos en memoria cuando cambia la preferencia sin recargar la BD
  useEffect(() => {
    setStudents((prev) => [...prev].sort(compareStudentsByField(studentSortBy)));
  }, [studentSortBy]);

  const courseMap = useMemo(() => new Map(courses.map((item) => [item.id, item])), [courses]);
  const linksBySubject = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const link of subjectCourseLinks) {
      if (!map.has(link.subjectId)) {
        map.set(link.subjectId, new Set<string>());
      }
      map.get(link.subjectId)?.add(link.classId);
    }
    return map;
  }, [subjectCourseLinks]);
  const studentLinksBySubject = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const link of subjectStudentLinks) {
      if (!map.has(link.subjectId)) {
        map.set(link.subjectId, new Set<string>());
      }
      map.get(link.subjectId)?.add(link.studentId);
    }
    return map;
  }, [subjectStudentLinks]);

  const createCourse = async (
    nameValue: string,
    schoolYearValue: string,
    commentsValue?: string
  ): Promise<void> => {
    const name = nameValue.trim();
    const schoolYear = schoolYearValue.trim();
    if (name.length < 3 || schoolYear.length < 4) {
      setNotice("El curso necesita nombre y año.");
      return;
    }

    const id = crypto.randomUUID();
    await db.classGroups.add({
      id,
      name,
      level: "ESO",
      schoolYear,
      comments: commentsValue?.trim() || undefined
    });
    setNotice("Curso creado.");
    await loadAll();
  };

  const createEmptyCourse = async (): Promise<string | null> => {
    const year = new Date().getFullYear();
    const schoolYear = `${year}-${year + 1}`;
    const id = crypto.randomUUID();
    await db.classGroups.add({
      id,
      name: "",
      level: "ESO",
      schoolYear
    });
    setNotice("Curso en blanco creado.");
    await loadAll();
    return id;
  };

  const updateCourse = async (
    courseId: string,
    nameValue: string,
    schoolYearValue: string,
    commentsValue?: string
  ): Promise<void> => {
    const name = nameValue.trim();
    const schoolYear = schoolYearValue.trim();
    if (name.length < 3 || schoolYear.length < 4) {
      setNotice("Datos inválidos para editar el curso.");
      return;
    }
    const current = courses.find((course) => course.id === courseId);
    if (!current) {
      return;
    }
    await db.classGroups.put({
      ...current,
      name,
      schoolYear,
      comments: commentsValue?.trim() || undefined
    });
    setNotice("Curso actualizado.");
    await loadAll();
  };

  const deleteCourse = async (courseId: string): Promise<void> => {
    const studentRows = await db.students.where("classId").equals(courseId).toArray();
    const studentIds = studentRows.map((item) => item.id);
    const [
      assessmentsCount,
      gradesByClassCount,
      attendanceByClassCount,
      rubricsCount,
      checklistsCount,
      linksCount,
      taskGradebookConfigsCount,
      taskSessionsCount,
      directGradesByClassCount,
      followUpsByClassCount
    ] = await Promise.all([
      db.assessments.where("classId").equals(courseId).count(),
      db.gradeEntries.where("classId").equals(courseId).count(),
      db.attendanceEntries.where("classId").equals(courseId).count(),
      db.rubricTemplates.where("classId").equals(courseId).count(),
      db.checklistTemplates.where("classId").equals(courseId).count(),
      db.subjectCourseLinks.where("classId").equals(courseId).count(),
      db.taskGradebookConfigs.where("classId").equals(courseId).count(),
      db.taskSessions.where("classId").equals(courseId).count(),
      db.taskDirectGrades.where("classId").equals(courseId).count(),
      db.studentFollowUps.where("classId").equals(courseId).count()
    ]);

    let subjectAssignmentsCount = 0;
    let taskCommentsCount = 0;
    if (studentIds.length > 0) {
      subjectAssignmentsCount = await db.subjectStudentLinks.where("studentId").anyOf(studentIds).count();
      taskCommentsCount = await db.taskStudentComments.where("studentId").anyOf(studentIds).count();
    }

    const dependencies = [
      `alumnos:${studentRows.length}`,
      `evaluaciones:${assessmentsCount}`,
      `notas:${gradesByClassCount}`,
      `asistencia:${attendanceByClassCount}`,
      `rúbricas:${rubricsCount}`,
      `listas_cotejo:${checklistsCount}`,
      `vinculos_asignatura:${linksCount}`,
      `config_tareas_cuaderno:${taskGradebookConfigsCount}`,
      `sesiones_tareas:${taskSessionsCount}`,
      `notas_directas_tareas:${directGradesByClassCount}`,
      `seguimiento_tutorial:${followUpsByClassCount}`,
      `asignaciones_asignatura:${subjectAssignmentsCount}`,
      `comentarios_tareas:${taskCommentsCount}`
    ].filter((item) => Number(item.split(":")[1]) > 0);

    if (dependencies.length > 0) {
      setNotice(
        `No se puede eliminar el curso porque tiene dependencias (${dependencies.join(", ")}).`
      );
      return;
    }

    await db.classGroups.delete(courseId);
    setNotice("Curso eliminado.");
    await loadAll();
  };

  const createStudent = async (
    firstNameValue: string,
    lastNameValue: string,
    courseId: string,
    photoDataUrl?: string,
    commentsValue?: string,
    emailValue?: string,
    hasAcs = false,
    hasReinforcement = false
  ): Promise<void> => {
    const firstName = firstNameValue.trim();
    const lastName = lastNameValue.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const comments = commentsValue?.trim() || undefined;
    const email = emailValue?.trim() || undefined;
    if (firstName.length < 2 || lastName.length < 2 || !courseId) {
      setNotice("Alumno inválido: completa nombre, apellidos y curso.");
      return;
    }

    await db.students.add({
      id: crypto.randomUUID(),
      classId: courseId,
      firstName,
      lastName,
      fullName,
      comments,
      email,
      photoDataUrl,
      hasAcs,
      hasReinforcement
    });
    setNotice("Alumno creado.");
    await loadAll();
  };

  const createEmptyStudent = async (courseId?: string): Promise<string | null> => {
    const fallbackCourseId = courseId || courses[0]?.id;
    if (!fallbackCourseId) {
      setNotice("Crea al menos un curso antes de añadir alumnos.");
      return null;
    }

    const id = crypto.randomUUID();
    await db.students.add({
      id,
      classId: fallbackCourseId,
      firstName: "",
      lastName: "",
      fullName: "",
      hasAcs: false,
      hasReinforcement: false
    });
    setNotice("Alumno en blanco creado.");
    await loadAll();
    return id;
  };

  const getSubjectLinksToDeleteForStudentCourse = async (
    studentId: string,
    courseId: string
  ): Promise<string[]> => {
    const [courseLinks, studentSubjectLinks] = await Promise.all([
      db.subjectCourseLinks.where("classId").equals(courseId).toArray(),
      db.subjectStudentLinks.where("studentId").equals(studentId).toArray()
    ]);
    const allowedSubjectIds = new Set(courseLinks.map((link) => link.subjectId));
    return studentSubjectLinks
      .filter((link) => !allowedSubjectIds.has(link.subjectId))
      .map((link) => link.id);
  };

  const addStudentToCourse = async (studentId: string, courseId: string): Promise<void> => {
    const student = students.find((item) => item.id === studentId);
    if (!student) {
      return;
    }
    if (student.classId === courseId) {
      setNotice("El alumno ya pertenece a ese curso.");
      return;
    }
    const dependencies = formatDependencies(await countStudentRecordedData(studentId));
    if (dependencies.length > 0) {
      setNotice(`No se puede mover el alumno porque tiene datos registrados (${dependencies.join(", ")}).`);
      return;
    }
    const linksToDelete = await getSubjectLinksToDeleteForStudentCourse(studentId, courseId);
    await db.transaction("rw", db.students, db.subjectStudentLinks, async () => {
      await db.students.put({ ...student, classId: courseId });
      if (linksToDelete.length > 0) {
        await db.subjectStudentLinks.bulkDelete(linksToDelete);
      }
    });
    setNotice("Alumno movido de curso.");
    await loadAll();
  };

  const removeStudentFromCourse = async (studentId: string, courseId: string): Promise<void> => {
    const student = students.find((item) => item.id === studentId);
    if (!student) {
      return;
    }
    if (student.classId === courseId) {
      setNotice("Un alumno debe estar asignado a un curso. Muévelo a otro curso antes.");
      return;
    }
  };

  const updateStudent = async (
    studentId: string,
    firstNameValue: string,
    lastNameValue: string,
    courseIdValue: string,
    photoDataUrl?: string,
    commentsValue?: string,
    emailValue?: string,
    hasAcs = false,
    hasReinforcement = false
  ): Promise<void> => {
    const firstName = firstNameValue.trim();
    const lastName = lastNameValue.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const courseId = courseIdValue.trim();
    const comments = commentsValue?.trim() || undefined;
    const email = emailValue?.trim() || undefined;
    if (!firstName || !lastName || !courseId) {
      setNotice("Datos incompletos: nombre, apellidos y al menos un curso.");
      return;
    }
    const current = students.find((student) => student.id === studentId);
    if (!current) {
      return;
    }
    if (current.classId !== courseId) {
      const dependencies = formatDependencies(await countStudentRecordedData(studentId));
      if (dependencies.length > 0) {
        setNotice(`No se puede cambiar el curso del alumno porque tiene datos registrados (${dependencies.join(", ")}).`);
        return;
      }
    }
    const linksToDelete = await getSubjectLinksToDeleteForStudentCourse(studentId, courseId);
    await db.transaction("rw", db.students, db.subjectStudentLinks, async () => {
      await db.students.put({
        ...current,
        classId: courseId,
        firstName,
        lastName,
        fullName,
        comments,
        email,
        photoDataUrl,
        hasAcs,
        hasReinforcement
      });
      if (linksToDelete.length > 0) {
        await db.subjectStudentLinks.bulkDelete(linksToDelete);
      }
    });
    setNotice("Alumno actualizado.");
    await loadAll();
  };

  const deleteStudent = async (studentId: string): Promise<void> => {
    const recordedData = await countStudentRecordedData(studentId);
    const subjectAssignmentsCount = await db.subjectStudentLinks.where("studentId").equals(studentId).count();
    const dependencies = formatDependencies([
      ...recordedData,
      ["asignaciones_asignatura", subjectAssignmentsCount]
    ]);

    if (dependencies.length > 0) {
      setNotice(
        `No se puede eliminar el alumno porque tiene dependencias (${dependencies.join(", ")}).`
      );
      return;
    }

    await db.students.delete(studentId);
    setNotice("Alumno eliminado.");
    await loadAll();
  };

  const createSubject = async (
    nameValue: string,
    teachingHoursValue: string,
    scheduleSlotIdsValue: string[],
    courseIds: string[]
  ): Promise<void> => {
    const name = nameValue.trim();
    const teachingHours = teachingHoursValue.trim();
    const scheduleSlotIds = Array.from(new Set(scheduleSlotIdsValue.filter(Boolean)));
    if (name.length < 2) {
      setNotice("La asignatura necesita al menos 2 caracteres.");
      return;
    }
    const uniqueCourseIds = Array.from(new Set(courseIds.filter(Boolean)));
    if (uniqueCourseIds.length === 0) {
      setNotice("Selecciona al menos un curso para asociar la asignatura.");
      return;
    }
    const conflicting = subjects.find((subject) =>
      (subject.scheduleSlotIds ?? []).some((slotId) => scheduleSlotIds.includes(slotId))
    );
    if (conflicting) {
      setNotice(`No se puede guardar: el horario ya está ocupado por ${conflicting.name}.`);
      return;
    }

    const subjectId = crypto.randomUUID();
    await db.transaction("rw", db.subjects, db.subjectCourseLinks, async () => {
      await db.subjects.add({
        id: subjectId,
        name,
        teachingHours: teachingHours || undefined,
        scheduleSlotIds
      });
      for (const classId of uniqueCourseIds) {
        await db.subjectCourseLinks.add({
          id: crypto.randomUUID(),
          subjectId,
          classId
        });
      }
    });

    setNotice("Asignatura creada y asociada a cursos.");
    await loadAll();
  };

  const createEmptySubject = async (courseIds?: string[]): Promise<string | null> => {
    const uniqueCourseIds = Array.from(new Set((courseIds ?? []).filter(Boolean)));
    const effectiveCourseIds =
      uniqueCourseIds.length > 0
        ? uniqueCourseIds
        : courses.length > 0
          ? [courses[0].id]
          : [];

    if (effectiveCourseIds.length === 0) {
      setNotice("Crea al menos un curso antes de añadir asignaturas.");
      return null;
    }

    const subjectId = crypto.randomUUID();
    await db.transaction("rw", db.subjects, db.subjectCourseLinks, async () => {
      await db.subjects.add({
        id: subjectId,
        name: "",
        scheduleSlotIds: []
      });
      for (const classId of effectiveCourseIds) {
        await db.subjectCourseLinks.add({
          id: crypto.randomUUID(),
          subjectId,
          classId
        });
      }
    });

    setNotice("Asignatura en blanco creada.");
    await loadAll();
    return subjectId;
  };

  const updateSubject = async (
    subjectId: string,
    nameValue: string,
    teachingHoursValue: string,
    scheduleSlotIdsValue: string[],
    courseIds: string[]
  ): Promise<void> => {
    const name = nameValue.trim();
    const teachingHours = teachingHoursValue.trim();
    const scheduleSlotIds = Array.from(new Set(scheduleSlotIdsValue.filter(Boolean)));
    if (name.length < 2) {
      setNotice("La asignatura necesita al menos 2 caracteres.");
      return;
    }
    const conflicting = subjects.find(
      (subject) =>
        subject.id !== subjectId &&
        (subject.scheduleSlotIds ?? []).some((slotId) => scheduleSlotIds.includes(slotId))
    );
    if (conflicting) {
      setNotice(`No se puede guardar: el horario ya está ocupado por ${conflicting.name}.`);
      return;
    }
    const uniqueCourseIds = Array.from(new Set(courseIds.filter(Boolean)));
    const currentSubjectLinks = await db.subjectCourseLinks.where("subjectId").equals(subjectId).toArray();
    const nextCourseSet = new Set(uniqueCourseIds);
    const removedCourseIds = currentSubjectLinks
      .filter((link) => !nextCourseSet.has(link.classId))
      .map((link) => link.classId);
    const removalDependencies: string[] = [];
    for (const classId of removedCourseIds) {
      const [assessmentsCount, gradebookGroupsCount, taskConfigs, taskSessionsCount, directGradesCount] = await Promise.all([
        db.assessments.where("[classId+subjectId]").equals([classId, subjectId]).count(),
        db.gradebookGroups.where("[classId+subjectId]").equals([classId, subjectId]).count(),
        db.taskGradebookConfigs.where("[classId+subjectId]").equals([classId, subjectId]).toArray(),
        db.taskSessions.where("[subjectId+classId]").equals([subjectId, classId]).count(),
        db.taskDirectGrades.where("subjectId").equals(subjectId).filter((grade) => grade.classId === classId).count()
      ]);
      const taskConfigsCount = taskConfigs.filter(isMeaningfulTaskGradebookConfig).length;
      const courseName = courses.find((course) => course.id === classId)?.name ?? classId;
      const dependencies = formatDependencies([
        ["evaluaciones", assessmentsCount],
        ["carpetas_cuaderno", gradebookGroupsCount],
        ["config_tareas_cuaderno", taskConfigsCount],
        ["sesiones_tareas", taskSessionsCount],
        ["notas_directas_tareas", directGradesCount]
      ]);
      if (dependencies.length > 0) {
        removalDependencies.push(`${courseName} (${dependencies.join(", ")})`);
      }
    }
    if (removalDependencies.length > 0) {
      setNotice(`No se puede quitar la asignatura de esos cursos porque tiene datos: ${removalDependencies.join("; ")}.`);
      return;
    }

    await db.transaction(
      "rw",
      db.subjects,
      db.subjectCourseLinks,
      db.subjectStudentLinks,
      db.students,
      db.taskGradebookConfigs,
      async () => {
      const subject = await db.subjects.get(subjectId);
      if (!subject) {
        return;
      }
      await db.subjects.put({
        ...subject,
        name,
        teachingHours: teachingHours || undefined,
        scheduleSlotIds
      });

      const currentByCourse = new Map(currentSubjectLinks.map((item) => [item.classId, item]));
      const nextSet = new Set(uniqueCourseIds);

      for (const link of currentSubjectLinks) {
        if (!nextSet.has(link.classId)) {
          await db.subjectCourseLinks.delete(link.id);
          const emptyConfigs = await db.taskGradebookConfigs
            .where("[classId+subjectId]")
            .equals([link.classId, subjectId])
            .filter((config) => !isMeaningfulTaskGradebookConfig(config))
            .toArray();
          if (emptyConfigs.length > 0) {
            await db.taskGradebookConfigs.bulkDelete(emptyConfigs.map((config) => config.id));
          }
          // Clean up student subject links for students in the removed course
          const studentsInCourse = await db.students.where("classId").equals(link.classId).toArray();
          if (studentsInCourse.length > 0) {
            const studentIds = new Set(studentsInCourse.map((s) => s.id));
            const linksToDelete = await db.subjectStudentLinks
              .where("subjectId")
              .equals(subjectId)
              .filter((sl) => studentIds.has(sl.studentId))
              .toArray();
            if (linksToDelete.length > 0) {
              await db.subjectStudentLinks.bulkDelete(linksToDelete.map((sl) => sl.id));
            }
          }
        }
      }

      for (const classId of uniqueCourseIds) {
        if (!currentByCourse.has(classId)) {
          await db.subjectCourseLinks.add({
            id: crypto.randomUUID(),
            subjectId,
            classId
          });
        }
      }
      }
    );

    setNotice("Asignatura actualizada.");
    await loadAll();
  };

  const deleteSubject = async (subjectId: string): Promise<void> => {
    const [unitsCount, tasksCount, gradebookGroupsCount, taskConfigs, assessmentsCount, taskSessionsCount, directGradesCount] = await Promise.all([
      db.unitBlocks.where("subjectId").equals(subjectId).count(),
      db.taskSubjectLinks.where("subjectId").equals(subjectId).count(),
      db.gradebookGroups.where("subjectId").equals(subjectId).count(),
      db.taskGradebookConfigs.where("subjectId").equals(subjectId).toArray(),
      db.assessments.where("subjectId").equals(subjectId).count(),
      db.taskSessions.where("subjectId").equals(subjectId).count(),
      db.taskDirectGrades.where("subjectId").equals(subjectId).count()
    ]);
    const taskConfigsCount = taskConfigs.filter(isMeaningfulTaskGradebookConfig).length;

    const blocking = formatDependencies([
      ["unidades", unitsCount],
      ["tareas", tasksCount],
      ["carpetas_cuaderno", gradebookGroupsCount],
      ["config_tareas_cuaderno", taskConfigsCount],
      ["evaluaciones", assessmentsCount],
      ["sesiones_tareas", taskSessionsCount],
      ["notas_directas_tareas", directGradesCount]
    ]);

    if (blocking.length > 0) {
      setNotice(`No se puede eliminar la asignatura porque tiene dependencias (${blocking.join(", ")}).`);
      return;
    }

    const emptyConfigIds = taskConfigs.filter((config) => !isMeaningfulTaskGradebookConfig(config)).map((config) => config.id);
    await db.transaction("rw", db.subjects, db.subjectCourseLinks, db.subjectStudentLinks, db.taskGradebookConfigs, async () => {
      if (emptyConfigIds.length > 0) {
        await db.taskGradebookConfigs.bulkDelete(emptyConfigIds);
      }
      await db.subjectCourseLinks.where("subjectId").equals(subjectId).delete();
      await db.subjectStudentLinks.where("subjectId").equals(subjectId).delete();
      await db.subjects.delete(subjectId);
    });
    setNotice("Asignatura eliminada.");
    await loadAll();
  };

  const setStudentEnrollment = async (
    subjectId: string,
    studentId: string,
    included: boolean
  ): Promise<void> => {
    const existing = subjectStudentLinks.find(
      (item) => item.subjectId === subjectId && item.studentId === studentId
    );

    if (included) {
      if (!existing) {
        await db.subjectStudentLinks.add({
          id: crypto.randomUUID(),
          subjectId,
          studentId
        });
      }
    } else if (existing) {
      const dependencies = formatDependencies(await countStudentSubjectRecordedData(studentId, subjectId));
      if (dependencies.length > 0) {
        setNotice(`No se puede quitar al alumno de la asignatura porque tiene datos (${dependencies.join(", ")}).`);
        return;
      }
      await db.subjectStudentLinks.delete(existing.id);
    }

    await loadAll();
  };

  const bulkAssignCourseStudentsToSubject = async (
    courseId: string,
    subjectId: string
  ): Promise<void> => {
    if (!courseId || !subjectId) {
      setNotice("Selecciona curso y asignatura.");
      return;
    }

    const courseStudents = await db.students.where("classId").equals(courseId).toArray();
    const assignedSet = new Set(
      (studentLinksBySubject.get(subjectId) ?? new Set<string>()).values()
    );

    const itemsToAdd: SubjectStudentLink[] = [];
    for (const student of courseStudents) {
      if (!assignedSet.has(student.id)) {
        itemsToAdd.push({
          id: crypto.randomUUID(),
          subjectId,
          studentId: student.id
        });
      }
    }

    if (itemsToAdd.length > 0) {
      await db.subjectStudentLinks.bulkAdd(itemsToAdd);
    }
    setNotice(
      itemsToAdd.length > 0
        ? `Se asignaron ${itemsToAdd.length} alumnos del curso a la asignatura.`
        : "No había alumnos nuevos para asignar."
    );
    await loadAll();
  };

  const getEnrollmentRows = (subjectId: string): EnrollmentRow[] => {
    if (!subjectId) {
      return [];
    }
    const linkedCourses = linksBySubject.get(subjectId) ?? new Set<string>();
    const assignedStudents = studentLinksBySubject.get(subjectId) ?? new Set<string>();

    return students.map((student) => ({
      student,
      courseName: courseMap.get(student.classId)?.name ?? "-",
      derivedIncluded: linkedCourses.has(student.classId),
      effectiveIncluded: assignedStudents.has(student.id)
    }));
  };

  const updateScheduleDay = async (day: ScheduleDay): Promise<void> => {
    await db.transaction("rw", db.scheduleDays, db.subjects, async () => {
      const previous = await db.scheduleDays.get(day.id);
      await db.scheduleDays.put(day);

      if (!previous) {
        return;
      }

      const previousBlocks = previous.blocks ?? [];
      if (previousBlocks.length === 0) {
        return;
      }

      const nextBlocks = day.blocks ?? [];
      const previousIds = new Set(previousBlocks.map((block) => block.id));
      const nextBreakIds = new Set(nextBlocks.filter((block) => block.isBreak).map((block) => block.id));
      const remap = new Map<string, string>();
      const usedNextIds = new Set<string>();

      // Keep explicit IDs whenever a block survives with the same ID.
      for (const block of nextBlocks) {
        if (previousIds.has(block.id)) {
          remap.set(block.id, block.id);
          usedNextIds.add(block.id);
        }
      }

      const unmatchedPrevious = previousBlocks.filter((block) => !remap.has(block.id));
      const unmatchedNext = nextBlocks.filter((block) => !usedNextIds.has(block.id));

      // First try to match blocks by identical time range.
      const nextIdsByTime = new Map<string, string[]>();
      for (const block of unmatchedNext) {
        const key = `${block.startTime}|${block.endTime}`;
        const bucket = nextIdsByTime.get(key) ?? [];
        bucket.push(block.id);
        nextIdsByTime.set(key, bucket);
      }

      for (const block of unmatchedPrevious) {
        const key = `${block.startTime}|${block.endTime}`;
        const bucket = nextIdsByTime.get(key);
        const mappedId = bucket?.shift();
        if (!mappedId) {
          continue;
        }
        remap.set(block.id, mappedId);
        usedNextIds.add(mappedId);
      }

      // Fallback: preserve as many assignments as possible by position.
      const stillPrevious = unmatchedPrevious.filter((block) => !remap.has(block.id));
      const stillNext = unmatchedNext.filter((block) => !usedNextIds.has(block.id));
      const fallbackLength = Math.min(stillPrevious.length, stillNext.length);
      for (let index = 0; index < fallbackLength; index += 1) {
        const fromId = stillPrevious[index].id;
        const toId = stillNext[index].id;
        remap.set(fromId, toId);
        usedNextIds.add(toId);
      }

      if (remap.size === 0) {
        return;
      }

      const subjectsData = await db.subjects.toArray();
      for (const subject of subjectsData) {
        const currentSlotIds = subject.scheduleSlotIds ?? [];
        if (!currentSlotIds.some((slotId) => previousIds.has(slotId))) {
          continue;
        }

        const nextSlotIds: string[] = [];
        let changed = false;

        for (const slotId of currentSlotIds) {
          if (nextBreakIds.has(slotId)) {
            changed = true;
            continue;
          }

          if (!previousIds.has(slotId)) {
            nextSlotIds.push(slotId);
            continue;
          }

          const mappedId = remap.get(slotId);
          if (!mappedId || nextBreakIds.has(mappedId)) {
            changed = true;
            continue;
          }
          if (mappedId !== slotId) {
            changed = true;
          }
          nextSlotIds.push(mappedId);
        }

        if (!changed) {
          continue;
        }

        const deduped = Array.from(new Set(nextSlotIds));
        await db.subjects.put({
          ...subject,
          scheduleSlotIds: deduped
        });
      }
    });
    await loadAll();
  };

  const updateScheduleSettings = async (settings: ScheduleSettings): Promise<void> => {
    await db.scheduleSettings.put(settings);
    await loadAll();
  };

  const createUnit = async (
    subjectId: string,
    nameValue: string,
    descriptionValue: string,
    sessionCountValue: number
  ): Promise<void> => {
    const name = nameValue.trim();
    const description = descriptionValue.trim();
    const sessionCount = Math.max(1, Math.round(sessionCountValue));
    if (!subjectId || name.length < 2) {
      setNotice("La unidad necesita asignatura y nombre.");
      return;
    }
    const currentUnits = await db.unitBlocks.where("subjectId").equals(subjectId).toArray();
    const maxPosition = currentUnits.reduce((max, item) => Math.max(max, item.position), 0);
    const id = crypto.randomUUID();
    await db.unitBlocks.add({
      id,
      subjectId,
      name,
      description,
      sessionCount,
      position: maxPosition + 1
    });

    setNotice("Unidad creada.");
    await loadAll();
  };

  const createEmptyUnit = async (subjectId: string): Promise<string | null> => {
    if (!subjectId) {
      setNotice("Selecciona una asignatura para crear la unidad.");
      return null;
    }
    const currentUnits = await db.unitBlocks.where("subjectId").equals(subjectId).toArray();
    const maxPosition = currentUnits.reduce((max, item) => Math.max(max, item.position), 0);
    const id = crypto.randomUUID();
    await db.unitBlocks.add({
      id,
      subjectId,
      name: "",
      description: "",
      sessionCount: 1,
      position: maxPosition + 1
    });

    setNotice("Unidad en blanco creada.");
    await loadAll();
    return id;
  };

  const updateUnit = async (
    unitId: string,
    nameValue: string,
    descriptionValue: string,
    sessionCountValue: number
  ): Promise<void> => {
    const name = nameValue.trim();
    const description = descriptionValue.trim();
    const sessionCount = Math.max(1, Math.round(sessionCountValue));
    if (name.length < 2) {
      setNotice("La unidad necesita nombre.");
      return;
    }
    const current = units.find((item) => item.id === unitId);
    if (!current) {
      return;
    }
    await db.unitBlocks.put({
      ...current,
      name,
      description,
      sessionCount
    });
    setNotice("Unidad actualizada.");
    await loadAll();
  };

  const deleteUnit = async (unitId: string): Promise<void> => {
    const tasksCount = await db.taskSubjectLinks.where("unitId").equals(unitId).count();
    if (tasksCount > 0) {
      setNotice(`No se puede eliminar la unidad porque tiene dependencias (tareas:${tasksCount}).`);
      return;
    }
    await db.unitBlocks.delete(unitId);
    setNotice("Unidad eliminada.");
    await loadAll();
  };


  const createEmptyTask = async (): Promise<string | null> => {
    const id = crypto.randomUUID();
    await db.tasks.add({
      id,
      title: "",
      description: "",
      sessionCount: 1,
      sendToGradebook: false
    });
    setNotice("Tarea en blanco creada.");
    await loadAll();
    return id;
  };

  const updateTask = async (
    taskId: string,
    titleValue: string,
    descriptionValue: string,
    sessionCountValue: number,
    sendToGradebook: boolean
  ): Promise<void> => {
    const title = titleValue.trim();
    const description = descriptionValue.trim();
    const sessionCount = Math.max(1, Math.round(sessionCountValue));
    if (title.length < 2) {
      setNotice("La tarea necesita un título (mínimo 2 caracteres).");
      return;
    }
    const current = allTasks.find((t) => t.id === taskId);
    if (!current) return;
    await db.tasks.put({
      ...current,
      title,
      description,
      sessionCount,
      sendToGradebook
    });
    setNotice("Tarea actualizada.");
    await loadAll();
  };

  const deleteTask = async (taskId: string): Promise<void> => {
    const [
      subjectLinksCount,
      gradebookConfigs,
      sessionsCount,
      commentsCount,
      dailySettingsCount,
      rubricAssessmentsCount,
      checklistAssessmentsCount,
      directGradesCount,
      rubricsCount,
      checklistsCount
    ] = await Promise.all([
      db.taskSubjectLinks.where("taskId").equals(taskId).count(),
      db.taskGradebookConfigs.where("taskId").equals(taskId).toArray(),
      db.taskSessions.where("taskId").equals(taskId).count(),
      db.taskStudentComments.where("taskId").equals(taskId).count(),
      db.taskDailyEvaluationSettings.where("taskId").equals(taskId).count(),
      db.taskRubricAssessments.where("taskId").equals(taskId).count(),
      db.taskChecklistAssessments.where("taskId").equals(taskId).count(),
      db.taskDirectGrades.where("taskId").equals(taskId).count(),
      db.rubricTemplates.where("taskId").equals(taskId).count(),
      db.checklistTemplates.where("taskId").equals(taskId).count()
    ]);
    const gradebookConfigsCount = gradebookConfigs.filter(isMeaningfulTaskGradebookConfig).length;
    const dependencies = formatDependencies([
      ["vinculos_asignatura", subjectLinksCount],
      ["config_tareas_cuaderno", gradebookConfigsCount],
      ["sesiones", sessionsCount],
      ["comentarios", commentsCount],
      ["ajustes_evaluacion", dailySettingsCount],
      ["evaluaciones_rubrica", rubricAssessmentsCount],
      ["evaluaciones_checklist", checklistAssessmentsCount],
      ["notas_directas_tareas", directGradesCount],
      ["rubricas", rubricsCount],
      ["listas_cotejo", checklistsCount]
    ]);
    if (dependencies.length > 0) {
      setNotice(`No se puede eliminar la tarea porque tiene dependencias (${dependencies.join(", ")}).`);
      return;
    }

    const emptyConfigIds = gradebookConfigs.filter((config) => !isMeaningfulTaskGradebookConfig(config)).map((config) => config.id);
    await db.transaction("rw", db.tasks, db.taskGradebookConfigs, async () => {
      if (emptyConfigIds.length > 0) {
        await db.taskGradebookConfigs.bulkDelete(emptyConfigIds);
      }
      await db.tasks.delete(taskId);
    });
    setNotice("Tarea eliminada.");
    await loadAll();
  };

  const addTaskSubjectLink = async (
    taskId: string,
    subjectId: string,
    unitId?: string
  ): Promise<void> => {
    const existing = taskSubjectLinks.find(
      (l) => l.taskId === taskId && l.subjectId === subjectId && (l.unitId ?? "") === (unitId ?? "")
    );
    if (existing) {
      setNotice("La tarea ya está vinculada a esa asignatura/unidad.");
      return;
    }
    await db.taskSubjectLinks.add({
      id: crypto.randomUUID(),
      taskId,
      subjectId,
      unitId: unitId || undefined
    });
    setNotice("Tarea vinculada.");
    await loadAll();
  };

  const updateTaskSubjectLink = async (
    linkId: string,
    unitId: string | undefined
  ): Promise<void> => {
    const existing = await db.taskSubjectLinks.get(linkId);
    if (!existing) return;
    if ((existing.unitId ?? "") !== (unitId ?? "")) {
      const dependencies = formatDependencies(await countTaskSubjectUsage(existing.taskId, existing.subjectId));
      if (dependencies.length > 0) {
        setNotice(`No se puede cambiar la unidad del vínculo porque ya tiene datos (${dependencies.join(", ")}).`);
        return;
      }
    }
    await db.taskSubjectLinks.put({ ...existing, unitId: unitId || undefined });
    await loadAll();
  };

  const removeTaskSubjectLink = async (linkId: string): Promise<void> => {
    const link = await db.taskSubjectLinks.get(linkId);
    if (!link) {
      return;
    }
    const dependencies = formatDependencies(await countTaskSubjectUsage(link.taskId, link.subjectId));
    if (dependencies.length > 0) {
      setNotice(`No se puede eliminar el vínculo porque ya tiene datos (${dependencies.join(", ")}).`);
      return;
    }
    const emptyConfigs = await db.taskGradebookConfigs
      .where("taskId")
      .equals(link.taskId)
      .filter((config) => config.subjectId === link.subjectId && !isMeaningfulTaskGradebookConfig(config))
      .toArray();
    await db.transaction("rw", db.taskSubjectLinks, db.taskGradebookConfigs, async () => {
      if (emptyConfigs.length > 0) {
        await db.taskGradebookConfigs.bulkDelete(emptyConfigs.map((config) => config.id));
      }
      await db.taskSubjectLinks.delete(linkId);
    });
    setNotice("Vínculo eliminado.");
    await loadAll();
  };

  const value: ManagementContextValue = {
    courses,
    students,
    subjects,
    units,
    scheduleDays,
    scheduleSettings,
    subjectCourseLinks,
    taskSubjectLinks,
    allTasks,
    notice,
    isBusy,
    setNotice,
    refreshAll: () => runWithProgress(() => loadAll()),
    createCourse: (...args) => runWithProgress(() => createCourse(...args)),
    createEmptyCourse: () => runWithProgress(() => createEmptyCourse()),
    updateCourse: (...args) => runWithProgress(() => updateCourse(...args)),
    deleteCourse: (...args) => runWithProgress(() => deleteCourse(...args)),
    createStudent: (...args) => runWithProgress(() => createStudent(...args)),
    createEmptyStudent: (...args) => runWithProgress(() => createEmptyStudent(...args)),
    updateStudent: (...args) => runWithProgress(() => updateStudent(...args)),
    addStudentToCourse: (...args) => runWithProgress(() => addStudentToCourse(...args)),
    removeStudentFromCourse: (...args) => runWithProgress(() => removeStudentFromCourse(...args)),
    deleteStudent: (...args) => runWithProgress(() => deleteStudent(...args)),
    createSubject: (...args) => runWithProgress(() => createSubject(...args)),
    createEmptySubject: (...args) => runWithProgress(() => createEmptySubject(...args)),
    updateSubject: (...args) => runWithProgress(() => updateSubject(...args)),
    deleteSubject: (...args) => runWithProgress(() => deleteSubject(...args)),
    setStudentEnrollment: (...args) => runWithProgress(() => setStudentEnrollment(...args)),
    bulkAssignCourseStudentsToSubject: (...args) =>
      runWithProgress(() => bulkAssignCourseStudentsToSubject(...args)),
    getEnrollmentRows,
    updateScheduleDay: (...args) => runWithProgress(() => updateScheduleDay(...args)),
    updateScheduleSettings: (...args) => runWithProgress(() => updateScheduleSettings(...args)),
    createUnit: (...args) => runWithProgress(() => createUnit(...args)),
    createEmptyUnit: (...args) => runWithProgress(() => createEmptyUnit(...args)),
    updateUnit: (...args) => runWithProgress(() => updateUnit(...args)),
    deleteUnit: (...args) => runWithProgress(() => deleteUnit(...args)),
    createEmptyTask: () => runWithProgress(() => createEmptyTask()),
    updateTask: (...args) => runWithProgress(() => updateTask(...args)),
    deleteTask: (...args) => runWithProgress(() => deleteTask(...args)),
    addTaskSubjectLink: (...args) => runWithProgress(() => addTaskSubjectLink(...args)),
    removeTaskSubjectLink: (...args) => runWithProgress(() => removeTaskSubjectLink(...args)),
    updateTaskSubjectLink: (...args) => runWithProgress(() => updateTaskSubjectLink(...args))
  };

  return <ManagementContext.Provider value={value}>{children}</ManagementContext.Provider>;
}

export function useManagement() {
  const context = useContext(ManagementContext);
  if (!context) {
    throw new Error("useManagement must be used within ManagementProvider");
  }
  return context;
}
