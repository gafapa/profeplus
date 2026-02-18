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
  SubjectStudentLink
} from "../../shared/db/types";
import { getStudentFullName } from "../../shared/utils/student";

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
    photoDataUrl?: string
  ) => Promise<void>;
  createEmptyStudent: (courseId?: string) => Promise<string | null>;
  updateStudent: (
    studentId: string,
    firstName: string,
    lastName: string,
    courseId: string,
    photoDataUrl?: string
  ) => Promise<void>;
  moveStudent: (studentId: string, courseId: string) => Promise<void>;
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
  createDefaultScheduleDays: () => Promise<void>;
  createUnit: (
    subjectId: string,
    name: string,
    description: string,
    startDate: string,
    endDate: string,
    sessionCount: number
  ) => Promise<void>;
  createEmptyUnit: (subjectId: string) => Promise<string | null>;
  updateUnit: (
    unitId: string,
    name: string,
    description: string,
    startDate: string,
    endDate: string,
    sessionCount: number
  ) => Promise<void>;
  deleteUnit: (unitId: string) => Promise<void>;
};

const ManagementContext = createContext<ManagementContextValue | null>(null);

export function ManagementProvider({ children }: { children: ReactNode }) {
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

  const loadAll = useCallback(async (): Promise<void> => {
    const [
      coursesData,
      studentsData,
      subjectsData,
      unitsData,
      linksData,
      studentLinksData,
      scheduleDaysData,
      scheduleSettingsData
    ] =
      await Promise.all([
        db.classGroups.orderBy("name").toArray(),
        db.students.toArray(),
        db.subjects.orderBy("name").toArray(),
        db.unitBlocks.orderBy("[subjectId+position]").toArray(),
        db.subjectCourseLinks.toArray(),
        db.subjectStudentLinks.toArray(),
        db.scheduleDays.orderBy("dayOfWeek").toArray(),
        db.scheduleSettings.get("default")
      ]);

    setCourses(coursesData);
    setStudents(studentsData.sort((a, b) => getStudentFullName(a).localeCompare(getStudentFullName(b))));
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
  }, []);

  useEffect(() => {
    void runWithProgress(loadAll);
  }, [loadAll, runWithProgress]);

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
    const name = nameValue.trim().toUpperCase();
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
    const name = nameValue.trim().toUpperCase();
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
      lessonPlansCount,
      rubricsCount,
      checklistsCount,
      linksCount
    ] = await Promise.all([
      db.assessments.where("classId").equals(courseId).count(),
      db.gradeEntries.where("classId").equals(courseId).count(),
      db.attendanceEntries.where("classId").equals(courseId).count(),
      db.lessonPlans.where("classId").equals(courseId).count(),
      db.rubricTemplates.where("classId").equals(courseId).count(),
      db.checklistTemplates.where("classId").equals(courseId).count(),
      db.subjectCourseLinks.where("classId").equals(courseId).count()
    ]);

    let subjectAssignmentsCount = 0;
    if (studentIds.length > 0) {
      subjectAssignmentsCount = await db.subjectStudentLinks.where("studentId").anyOf(studentIds).count();
    }

    const dependencies = [
      `alumnos:${studentRows.length}`,
      `evaluaciones:${assessmentsCount}`,
      `notas:${gradesByClassCount}`,
      `asistencia:${attendanceByClassCount}`,
      `planner:${lessonPlansCount}`,
      `rúbricas:${rubricsCount}`,
      `listas_cotejo:${checklistsCount}`,
      `vinculos_asignatura:${linksCount}`,
      `asignaciones_asignatura:${subjectAssignmentsCount}`
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
    photoDataUrl?: string
  ): Promise<void> => {
    const firstName = firstNameValue.trim();
    const lastName = lastNameValue.trim();
    const fullName = `${firstName} ${lastName}`.trim();
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
      photoDataUrl
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
      fullName: ""
    });
    setNotice("Alumno en blanco creado.");
    await loadAll();
    return id;
  };

  const moveStudent = async (studentId: string, courseId: string): Promise<void> => {
    const student = students.find((item) => item.id === studentId);
    if (!student) {
      return;
    }
    await db.students.put({ ...student, classId: courseId });
    setNotice("Alumno reasignado de curso.");
    await loadAll();
  };

  const updateStudent = async (
    studentId: string,
    firstNameValue: string,
    lastNameValue: string,
    courseId: string,
    photoDataUrl?: string
  ): Promise<void> => {
    const firstName = firstNameValue.trim();
    const lastName = lastNameValue.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (!firstName || !lastName || !courseId) {
      setNotice("Datos incompletos para editar alumno.");
      return;
    }
    const current = students.find((student) => student.id === studentId);
    if (!current) {
      return;
    }
    await db.students.put({
      ...current,
      classId: courseId,
      firstName,
      lastName,
      fullName,
      photoDataUrl
    });
    setNotice("Alumno actualizado.");
    await loadAll();
  };

  const deleteStudent = async (studentId: string): Promise<void> => {
    const [gradesCount, attendanceCount, subjectAssignmentsCount] = await Promise.all([
      db.gradeEntries.where("studentId").equals(studentId).count(),
      db.attendanceEntries.where("studentId").equals(studentId).count(),
      db.subjectStudentLinks.where("studentId").equals(studentId).count()
    ]);

    const dependencies = [
      `notas:${gradesCount}`,
      `asistencia:${attendanceCount}`,
      `asignaciones_asignatura:${subjectAssignmentsCount}`
    ].filter((item) => Number(item.split(":")[1]) > 0);

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

    await db.transaction("rw", db.subjects, db.subjectCourseLinks, async () => {
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

      const currentLinks = await db.subjectCourseLinks.where("subjectId").equals(subjectId).toArray();
      const currentByCourse = new Map(currentLinks.map((item) => [item.classId, item]));
      const nextSet = new Set(uniqueCourseIds);

      for (const link of currentLinks) {
        if (!nextSet.has(link.classId)) {
          await db.subjectCourseLinks.delete(link.id);
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
    });

    setNotice("Asignatura actualizada.");
    await loadAll();
  };

  const deleteSubject = async (subjectId: string): Promise<void> => {
    const [linksCount, studentLinksCount, unitsCount] = await Promise.all([
      db.subjectCourseLinks.where("subjectId").equals(subjectId).count(),
      db.subjectStudentLinks.where("subjectId").equals(subjectId).count(),
      db.unitBlocks.where("subjectId").equals(subjectId).count()
    ]);

    const dependencies = [
      `vinculos_curso:${linksCount}`,
      `asignaciones_alumno:${studentLinksCount}`,
      `unidades:${unitsCount}`
    ].filter((item) => Number(item.split(":")[1]) > 0);

    if (dependencies.length > 0) {
      setNotice(
        `No se puede eliminar la asignatura porque tiene dependencias (${dependencies.join(
          ", "
        )}).`
      );
      return;
    }

    await db.transaction("rw", db.classGroups, db.subjects, async () => {
      const legacyRefs = await db.classGroups.where("subjectId").equals(subjectId).toArray();
      for (const group of legacyRefs) {
        await db.classGroups.put({
          ...group,
          subjectId: undefined
        });
      }
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
    await db.scheduleDays.put(day);
    await loadAll();
  };

  const updateScheduleSettings = async (settings: ScheduleSettings): Promise<void> => {
    await db.scheduleSettings.put(settings);
    await loadAll();
  };

  const createDefaultScheduleDays = async (): Promise<void> => {
    const existingCount = await db.scheduleDays.count();
    if (existingCount > 0) {
      return;
    }
    const baseDays: ScheduleDay[] = [
      { id: "mon", dayOfWeek: 1, dayName: "Lunes", enabled: true, blocks: [] },
      { id: "tue", dayOfWeek: 2, dayName: "Martes", enabled: true, blocks: [] },
      { id: "wed", dayOfWeek: 3, dayName: "Miercoles", enabled: true, blocks: [] },
      { id: "thu", dayOfWeek: 4, dayName: "Jueves", enabled: true, blocks: [] },
      { id: "fri", dayOfWeek: 5, dayName: "Viernes", enabled: true, blocks: [] },
      { id: "sat", dayOfWeek: 6, dayName: "Sabado", enabled: false, blocks: [] },
      { id: "sun", dayOfWeek: 7, dayName: "Domingo", enabled: false, blocks: [] }
    ];
    await db.scheduleDays.bulkPut(baseDays);
    if (!(await db.scheduleSettings.get("default"))) {
      await db.scheduleSettings.put({
        id: "default",
        defaultBlockDurationMinutes: 50
      });
    }
    setNotice("Dias del horario creados.");
    await loadAll();
  };

  const createUnit = async (
    subjectId: string,
    nameValue: string,
    descriptionValue: string,
    startDate: string,
    endDate: string,
    sessionCountValue: number
  ): Promise<void> => {
    const name = nameValue.trim();
    const description = descriptionValue.trim();
    const sessionCount = Math.max(1, Math.round(sessionCountValue));
    if (!subjectId || name.length < 2 || !startDate || !endDate) {
      setNotice("La unidad necesita asignatura, nombre y fechas.");
      return;
    }
    const currentUnits = await db.unitBlocks.where("subjectId").equals(subjectId).toArray();
    const maxPosition = currentUnits.reduce((max, item) => Math.max(max, item.position), 0);
    await db.unitBlocks.add({
      id: crypto.randomUUID(),
      subjectId,
      name,
      description,
      startDate,
      endDate,
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
    const today = new Date().toISOString().slice(0, 10);
    const id = crypto.randomUUID();
    await db.unitBlocks.add({
      id,
      subjectId,
      name: "",
      description: "",
      startDate: today,
      endDate: today,
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
    startDate: string,
    endDate: string,
    sessionCountValue: number
  ): Promise<void> => {
    const name = nameValue.trim();
    const description = descriptionValue.trim();
    const sessionCount = Math.max(1, Math.round(sessionCountValue));
    if (name.length < 2 || !startDate || !endDate) {
      setNotice("La unidad necesita nombre y fechas.");
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
      startDate,
      endDate,
      sessionCount
    });
    setNotice("Unidad actualizada.");
    await loadAll();
  };

  const deleteUnit = async (unitId: string): Promise<void> => {
    await db.unitBlocks.delete(unitId);
    setNotice("Unidad eliminada.");
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
    moveStudent: (...args) => runWithProgress(() => moveStudent(...args)),
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
    createDefaultScheduleDays: (...args) => runWithProgress(() => createDefaultScheduleDays(...args)),
    createUnit: (...args) => runWithProgress(() => createUnit(...args)),
    createEmptyUnit: (...args) => runWithProgress(() => createEmptyUnit(...args)),
    updateUnit: (...args) => runWithProgress(() => updateUnit(...args)),
    deleteUnit: (...args) => runWithProgress(() => deleteUnit(...args))
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
