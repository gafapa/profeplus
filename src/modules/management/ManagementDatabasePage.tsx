import { useRef, useState } from "react";
import { useAppDispatch } from "../../app/hooks";
import { hydrateAppPreferences } from "../../app/store";
import { db } from "../../shared/db/database";
import { Modal } from "../../shared/ui/Modal";
import { useManagement } from "./ManagementContext";

// ---------------------------------------------------------------------------
// Datos de prueba — solo disponible en desarrollo
// ---------------------------------------------------------------------------
async function seedDatabase(): Promise<void> {
  const uid = () => crypto.randomUUID();

  // Limpiar todo antes de insertar datos frescos
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });

  // ── Cursos ──────────────────────────────────────────────────────────────
  const curso1Id = uid();
  const curso2Id = uid();
  await db.classGroups.bulkPut([
    { id: curso1Id, name: "1º ESO A", level: "1 ESO", schoolYear: "2025-2026" },
    { id: curso2Id, name: "2º ESO B", level: "2 ESO", schoolYear: "2025-2026" }
  ]);

  // ── Alumnos ──────────────────────────────────────────────────────────────
  const lista1 = [
    { firstName: "Lucía",     lastName: "Martínez García"  },
    { firstName: "Alejandro", lastName: "López Fernández"  },
    { firstName: "Sofía",     lastName: "González Ruiz"    },
    { firstName: "Daniel",    lastName: "Sánchez Moreno"   },
    { firstName: "María",     lastName: "Rodríguez Díaz"   }
  ];
  const lista2 = [
    { firstName: "Pablo",  lastName: "Jiménez Álvarez" },
    { firstName: "Carmen", lastName: "Romero Torres"   },
    { firstName: "Adrián", lastName: "Navarro Molina"  },
    { firstName: "Elena",  lastName: "Serrano Castro"  },
    { firstName: "Javier", lastName: "Morales Vega"    }
  ];
  const ids1 = lista1.map(() => uid());
  const ids2 = lista2.map(() => uid());
  await db.students.bulkPut([
    ...lista1.map((a, i) => ({ id: ids1[i], classId: curso1Id, firstName: a.firstName, lastName: a.lastName, fullName: `${a.firstName} ${a.lastName}` })),
    ...lista2.map((a, i) => ({ id: ids2[i], classId: curso2Id, firstName: a.firstName, lastName: a.lastName, fullName: `${a.firstName} ${a.lastName}` }))
  ]);
  const todosIds = [...ids1, ...ids2];

  // ── Horario ──────────────────────────────────────────────────────────────
  // 6 bloques por día, L–V. Los IDs de bloque serán referenciados por asignaturas y sesiones.
  const franjas = [
    { start: "08:00", end: "08:55" },
    { start: "08:55", end: "09:50" },
    { start: "09:50", end: "10:45" },
    { start: "11:05", end: "12:00" }, // tras recreo
    { start: "12:00", end: "12:55" },
    { start: "12:55", end: "13:50" }
  ];
  const dias = [
    { dow: 1, name: "Lunes"    },
    { dow: 2, name: "Martes"   },
    { dow: 3, name: "Miércoles"},
    { dow: 4, name: "Jueves"   },
    { dow: 5, name: "Viernes"  }
  ];

  // slotMap[dow][franja] → blockId
  const slotMap: Record<number, string[]> = {};
  const scheduleDaysData = dias.map(({ dow, name }) => {
    slotMap[dow] = franjas.map(() => uid());
    return {
      id: uid(),
      dayOfWeek: dow,
      dayName: name,
      enabled: true,
      blocks: franjas.map((f, fi) => ({ id: slotMap[dow][fi], startTime: f.start, endTime: f.end }))
    };
  });
  await db.scheduleDays.bulkPut(scheduleDaysData);
  await db.scheduleSettings.put({ id: "default", defaultBlockDurationMinutes: 55 });

  // ── Asignaturas  (con scheduleSlotIds ya asignados) ───────────────────────
  // Mat: L[0] M[0] X[1] J[0]   →  4 h/semana
  // Len: L[1] M[1] J[1] V[0]   →  4 h/semana
  // Ing: L[2] X[2] V[1]        →  3 h/semana
  const matSlots = [slotMap[1][0], slotMap[2][0], slotMap[3][1], slotMap[4][0]];
  const lenSlots = [slotMap[1][1], slotMap[2][1], slotMap[4][1], slotMap[5][0]];
  const ingSlots = [slotMap[1][2], slotMap[3][2], slotMap[5][1]];

  const matId = uid();
  const lenId = uid();
  const ingId = uid();
  await db.subjects.bulkPut([
    { id: matId, name: "Matemáticas",       teachingHours: "4", scheduleSlotIds: matSlots },
    { id: lenId, name: "Lengua Castellana", teachingHours: "4", scheduleSlotIds: lenSlots },
    { id: ingId, name: "Inglés",            teachingHours: "3", scheduleSlotIds: ingSlots }
  ]);

  // ── Asignatura ↔ Curso / Alumno ───────────────────────────────────────────
  await db.subjectCourseLinks.bulkPut([
    { id: uid(), subjectId: matId, classId: curso1Id },
    { id: uid(), subjectId: matId, classId: curso2Id },
    { id: uid(), subjectId: lenId, classId: curso1Id },
    { id: uid(), subjectId: lenId, classId: curso2Id },
    { id: uid(), subjectId: ingId, classId: curso1Id },
    { id: uid(), subjectId: ingId, classId: curso2Id }
  ]);
  await db.subjectStudentLinks.bulkPut(
    [matId, lenId, ingId].flatMap((subjectId) =>
      todosIds.map((studentId) => ({ id: uid(), subjectId, studentId }))
    )
  );

  // ── Unidades ──────────────────────────────────────────────────────────────
  const unidades = [
    { subjectId: matId, name: "Números y operaciones",  desc: "Repaso de aritmética y fracciones",   sessions: 8  },
    { subjectId: matId, name: "Álgebra básica",         desc: "Ecuaciones de primer grado",           sessions: 10 },
    { subjectId: matId, name: "Geometría",              desc: "Figuras planas y sólidos geométricos", sessions: 7  },
    { subjectId: lenId, name: "Comprensión lectora",    desc: "Textos narrativos y expositivos",      sessions: 6  },
    { subjectId: lenId, name: "Gramática",              desc: "Morfología y sintaxis básica",         sessions: 9  },
    { subjectId: lenId, name: "Expresión escrita",      desc: "Técnicas de redacción y coherencia",   sessions: 7  },
    { subjectId: ingId, name: "Present & Past Tenses",  desc: "Simple, continuous, perfect",          sessions: 8  },
    { subjectId: ingId, name: "Vocabulary: Daily Life", desc: "Routines, hobbies, travel",            sessions: 6  }
  ];
  const unitIds = unidades.map(() => uid());
  await db.unitBlocks.bulkPut(
    unidades.map((u, i) => ({
      id: unitIds[i],
      subjectId: u.subjectId,
      name: u.name,
      description: u.desc,
      sessionCount: u.sessions,
      position: i
    }))
  );

  // ── Tareas ────────────────────────────────────────────────────────────────
  // Fechas relativas a hoy para que las sesiones aparezcan en el planificador
  const today = new Date();
  const dateStr = (offset: number): string => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const t1Id = uid(); // Examen Mat U1
  const t2Id = uid(); // Redacción libre
  const t3Id = uid(); // Ejercicios álgebra
  const t4Id = uid(); // Listening inglés
  const t5Id = uid(); // Comprensión lectora

  await db.tasks.bulkPut([
    {
      id: t1Id,
      title: "Examen U1 — Números",
      description: "Prueba escrita sobre aritmética y fracciones. Calculadora no permitida.",
      sessionCount: 1,
      sendToGradebook: true
    },
    {
      id: t2Id,
      title: "Redacción libre",
      description: "Texto narrativo de 300 palabras sobre un recuerdo de infancia.",
      sessionCount: 1,
      sendToGradebook: true
    },
    {
      id: t3Id,
      title: "Ejercicios: ecuaciones de 1er grado",
      description: "Hoja de ejercicios sobre resolución de ecuaciones lineales.",
      sessionCount: 1,
      sendToGradebook: false
    },
    {
      id: t4Id,
      title: "Listening: Daily routines",
      description: "Actividad de comprensión oral con audio. Responder cuestionario.",
      sessionCount: 1,
      sendToGradebook: true
    },
    {
      id: t5Id,
      title: "Lectura: texto expositivo",
      description: "Lectura y análisis de un texto expositivo sobre el cambio climático.",
      sessionCount: 1,
      sendToGradebook: false
    }
  ]);

  // taskSubjectLinks (con unidad cuando aplica)
  await db.taskSubjectLinks.bulkPut([
    { id: uid(), taskId: t1Id, subjectId: matId, unitId: unitIds[0] }, // U1 Mat
    { id: uid(), taskId: t2Id, subjectId: lenId, unitId: unitIds[5] }, // U3 Len (expresión escrita)
    { id: uid(), taskId: t3Id, subjectId: matId, unitId: unitIds[1] }, // U2 Mat
    { id: uid(), taskId: t4Id, subjectId: ingId, unitId: unitIds[6] }, // U1 Ing
    { id: uid(), taskId: t5Id, subjectId: lenId, unitId: unitIds[3] }  // U1 Len
  ]);

  // ── Sesiones de tareas ────────────────────────────────────────────────────
  // Distribuimos sesiones en las últimas 2 semanas + próximos días
  // Mat L[0] slot → Lunes; Len L[1] → Lunes; Ing L[2] → Lunes
  const sessions: {
    taskId: string; subjectId: string; classId: string; date: string; scheduleSlotId: string;
  }[] = [
    // Examen Mat (t1) — pasado (–14 días, lunes)
    { taskId: t1Id, subjectId: matId, classId: curso1Id, date: dateStr(-14), scheduleSlotId: slotMap[1][0] },
    { taskId: t1Id, subjectId: matId, classId: curso2Id, date: dateStr(-14), scheduleSlotId: slotMap[1][0] },
    // Redacción (t2) — pasado (–7 días, lunes)
    { taskId: t2Id, subjectId: lenId, classId: curso1Id, date: dateStr(-7),  scheduleSlotId: slotMap[1][1] },
    { taskId: t2Id, subjectId: lenId, classId: curso2Id, date: dateStr(-7),  scheduleSlotId: slotMap[1][1] },
    // Ejercicios álgebra (t3) — ayer / hoy aprox (–2, miércoles → slot X[1])
    { taskId: t3Id, subjectId: matId, classId: curso1Id, date: dateStr(-2),  scheduleSlotId: slotMap[3][1] },
    { taskId: t3Id, subjectId: matId, classId: curso2Id, date: dateStr(-2),  scheduleSlotId: slotMap[3][1] },
    // Listening inglés (t4) — próxima semana (lunes +3 días)
    { taskId: t4Id, subjectId: ingId, classId: curso1Id, date: dateStr(3),   scheduleSlotId: slotMap[1][2] },
    { taskId: t4Id, subjectId: ingId, classId: curso2Id, date: dateStr(3),   scheduleSlotId: slotMap[1][2] },
    // Texto expositivo (t5) — esta semana (martes +1)
    { taskId: t5Id, subjectId: lenId, classId: curso1Id, date: dateStr(1),   scheduleSlotId: slotMap[2][1] },
    { taskId: t5Id, subjectId: lenId, classId: curso2Id, date: dateStr(1),   scheduleSlotId: slotMap[2][1] }
  ];
  await db.taskSessions.bulkPut(
    sessions.map((s) => ({ id: uid(), ...s }))
  );
}

type DatabaseExportPayload = {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
};

const DATABASE_SCHEMA_VERSION = 4;
const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024;

function buildBackupFileName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `profeplus-backup-${stamp}.json`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireString(row: Record<string, unknown>, tableName: string, fieldName: string): string {
  const value = row[fieldName];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`La tabla '${tableName}' contiene filas sin '${fieldName}' válido.`);
  }
  return value;
}

function requireText(row: Record<string, unknown>, tableName: string, fieldName: string): void {
  if (typeof row[fieldName] !== "string") {
    throw new Error(`La tabla '${tableName}' contiene filas sin '${fieldName}' válido.`);
  }
}

function requireNumber(row: Record<string, unknown>, tableName: string, fieldName: string): void {
  const value = row[fieldName];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`La tabla '${tableName}' contiene filas sin '${fieldName}' numérico válido.`);
  }
}

function requireBoolean(row: Record<string, unknown>, tableName: string, fieldName: string): void {
  if (typeof row[fieldName] !== "boolean") {
    throw new Error(`La tabla '${tableName}' contiene filas sin '${fieldName}' booleano válido.`);
  }
}

function optionalString(row: Record<string, unknown>, tableName: string, fieldName: string): string | undefined {
  const value = row[fieldName];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`La tabla '${tableName}' contiene '${fieldName}' no válido.`);
  }
  return value;
}

function requireReference(
  value: string | undefined,
  targetIds: Set<string>,
  tableName: string,
  fieldName: string
): void {
  if (value && !targetIds.has(value)) {
    throw new Error(`La tabla '${tableName}' referencia '${fieldName}' inexistente: ${value}.`);
  }
}

function validateDatabasePayload(parsed: unknown): Record<string, unknown[]> {
  if (!isPlainObject(parsed)) {
    throw new Error("El archivo no contiene una copia de seguridad valida.");
  }
  if (parsed.app !== "ProfePlus") {
    throw new Error("El archivo no pertenece a ProfePlus.");
  }
  const schemaVersion = Number(parsed.schemaVersion ?? DATABASE_SCHEMA_VERSION);
  if (!Number.isInteger(schemaVersion) || ![3, DATABASE_SCHEMA_VERSION].includes(schemaVersion)) {
    throw new Error("La copia de seguridad no pertenece al esquema actual.");
  }
  if (!isPlainObject(parsed.tables)) {
    throw new Error("El archivo no contiene un bloque 'tables' válido.");
  }

  const tableNames = new Set(db.tables.map((table) => table.name));
  const unknownTables = Object.keys(parsed.tables).filter((tableName) => !tableNames.has(tableName));
  if (unknownTables.length > 0) {
    throw new Error(`El archivo contiene tablas desconocidas: ${unknownTables.join(", ")}.`);
  }

  const validatedTables: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    const rows = parsed.tables[table.name];
    if (schemaVersion === 3 && table.name === "appPreferences" && rows === undefined) {
      validatedTables[table.name] = [];
      continue;
    }
    if (rows === undefined) {
      throw new Error(`El archivo no contiene la tabla '${table.name}'.`);
    }
    if (!Array.isArray(rows)) {
      throw new Error(`La tabla '${table.name}' no contiene una lista de filas valida.`);
    }
    const ids = new Set<string>();
    for (const row of rows) {
      if (!isPlainObject(row) || typeof row.id !== "string" || row.id.trim().length === 0) {
        throw new Error(`La tabla '${table.name}' contiene filas sin id válido.`);
      }
      if (ids.has(row.id)) {
        throw new Error(`La tabla '${table.name}' contiene ids duplicados: ${row.id}.`);
      }
      ids.add(row.id);
    }
    validatedTables[table.name] = rows;
  }

  const rows = (tableName: string): Record<string, unknown>[] =>
    (validatedTables[tableName] ?? []) as Record<string, unknown>[];
  const ids = (tableName: string): Set<string> => new Set(rows(tableName).map((row) => row.id as string));

  const classIds = ids("classGroups");
  const subjectIds = ids("subjects");
  const studentIds = ids("students");
  const unitIds = ids("unitBlocks");
  const taskIds = ids("tasks");
  const assessmentIds = ids("assessments");
  const gradebookGroupIds = ids("gradebookGroups");
  const rubricTemplateIds = ids("rubricTemplates");
  const checklistTemplateIds = ids("checklistTemplates");

  for (const row of rows("classGroups")) {
    requireText(row, "classGroups", "name");
    requireString(row, "classGroups", "level");
    requireString(row, "classGroups", "schoolYear");
  }
  for (const row of rows("students")) {
    if ("classIds" in row) {
      throw new Error("La tabla 'students' usa el campo antiguo 'classIds'.");
    }
    requireReference(requireString(row, "students", "classId"), classIds, "students", "classId");
    requireText(row, "students", "firstName");
    requireText(row, "students", "lastName");
    requireText(row, "students", "fullName");
    optionalString(row, "students", "comments");
  }
  for (const row of rows("subjects")) {
    requireText(row, "subjects", "name");
  }
  for (const row of rows("subjectCourseLinks")) {
    requireReference(requireString(row, "subjectCourseLinks", "subjectId"), subjectIds, "subjectCourseLinks", "subjectId");
    requireReference(requireString(row, "subjectCourseLinks", "classId"), classIds, "subjectCourseLinks", "classId");
  }
  for (const row of rows("subjectStudentLinks")) {
    requireReference(requireString(row, "subjectStudentLinks", "subjectId"), subjectIds, "subjectStudentLinks", "subjectId");
    requireReference(requireString(row, "subjectStudentLinks", "studentId"), studentIds, "subjectStudentLinks", "studentId");
  }
  for (const row of rows("unitBlocks")) {
    requireReference(requireString(row, "unitBlocks", "subjectId"), subjectIds, "unitBlocks", "subjectId");
    requireText(row, "unitBlocks", "name");
    requireText(row, "unitBlocks", "description");
    requireNumber(row, "unitBlocks", "sessionCount");
    requireNumber(row, "unitBlocks", "position");
  }
  for (const row of rows("tasks")) {
    requireText(row, "tasks", "title");
    requireText(row, "tasks", "description");
    requireNumber(row, "tasks", "sessionCount");
    requireBoolean(row, "tasks", "sendToGradebook");
  }
  for (const row of rows("taskSubjectLinks")) {
    requireReference(requireString(row, "taskSubjectLinks", "taskId"), taskIds, "taskSubjectLinks", "taskId");
    requireReference(requireString(row, "taskSubjectLinks", "subjectId"), subjectIds, "taskSubjectLinks", "subjectId");
    requireReference(optionalString(row, "taskSubjectLinks", "unitId"), unitIds, "taskSubjectLinks", "unitId");
  }
  for (const row of rows("taskGradebookConfigs")) {
    requireReference(requireString(row, "taskGradebookConfigs", "taskId"), taskIds, "taskGradebookConfigs", "taskId");
    requireReference(requireString(row, "taskGradebookConfigs", "subjectId"), subjectIds, "taskGradebookConfigs", "subjectId");
    requireReference(requireString(row, "taskGradebookConfigs", "classId"), classIds, "taskGradebookConfigs", "classId");
    requireNumber(row, "taskGradebookConfigs", "gradebookWeight");
    requireReference(optionalString(row, "taskGradebookConfigs", "groupId"), gradebookGroupIds, "taskGradebookConfigs", "groupId");
    requireReference(optionalString(row, "taskGradebookConfigs", "rubricTemplateId"), rubricTemplateIds, "taskGradebookConfigs", "rubricTemplateId");
    requireReference(optionalString(row, "taskGradebookConfigs", "checklistTemplateId"), checklistTemplateIds, "taskGradebookConfigs", "checklistTemplateId");
  }
  for (const row of rows("gradebookGroups")) {
    requireReference(requireString(row, "gradebookGroups", "classId"), classIds, "gradebookGroups", "classId");
    requireReference(requireString(row, "gradebookGroups", "subjectId"), subjectIds, "gradebookGroups", "subjectId");
    requireReference(optionalString(row, "gradebookGroups", "parentId"), gradebookGroupIds, "gradebookGroups", "parentId");
    requireString(row, "gradebookGroups", "name");
    requireNumber(row, "gradebookGroups", "position");
  }
  for (const row of rows("assessments")) {
    requireReference(requireString(row, "assessments", "classId"), classIds, "assessments", "classId");
    requireReference(requireString(row, "assessments", "subjectId"), subjectIds, "assessments", "subjectId");
    requireReference(optionalString(row, "assessments", "groupId"), gradebookGroupIds, "assessments", "groupId");
    requireString(row, "assessments", "title");
    requireNumber(row, "assessments", "weight");
  }
  for (const row of rows("gradeEntries")) {
    requireReference(requireString(row, "gradeEntries", "classId"), classIds, "gradeEntries", "classId");
    requireReference(requireString(row, "gradeEntries", "assessmentId"), assessmentIds, "gradeEntries", "assessmentId");
    requireReference(requireString(row, "gradeEntries", "studentId"), studentIds, "gradeEntries", "studentId");
  }
  for (const row of rows("attendanceEntries")) {
    requireReference(requireString(row, "attendanceEntries", "classId"), classIds, "attendanceEntries", "classId");
    requireReference(requireString(row, "attendanceEntries", "studentId"), studentIds, "attendanceEntries", "studentId");
  }
  for (const row of rows("rubricTemplates")) {
    requireReference(requireString(row, "rubricTemplates", "classId"), classIds, "rubricTemplates", "classId");
    requireReference(optionalString(row, "rubricTemplates", "taskId"), taskIds, "rubricTemplates", "taskId");
  }
  for (const row of rows("checklistTemplates")) {
    requireReference(requireString(row, "checklistTemplates", "classId"), classIds, "checklistTemplates", "classId");
    requireReference(optionalString(row, "checklistTemplates", "taskId"), taskIds, "checklistTemplates", "taskId");
  }
  for (const row of rows("taskSessions")) {
    requireReference(requireString(row, "taskSessions", "taskId"), taskIds, "taskSessions", "taskId");
    requireReference(requireString(row, "taskSessions", "subjectId"), subjectIds, "taskSessions", "subjectId");
    requireReference(requireString(row, "taskSessions", "classId"), classIds, "taskSessions", "classId");
  }
  for (const row of rows("taskStudentComments")) {
    requireReference(requireString(row, "taskStudentComments", "taskId"), taskIds, "taskStudentComments", "taskId");
    requireReference(requireString(row, "taskStudentComments", "studentId"), studentIds, "taskStudentComments", "studentId");
  }
  for (const row of rows("taskDailyEvaluationSettings")) {
    requireReference(requireString(row, "taskDailyEvaluationSettings", "taskId"), taskIds, "taskDailyEvaluationSettings", "taskId");
  }
  for (const row of rows("taskRubricAssessments")) {
    requireReference(requireString(row, "taskRubricAssessments", "taskId"), taskIds, "taskRubricAssessments", "taskId");
    requireReference(requireString(row, "taskRubricAssessments", "studentId"), studentIds, "taskRubricAssessments", "studentId");
    requireReference(requireString(row, "taskRubricAssessments", "rubricTemplateId"), rubricTemplateIds, "taskRubricAssessments", "rubricTemplateId");
  }
  for (const row of rows("taskChecklistAssessments")) {
    requireReference(requireString(row, "taskChecklistAssessments", "taskId"), taskIds, "taskChecklistAssessments", "taskId");
    requireReference(requireString(row, "taskChecklistAssessments", "studentId"), studentIds, "taskChecklistAssessments", "studentId");
    requireReference(requireString(row, "taskChecklistAssessments", "checklistTemplateId"), checklistTemplateIds, "taskChecklistAssessments", "checklistTemplateId");
  }
  for (const row of rows("appPreferences")) {
    if (row.id !== "default") {
      throw new Error("La tabla 'appPreferences' contiene un id no válido.");
    }
    const studentSortBy = row.studentSortBy;
    const studentNameFormat = row.studentNameFormat;
    const weekStartsOn = row.weekStartsOn;
    if (studentSortBy !== "lastName" && studentSortBy !== "firstName") {
      throw new Error("La tabla 'appPreferences' contiene 'studentSortBy' no válido.");
    }
    if (studentNameFormat !== "firstLast" && studentNameFormat !== "lastFirst") {
      throw new Error("La tabla 'appPreferences' contiene 'studentNameFormat' no válido.");
    }
    if (weekStartsOn !== "monday" && weekStartsOn !== "sunday") {
      throw new Error("La tabla 'appPreferences' contiene 'weekStartsOn' no válido.");
    }
  }
  return validatedTables;
}

export function ManagementDatabasePage() {
  const dispatch = useAppDispatch();
  const { setNotice, refreshAll } = useManagement();
  const [isBusy, setIsBusy] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const runDatabaseAction = async (action: () => Promise<void>): Promise<void> => {
    setIsBusy(true);
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setNotice(`Operación de base de datos fallida: ${message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const exportDatabase = async (): Promise<void> => {
    await runDatabaseAction(async () => {
      const tables: Record<string, unknown[]> = {};
      for (const table of db.tables) {
        const rows = await table.toArray();
        tables[table.name] =
          table.name === "tasks"
            ? rows.map((row) =>
                isPlainObject(row)
                  ? {
                      ...row,
                      sessionCount:
                        typeof row.sessionCount === "number" && Number.isFinite(row.sessionCount)
                          ? Math.max(1, Math.round(row.sessionCount))
                          : 1
                    }
                  : row
              )
            : rows;
      }
      const payload: DatabaseExportPayload = {
        app: "ProfePlus",
        schemaVersion: DATABASE_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        tables
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = buildBackupFileName();
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        URL.revokeObjectURL(downloadUrl);
      }
      setNotice("Base de datos exportada.");
    });
  };

  const importDatabaseFromFile = async (file: File): Promise<void> => {
    await runDatabaseAction(async () => {
      if (file.size > MAX_IMPORT_FILE_BYTES) {
        throw new Error("El archivo es demasiado grande para importarlo de forma segura.");
      }
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("El archivo no es JSON válido.");
      }

      const tablesData = validateDatabasePayload(parsed);
      await db.transaction("rw", db.tables, async () => {
        for (const table of db.tables) {
          await table.clear();
        }
        for (const table of db.tables) {
          const rows = tablesData[table.name];
          if (rows.length > 0) {
            await table.bulkPut(rows as object[]);
          }
        }
      });

      await refreshAll();
      const preferences = await db.appPreferences.get("default");
      if (preferences) {
        dispatch(hydrateAppPreferences(preferences));
      }
      setNotice("Base de datos importada.");
    });
  };
  const deleteAllDatabase = async (): Promise<void> => {
    await runDatabaseAction(async () => {
      await db.transaction("rw", db.tables, async () => {
        for (const table of db.tables) {
          await table.clear();
        }
      });
      await refreshAll();
      setNotice("Todos los datos de la base han sido eliminados.");
      setShowDeleteAllModal(false);
    });
  };

  return (
    <>
      <article className="management-card">
        <p className="hint">Exporta, importa o borra todos los datos de la app.</p>

        {import.meta.env.DEV && (
          <div className="inline-form">
            <button
              type="button"
              className="btn secondary"
              disabled={isBusy}
              onClick={() =>
                void runDatabaseAction(async () => {
                  await seedDatabase();
                  await refreshAll();
                  setNotice("Datos de prueba cargados.");
                })
              }
            >
              Cargar datos de prueba
            </button>
          </div>
        )}

        <div className="inline-form">
          <button
            type="button"
            className="btn secondary"
            disabled={isBusy}
            onClick={() => void exportDatabase()}
          >
            Exportar
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={isBusy}
            onClick={() => importInputRef.current?.click()}
          >
            Importar
          </button>
          <button
            type="button"
            className="btn secondary management-danger-btn"
            disabled={isBusy}
            onClick={() => setShowDeleteAllModal(true)}
          >
            Borrar todo
          </button>
        </div>

        <input
          ref={importInputRef}
          className="student-photo-input-hidden"
          type="file"
          accept="application/json,.json"
          disabled={isBusy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (!file) {
              return;
            }
            void importDatabaseFromFile(file);
          }}
        />

        {isBusy ? (
          <div className="management-progress" role="status" aria-label="Procesando base de datos">
            <div className="management-progress-bar" />
          </div>
        ) : null}
      </article>

      <Modal
        open={showDeleteAllModal}
        title="Borrar toda la base de datos"
        onClose={() => {
          if (!isBusy) {
            setShowDeleteAllModal(false);
          }
        }}
      >
        <p>Se eliminarán todos los datos de la app. Esta acción no se puede deshacer.</p>
        <div className="inline-form">
          <button
            type="button"
            className="btn secondary"
            disabled={isBusy}
            onClick={() => setShowDeleteAllModal(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn secondary management-danger-btn"
            disabled={isBusy}
            onClick={() => void deleteAllDatabase()}
          >
            Borrar todo
          </button>
        </div>
      </Modal>
    </>
  );
}
