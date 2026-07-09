import { useRef, useState } from "react";
import { useAppDispatch } from "../../app/hooks";
import { hydrateAppPreferences } from "../../app/store";
import { db } from "../../shared/db/database";
import { defaultScheduleDays } from "../../shared/schedule/weekDays";
import { Modal } from "../../shared/ui/Modal";
import { useManagement } from "./ManagementContext";

async function seedDatabase(): Promise<void> {
  const uid = () => crypto.randomUUID();

  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });

  const course1Id = uid();
  const course2Id = uid();
  await db.classGroups.bulkPut([
    { id: course1Id, name: "1º ESO A", level: "1 ESO", schoolYear: "2025-2026" },
    { id: course2Id, name: "2º ESO B", level: "2 ESO", schoolYear: "2025-2026" }
  ]);

  const course1Students = [
    { firstName: "Lucía",     lastName: "Martínez García"  },
    { firstName: "Alejandro", lastName: "López Fernández"  },
    { firstName: "Sofía",     lastName: "González Ruiz"    },
    { firstName: "Daniel",    lastName: "Sánchez Moreno"   },
    { firstName: "María",     lastName: "Rodríguez Díaz"   }
  ];
  const course2Students = [
    { firstName: "Pablo",  lastName: "Jiménez Álvarez" },
    { firstName: "Carmen", lastName: "Romero Torres"   },
    { firstName: "Adrián", lastName: "Navarro Molina"  },
    { firstName: "Elena",  lastName: "Serrano Castro"  },
    { firstName: "Javier", lastName: "Morales Vega"    }
  ];
  const course1StudentIds = course1Students.map(() => uid());
  const course2StudentIds = course2Students.map(() => uid());
  await db.students.bulkPut([
    ...course1Students.map((student, index) => ({ id: course1StudentIds[index], classId: course1Id, firstName: student.firstName, lastName: student.lastName, fullName: `${student.firstName} ${student.lastName}` })),
    ...course2Students.map((student, index) => ({ id: course2StudentIds[index], classId: course2Id, firstName: student.firstName, lastName: student.lastName, fullName: `${student.firstName} ${student.lastName}` }))
  ]);
  const allStudentIds = [...course1StudentIds, ...course2StudentIds];

  const timeSlots = [
    { start: "08:00", end: "08:55" },
    { start: "08:55", end: "09:50" },
    { start: "09:50", end: "10:45" },
    { start: "11:05", end: "12:00" },
    { start: "12:00", end: "12:55" },
    { start: "12:55", end: "13:50" }
  ];
  const slotMap: Record<number, string[]> = {};
  const scheduleDaysData = defaultScheduleDays().map((day) => {
    if (!day.enabled) {
      return day;
    }
    slotMap[day.dayOfWeek] = timeSlots.map(() => uid());
    return {
      ...day,
      id: uid(),
      blocks: timeSlots.map((slot, slotIndex) => ({
        id: slotMap[day.dayOfWeek][slotIndex],
        startTime: slot.start,
        endTime: slot.end
      }))
    };
  });
  await db.scheduleDays.bulkPut(scheduleDaysData);
  await db.scheduleSettings.put({ id: "default", defaultBlockDurationMinutes: 55 });

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

  await db.subjectCourseLinks.bulkPut([
    { id: uid(), subjectId: matId, classId: course1Id },
    { id: uid(), subjectId: matId, classId: course2Id },
    { id: uid(), subjectId: lenId, classId: course1Id },
    { id: uid(), subjectId: lenId, classId: course2Id },
    { id: uid(), subjectId: ingId, classId: course1Id },
    { id: uid(), subjectId: ingId, classId: course2Id }
  ]);
  await db.subjectStudentLinks.bulkPut(
    [matId, lenId, ingId].flatMap((subjectId) =>
      allStudentIds.map((studentId) => ({ id: uid(), subjectId, studentId }))
    )
  );

  const units = [
    { subjectId: matId, name: "Números y operaciones",  desc: "Repaso de aritmética y fracciones",   sessions: 8  },
    { subjectId: matId, name: "Álgebra básica",         desc: "Ecuaciones de primer grado",           sessions: 10 },
    { subjectId: matId, name: "Geometría",              desc: "Figuras planas y sólidos geométricos", sessions: 7  },
    { subjectId: lenId, name: "Comprensión lectora",    desc: "Textos narrativos y expositivos",      sessions: 6  },
    { subjectId: lenId, name: "Gramática",              desc: "Morfología y sintaxis básica",         sessions: 9  },
    { subjectId: lenId, name: "Expresión escrita",      desc: "Técnicas de redacción y coherencia",   sessions: 7  },
    { subjectId: ingId, name: "Present & Past Tenses",  desc: "Simple, continuous, perfect",          sessions: 8  },
    { subjectId: ingId, name: "Vocabulary: Daily Life", desc: "Routines, hobbies, travel",            sessions: 6  }
  ];
  const unitIds = units.map(() => uid());
  await db.unitBlocks.bulkPut(
    units.map((unit, index) => ({
      id: unitIds[index],
      subjectId: unit.subjectId,
      name: unit.name,
      description: unit.desc,
      sessionCount: unit.sessions,
      position: index
    }))
  );

  const today = new Date();
  const dateStr = (offset: number): string => {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };

  const t1Id = uid();
  const t2Id = uid();
  const t3Id = uid();
  const t4Id = uid();
  const t5Id = uid();

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

  await db.taskSubjectLinks.bulkPut([
    { id: uid(), taskId: t1Id, subjectId: matId, unitId: unitIds[0] },
    { id: uid(), taskId: t2Id, subjectId: lenId, unitId: unitIds[5] },
    { id: uid(), taskId: t3Id, subjectId: matId, unitId: unitIds[1] },
    { id: uid(), taskId: t4Id, subjectId: ingId, unitId: unitIds[6] }, // U1 Ing
    { id: uid(), taskId: t5Id, subjectId: lenId, unitId: unitIds[3] }  // U1 Len
  ]);

  const sessions: {
    taskId: string; subjectId: string; classId: string; date: string; scheduleSlotId: string;
  }[] = [
    { taskId: t1Id, subjectId: matId, classId: course1Id, date: dateStr(-14), scheduleSlotId: slotMap[1][0] },
    { taskId: t1Id, subjectId: matId, classId: course2Id, date: dateStr(-14), scheduleSlotId: slotMap[1][0] },
    { taskId: t2Id, subjectId: lenId, classId: course1Id, date: dateStr(-7), scheduleSlotId: slotMap[1][1] },
    { taskId: t2Id, subjectId: lenId, classId: course2Id, date: dateStr(-7), scheduleSlotId: slotMap[1][1] },
    { taskId: t3Id, subjectId: matId, classId: course1Id, date: dateStr(-2), scheduleSlotId: slotMap[3][1] },
    { taskId: t3Id, subjectId: matId, classId: course2Id, date: dateStr(-2), scheduleSlotId: slotMap[3][1] },
    { taskId: t4Id, subjectId: ingId, classId: course1Id, date: dateStr(3), scheduleSlotId: slotMap[1][2] },
    { taskId: t4Id, subjectId: ingId, classId: course2Id, date: dateStr(3), scheduleSlotId: slotMap[1][2] },
    { taskId: t5Id, subjectId: lenId, classId: course1Id, date: dateStr(1), scheduleSlotId: slotMap[2][1] },
    { taskId: t5Id, subjectId: lenId, classId: course2Id, date: dateStr(1), scheduleSlotId: slotMap[2][1] }
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

export const DATABASE_SCHEMA_VERSION = 7;
const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024;
const MAX_STUDENT_PHOTO_DATA_URL_CHARS = 1_500_000;
const LEGACY_TABLE_NAMES = new Set(["lessonPlans"]);

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

function requireMinNumber(row: Record<string, unknown>, tableName: string, fieldName: string, minValue: number): void {
  requireNumber(row, tableName, fieldName);
  if ((row[fieldName] as number) < minValue) {
    throw new Error(`La tabla '${tableName}' contiene '${fieldName}' por debajo de ${minValue}.`);
  }
}

function requireDateString(row: Record<string, unknown>, tableName: string, fieldName: string): string {
  const value = requireString(row, tableName, fieldName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`La tabla '${tableName}' contiene '${fieldName}' con formato de fecha no valido.`);
  }
  const [year, month, day] = value.split("-").map((part) => Number(part));
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day;
  if (!isRealDate) {
    throw new Error(`La tabla '${tableName}' contiene '${fieldName}' con una fecha inexistente.`);
  }
  return value;
}

function requireIsoDateTimeString(value: unknown, fieldName: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`La copia de seguridad contiene '${fieldName}' no válido.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    throw new Error(`La copia de seguridad contiene '${fieldName}' no válido.`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`La copia de seguridad contiene '${fieldName}' no válido.`);
  }
  const datePart = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split("-").map((part) => Number(part));
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    const isRealDate =
      parsedDate.getUTCFullYear() === year &&
      parsedDate.getUTCMonth() === month - 1 &&
      parsedDate.getUTCDate() === day;
    if (!isRealDate) {
      throw new Error(`La copia de seguridad contiene '${fieldName}' con una fecha inexistente.`);
    }
  }
}

function requireTimeString(row: Record<string, unknown>, tableName: string, fieldName: string): string {
  const value = requireString(row, tableName, fieldName);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error(`La tabla '${tableName}' contiene '${fieldName}' con formato de hora no valido.`);
  }
  return value;
}

function minutesFromTime(value: string): number {
  const [hour, minute] = value.split(":").map((part) => Number(part));
  return hour * 60 + minute;
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

function requireUniqueLogicalRows(
  tableRows: Record<string, unknown>[],
  tableName: string,
  logicalKeyName: string,
  keyForRow: (row: Record<string, unknown>) => string
): void {
  const seen = new Set<string>();
  for (const row of tableRows) {
    const key = keyForRow(row);
    if (seen.has(key)) {
      throw new Error(`La tabla '${tableName}' contiene filas duplicadas para '${logicalKeyName}'.`);
    }
    seen.add(key);
  }
}

function collectScheduleSlotIds(scheduleDays: Record<string, unknown>[]): Set<string> {
  const slotIds = new Set<string>();
  for (const day of scheduleDays) {
    if (!Array.isArray(day.blocks)) {
      continue;
    }
    for (const block of day.blocks) {
      if (isPlainObject(block) && typeof block.id === "string" && block.id.trim()) {
        slotIds.add(block.id);
      }
    }
  }
  return slotIds;
}

function validateSubjectScheduleSlots(subject: Record<string, unknown>, scheduleSlotIds: Set<string>): void {
  const value = subject.scheduleSlotIds;
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value) || value.some((slotId) => typeof slotId !== "string" || !slotId.trim())) {
    throw new Error("La tabla 'subjects' contiene 'scheduleSlotIds' no valido.");
  }
  const seen = new Set<string>();
  for (const slotId of value) {
    if (seen.has(slotId)) {
      throw new Error("La tabla 'subjects' contiene franjas de horario duplicadas.");
    }
    seen.add(slotId);
    requireReference(slotId, scheduleSlotIds, "subjects", "scheduleSlotIds");
  }
}

function validateScheduleDayRows(scheduleDays: Record<string, unknown>[]): void {
  const dayNumbers = new Set<number>();
  for (const row of scheduleDays) {
    const dayOfWeek = row.dayOfWeek as number;
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      throw new Error("La tabla 'scheduleDays' contiene 'dayOfWeek' fuera del rango 1-7.");
    }
    if (dayNumbers.has(dayOfWeek)) {
      throw new Error("La tabla 'scheduleDays' contiene dias de la semana duplicados.");
    }
    dayNumbers.add(dayOfWeek);
  }
}

function validateStudentPhotoDataUrl(row: Record<string, unknown>): void {
  const photoDataUrl = optionalString(row, "students", "photoDataUrl");
  if (!photoDataUrl) {
    return;
  }
  if (photoDataUrl.length > MAX_STUDENT_PHOTO_DATA_URL_CHARS) {
    throw new Error("La tabla 'students' contiene 'photoDataUrl' demasiado grande.");
  }
  if (!/^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(photoDataUrl)) {
    throw new Error("La tabla 'students' contiene 'photoDataUrl' no valido.");
  }
}

function validateGradebookGroupTree(groups: Record<string, unknown>[]): void {
  const byId = new Map(groups.map((group) => [group.id as string, group]));
  for (const group of groups) {
    const startId = group.id as string;
    const seen = new Set<string>();
    let currentParent = optionalString(group, "gradebookGroups", "parentId");
    while (currentParent) {
      if (currentParent === startId || seen.has(currentParent)) {
        throw new Error("La tabla 'gradebookGroups' contiene un ciclo de carpetas.");
      }
      seen.add(currentParent);
      const parent = byId.get(currentParent);
      if (!parent) {
        break;
      }
      currentParent = optionalString(parent, "gradebookGroups", "parentId");
    }
  }
}

function validateRubricLevels(levels: unknown, tableName: string): void {
  if (!Array.isArray(levels)) {
    throw new Error(`La tabla '${tableName}' contiene niveles no validos.`);
  }
  if (levels.length < 2) {
    throw new Error(`La tabla '${tableName}' contiene menos de dos niveles.`);
  }
  const levelIds = new Set<string>();
  for (const level of levels) {
    if (!isPlainObject(level)) {
      throw new Error(`La tabla '${tableName}' contiene niveles no validos.`);
    }
    const levelId = requireString(level, tableName, "id");
    if (levelIds.has(levelId)) {
      throw new Error(`La tabla '${tableName}' contiene niveles duplicados.`);
    }
    levelIds.add(levelId);
    requireString(level, tableName, "name");
    requireNumber(level, tableName, "score");
  }
}

function validateRubricTemplateShape(row: Record<string, unknown>): void {
  requireString(row, "rubricTemplates", "name");
  optionalString(row, "rubricTemplates", "description");
  if (row.criteriaCount !== undefined) {
    requireNumber(row, "rubricTemplates", "criteriaCount");
  }
  if (row.levelCount !== undefined) {
    requireNumber(row, "rubricTemplates", "levelCount");
  }
  if (row.levels !== undefined) {
    validateRubricLevels(row.levels, "rubricTemplates.levels");
  }
  if (row.criteria === undefined) {
    return;
  }
  if (!Array.isArray(row.criteria)) {
    throw new Error("La tabla 'rubricTemplates' contiene 'criteria' no valido.");
  }
  if (row.criteria.length === 0) {
    throw new Error("La tabla 'rubricTemplates' contiene una rubrica sin criterios.");
  }
  const criterionIds = new Set<string>();
  for (const criterion of row.criteria) {
    if (!isPlainObject(criterion)) {
      throw new Error("La tabla 'rubricTemplates' contiene criterios no validos.");
    }
    const criterionId = requireString(criterion, "rubricTemplates.criteria", "id");
    if (criterionIds.has(criterionId)) {
      throw new Error("La tabla 'rubricTemplates' contiene criterios duplicados.");
    }
    criterionIds.add(criterionId);
    requireString(criterion, "rubricTemplates.criteria", "name");
    optionalString(criterion, "rubricTemplates.criteria", "description");
    if (criterion.levels !== undefined) {
      validateRubricLevels(criterion.levels, "rubricTemplates.criteria.levels");
    }
  }
}

function validateChecklistTemplateShape(row: Record<string, unknown>): void {
  requireString(row, "checklistTemplates", "name");
  optionalString(row, "checklistTemplates", "description");
  if (row.items === undefined) {
    return;
  }
  if (!Array.isArray(row.items)) {
    throw new Error("La tabla 'checklistTemplates' contiene 'items' no valido.");
  }
  if (row.items.length === 0) {
    throw new Error("La tabla 'checklistTemplates' contiene una lista sin items.");
  }
  const itemIds = new Set<string>();
  for (const item of row.items) {
    if (!isPlainObject(item)) {
      throw new Error("La tabla 'checklistTemplates' contiene items no validos.");
    }
    const itemId = requireString(item, "checklistTemplates.items", "id");
    if (itemIds.has(itemId)) {
      throw new Error("La tabla 'checklistTemplates' contiene items duplicados.");
    }
    itemIds.add(itemId);
    requireString(item, "checklistTemplates.items", "text");
  }
}

export function validateDatabasePayload(parsed: unknown): Record<string, unknown[]> {
  if (!isPlainObject(parsed)) {
    throw new Error("El archivo no contiene una copia de seguridad valida.");
  }
  if (parsed.app !== "ProfePlus") {
    throw new Error("El archivo no pertenece a ProfePlus.");
  }
  const schemaVersion = Number(parsed.schemaVersion ?? DATABASE_SCHEMA_VERSION);
  if (!Number.isInteger(schemaVersion) || ![3, 4, 5, 6, DATABASE_SCHEMA_VERSION].includes(schemaVersion)) {
    throw new Error("La copia de seguridad no pertenece al esquema actual.");
  }
  requireIsoDateTimeString(parsed.exportedAt, "exportedAt");
  if (!isPlainObject(parsed.tables)) {
    throw new Error("El archivo no contiene un bloque 'tables' válido.");
  }

  const tableNames = new Set(db.tables.map((table) => table.name));
  const unknownTables = Object.keys(parsed.tables).filter((tableName) => !tableNames.has(tableName));
  const unsupportedTables = unknownTables.filter((tableName) => !LEGACY_TABLE_NAMES.has(tableName));
  if (unsupportedTables.length > 0) {
    throw new Error(`El archivo contiene tablas desconocidas: ${unsupportedTables.join(", ")}.`);
  }

  const validatedTables: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    const rows = parsed.tables[table.name];
    if (schemaVersion === 3 && table.name === "appPreferences" && rows === undefined) {
      validatedTables[table.name] = [];
      continue;
    }
    if (schemaVersion < 5 && table.name === "taskDirectGrades" && rows === undefined) {
      validatedTables[table.name] = [];
      continue;
    }
    if (schemaVersion < 7 && table.name === "studentFollowUps" && rows === undefined) {
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
  const studentClassById = new Map(rows("students").map((row) => [row.id as string, row.classId as string]));
  const assessmentById = new Map(rows("assessments").map((row) => [row.id as string, row]));
  const unitSubjectById = new Map(rows("unitBlocks").map((row) => [row.id as string, row.subjectId as string]));
  const subjectById = new Map(rows("subjects").map((row) => [row.id as string, row]));
  const scheduleSlotIds = collectScheduleSlotIds(rows("scheduleDays"));
  const subjectCourseKeys = new Set(
    rows("subjectCourseLinks").map((row) => `${row.subjectId as string}:${row.classId as string}`)
  );
  const taskSubjectKeys = new Set(
    rows("taskSubjectLinks").map((row) => `${row.taskId as string}:${row.subjectId as string}`)
  );
  const taskSessionKeys = new Set(
    rows("taskSessions").map((row) => `${row.taskId as string}:${row.date as string}:${row.scheduleSlotId as string}`)
  );
  const taskSessionScopedKeys = new Set(
    rows("taskSessions").map(
      (row) =>
        `${row.taskId as string}:${row.classId as string}:${row.subjectId as string}:${row.date as string}:${row.scheduleSlotId as string}`
    )
  );
  const taskSessionsByKey = new Map<string, Record<string, unknown>[]>();
  for (const row of rows("taskSessions")) {
    const key = `${row.taskId as string}:${row.date as string}:${row.scheduleSlotId as string}`;
    const current = taskSessionsByKey.get(key) ?? [];
    current.push(row);
    taskSessionsByKey.set(key, current);
  }
  const rubricTemplateById = new Map(rows("rubricTemplates").map((row) => [row.id as string, row]));
  const checklistTemplateById = new Map(rows("checklistTemplates").map((row) => [row.id as string, row]));

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
    optionalString(row, "students", "email");
    validateStudentPhotoDataUrl(row);
    if (row.hasAcs !== undefined && typeof row.hasAcs !== "boolean") {
      throw new Error("La tabla 'students' contiene 'hasAcs' no valido.");
    }
    if (row.hasReinforcement !== undefined && typeof row.hasReinforcement !== "boolean") {
      throw new Error("La tabla 'students' contiene 'hasReinforcement' no valido.");
    }
  }
  for (const row of rows("subjects")) {
    requireText(row, "subjects", "name");
    optionalString(row, "subjects", "teachingHours");
    validateSubjectScheduleSlots(row, scheduleSlotIds);
  }
  for (const row of rows("subjectCourseLinks")) {
    requireReference(requireString(row, "subjectCourseLinks", "subjectId"), subjectIds, "subjectCourseLinks", "subjectId");
    requireReference(requireString(row, "subjectCourseLinks", "classId"), classIds, "subjectCourseLinks", "classId");
  }
  requireUniqueLogicalRows(
    rows("subjectCourseLinks"),
    "subjectCourseLinks",
    "subjectId+classId",
    (row) => `${row.subjectId as string}:${row.classId as string}`
  );
  for (const row of rows("subjectStudentLinks")) {
    const subjectId = requireString(row, "subjectStudentLinks", "subjectId");
    const studentId = requireString(row, "subjectStudentLinks", "studentId");
    requireReference(subjectId, subjectIds, "subjectStudentLinks", "subjectId");
    requireReference(studentId, studentIds, "subjectStudentLinks", "studentId");
    const classId = studentClassById.get(studentId);
    if (classId && !subjectCourseKeys.has(`${subjectId}:${classId}`)) {
      throw new Error("La tabla 'subjectStudentLinks' asigna un alumno a una asignatura no asociada a su curso.");
    }
  }
  requireUniqueLogicalRows(
    rows("subjectStudentLinks"),
    "subjectStudentLinks",
    "subjectId+studentId",
    (row) => `${row.subjectId as string}:${row.studentId as string}`
  );
  for (const row of rows("scheduleDays")) {
    requireNumber(row, "scheduleDays", "dayOfWeek");
    requireString(row, "scheduleDays", "dayName");
    if (row.enabled !== undefined && typeof row.enabled !== "boolean") {
      throw new Error("La tabla 'scheduleDays' contiene 'enabled' no valido.");
    }
    if (!Array.isArray(row.blocks)) {
      throw new Error("La tabla 'scheduleDays' contiene 'blocks' no valido.");
    }
    const blockIds = new Set<string>();
    const blockRanges: Array<{ start: number; end: number }> = [];
    for (const block of row.blocks) {
      if (!isPlainObject(block)) {
        throw new Error("La tabla 'scheduleDays' contiene bloques de horario no validos.");
      }
      const blockId = requireString(block, "scheduleDays.blocks", "id");
      if (blockIds.has(blockId)) {
        throw new Error("La tabla 'scheduleDays' contiene bloques de horario duplicados.");
      }
      blockIds.add(blockId);
      const startTime = requireTimeString(block, "scheduleDays.blocks", "startTime");
      const endTime = requireTimeString(block, "scheduleDays.blocks", "endTime");
      if (endTime <= startTime) {
        throw new Error("La tabla 'scheduleDays' contiene un bloque con hora de fin anterior o igual a la de inicio.");
      }
      const startMinutes = minutesFromTime(startTime);
      const endMinutes = minutesFromTime(endTime);
      if (blockRanges.some((range) => startMinutes < range.end && endMinutes > range.start)) {
        throw new Error("La tabla 'scheduleDays' contiene bloques de horario solapados.");
      }
      blockRanges.push({ start: startMinutes, end: endMinutes });
      if (block.isBreak !== undefined && typeof block.isBreak !== "boolean") {
        throw new Error("La tabla 'scheduleDays' contiene 'isBreak' no valido.");
      }
    }
  }
  validateScheduleDayRows(rows("scheduleDays"));
  for (const row of rows("unitBlocks")) {
    requireReference(requireString(row, "unitBlocks", "subjectId"), subjectIds, "unitBlocks", "subjectId");
    requireText(row, "unitBlocks", "name");
    requireText(row, "unitBlocks", "description");
    requireMinNumber(row, "unitBlocks", "sessionCount", 1);
    requireMinNumber(row, "unitBlocks", "position", 0);
  }
  for (const row of rows("tasks")) {
    requireText(row, "tasks", "title");
    requireText(row, "tasks", "description");
    requireMinNumber(row, "tasks", "sessionCount", 1);
    requireBoolean(row, "tasks", "sendToGradebook");
  }
  for (const row of rows("taskSubjectLinks")) {
    requireReference(requireString(row, "taskSubjectLinks", "taskId"), taskIds, "taskSubjectLinks", "taskId");
    const subjectId = requireString(row, "taskSubjectLinks", "subjectId");
    const unitId = optionalString(row, "taskSubjectLinks", "unitId");
    requireReference(subjectId, subjectIds, "taskSubjectLinks", "subjectId");
    requireReference(unitId, unitIds, "taskSubjectLinks", "unitId");
    if (unitId && unitSubjectById.get(unitId) !== subjectId) {
      throw new Error("La tabla 'taskSubjectLinks' vincula una tarea a una unidad de otra asignatura.");
    }
  }
  requireUniqueLogicalRows(
    rows("taskSubjectLinks"),
    "taskSubjectLinks",
    "taskId+subjectId",
    (row) => `${row.taskId as string}:${row.subjectId as string}`
  );
  for (const row of rows("taskGradebookConfigs")) {
    const taskId = requireString(row, "taskGradebookConfigs", "taskId");
    const subjectId = requireString(row, "taskGradebookConfigs", "subjectId");
    const classId = requireString(row, "taskGradebookConfigs", "classId");
    requireReference(taskId, taskIds, "taskGradebookConfigs", "taskId");
    requireReference(subjectId, subjectIds, "taskGradebookConfigs", "subjectId");
    requireReference(classId, classIds, "taskGradebookConfigs", "classId");
    if (!subjectCourseKeys.has(`${subjectId}:${classId}`)) {
      throw new Error("La tabla 'taskGradebookConfigs' usa una asignatura no asociada al curso.");
    }
    if (!taskSubjectKeys.has(`${taskId}:${subjectId}`)) {
      throw new Error("La tabla 'taskGradebookConfigs' usa una tarea no vinculada a la asignatura.");
    }
    requireMinNumber(row, "taskGradebookConfigs", "gradebookWeight", 0);
    const groupId = optionalString(row, "taskGradebookConfigs", "groupId");
    requireReference(groupId, gradebookGroupIds, "taskGradebookConfigs", "groupId");
    const group = groupId ? rows("gradebookGroups").find((item) => item.id === groupId) : null;
    if (group && (group.classId !== classId || group.subjectId !== subjectId)) {
      throw new Error("La tabla 'taskGradebookConfigs' usa una carpeta de otro curso o asignatura.");
    }
    const rubricTemplateId = optionalString(row, "taskGradebookConfigs", "rubricTemplateId");
    const checklistTemplateId = optionalString(row, "taskGradebookConfigs", "checklistTemplateId");
    requireReference(rubricTemplateId, rubricTemplateIds, "taskGradebookConfigs", "rubricTemplateId");
    requireReference(checklistTemplateId, checklistTemplateIds, "taskGradebookConfigs", "checklistTemplateId");
    const enabledMethods = [rubricTemplateId, checklistTemplateId, row.directGradeEnabled === true ? "direct" : ""].filter(Boolean);
    if (enabledMethods.length > 1) {
      throw new Error("La tabla 'taskGradebookConfigs' contiene mas de un metodo de evaluacion activo.");
    }
    const rubricTemplate = rubricTemplateId ? rubricTemplateById.get(rubricTemplateId) : null;
    const checklistTemplate = checklistTemplateId ? checklistTemplateById.get(checklistTemplateId) : null;
    if (rubricTemplate?.classId !== classId || (rubricTemplate?.taskId && rubricTemplate.taskId !== taskId)) {
      throw new Error("La tabla 'taskGradebookConfigs' usa una rubrica incompatible con la tarea.");
    }
    if (checklistTemplate?.classId !== classId || (checklistTemplate?.taskId && checklistTemplate.taskId !== taskId)) {
      throw new Error("La tabla 'taskGradebookConfigs' usa una lista de cotejo incompatible con la tarea.");
    }
    if (row.directGradeEnabled !== undefined && typeof row.directGradeEnabled !== "boolean") {
      throw new Error("La tabla 'taskGradebookConfigs' contiene 'directGradeEnabled' no valido.");
    }
  }
  requireUniqueLogicalRows(
    rows("taskGradebookConfigs"),
    "taskGradebookConfigs",
    "taskId+subjectId+classId",
    (row) => `${row.taskId as string}:${row.subjectId as string}:${row.classId as string}`
  );
  for (const row of rows("gradebookGroups")) {
    const classId = requireString(row, "gradebookGroups", "classId");
    const subjectId = requireString(row, "gradebookGroups", "subjectId");
    requireReference(classId, classIds, "gradebookGroups", "classId");
    requireReference(subjectId, subjectIds, "gradebookGroups", "subjectId");
    if (!subjectCourseKeys.has(`${subjectId}:${classId}`)) {
      throw new Error("La tabla 'gradebookGroups' usa una asignatura no asociada al curso.");
    }
    const parentId = optionalString(row, "gradebookGroups", "parentId");
    requireReference(parentId, gradebookGroupIds, "gradebookGroups", "parentId");
    const parent = parentId ? rows("gradebookGroups").find((item) => item.id === parentId) : null;
    if (parent && (parent.classId !== classId || parent.subjectId !== subjectId)) {
      throw new Error("La tabla 'gradebookGroups' contiene una carpeta padre de otro curso o asignatura.");
    }
    requireString(row, "gradebookGroups", "name");
    requireMinNumber(row, "gradebookGroups", "position", 0);
    if (row.weight !== undefined) {
      requireMinNumber(row, "gradebookGroups", "weight", 0);
    }
  }
  validateGradebookGroupTree(rows("gradebookGroups"));
  for (const row of rows("assessments")) {
    const classId = requireString(row, "assessments", "classId");
    const subjectId = requireString(row, "assessments", "subjectId");
    requireReference(classId, classIds, "assessments", "classId");
    requireReference(subjectId, subjectIds, "assessments", "subjectId");
    if (!subjectCourseKeys.has(`${subjectId}:${classId}`)) {
      throw new Error("La tabla 'assessments' usa una asignatura no asociada al curso.");
    }
    requireReference(optionalString(row, "assessments", "groupId"), gradebookGroupIds, "assessments", "groupId");
    requireString(row, "assessments", "title");
    optionalString(row, "assessments", "period");
    optionalString(row, "assessments", "competency");
    requireMinNumber(row, "assessments", "weight", 0);
  }
  for (const row of rows("gradeEntries")) {
    const classId = requireString(row, "gradeEntries", "classId");
    const assessmentId = requireString(row, "gradeEntries", "assessmentId");
    const studentId = requireString(row, "gradeEntries", "studentId");
    requireReference(classId, classIds, "gradeEntries", "classId");
    requireReference(assessmentId, assessmentIds, "gradeEntries", "assessmentId");
    requireReference(studentId, studentIds, "gradeEntries", "studentId");
    const assessment = assessmentById.get(assessmentId);
    if (assessment && assessment.classId !== classId) {
      throw new Error("La tabla 'gradeEntries' tiene una nota en un curso distinto al de su evaluación.");
    }
    if (studentClassById.get(studentId) !== classId) {
      throw new Error("La tabla 'gradeEntries' tiene una nota de un alumno que no pertenece al curso.");
    }
    if (row.numericValue !== undefined) {
      requireNumber(row, "gradeEntries", "numericValue");
      const numericValue = row.numericValue as number;
      if (numericValue < 0 || numericValue > 10) {
        throw new Error("La tabla 'gradeEntries' contiene notas fuera del rango 0-10.");
      }
    }
    optionalString(row, "gradeEntries", "textValue");
    optionalString(row, "gradeEntries", "colorTag");
    optionalString(row, "gradeEntries", "iconTag");
    optionalString(row, "gradeEntries", "comment");
  }
  requireUniqueLogicalRows(
    rows("gradeEntries"),
    "gradeEntries",
    "assessmentId+studentId",
    (row) => `${row.assessmentId as string}:${row.studentId as string}`
  );
  for (const row of rows("attendanceEntries")) {
    const classId = requireString(row, "attendanceEntries", "classId");
    const studentId = requireString(row, "attendanceEntries", "studentId");
    requireReference(classId, classIds, "attendanceEntries", "classId");
    requireReference(studentId, studentIds, "attendanceEntries", "studentId");
    if (studentClassById.get(studentId) !== classId) {
      throw new Error("La tabla 'attendanceEntries' tiene asistencia de un alumno que no pertenece al curso.");
    }
    requireDateString(row, "attendanceEntries", "date");
    const scheduleSlotId = optionalString(row, "attendanceEntries", "scheduleSlotId");
    requireReference(scheduleSlotId, scheduleSlotIds, "attendanceEntries", "scheduleSlotId");
    if (!["present", "late", "absent"].includes(requireString(row, "attendanceEntries", "status"))) {
      throw new Error("La tabla 'attendanceEntries' contiene 'status' no valido.");
    }
    optionalString(row, "attendanceEntries", "note");
  }
  requireUniqueLogicalRows(
    rows("attendanceEntries"),
    "attendanceEntries",
    "classId+studentId+date+scheduleSlotId",
    (row) => `${row.classId as string}:${row.studentId as string}:${row.date as string}:${String(row.scheduleSlotId ?? "")}`
  );
  for (const row of rows("rubricTemplates")) {
    requireReference(requireString(row, "rubricTemplates", "classId"), classIds, "rubricTemplates", "classId");
    requireReference(optionalString(row, "rubricTemplates", "taskId"), taskIds, "rubricTemplates", "taskId");
    validateRubricTemplateShape(row);
  }
  for (const row of rows("checklistTemplates")) {
    requireReference(requireString(row, "checklistTemplates", "classId"), classIds, "checklistTemplates", "classId");
    requireReference(optionalString(row, "checklistTemplates", "taskId"), taskIds, "checklistTemplates", "taskId");
    validateChecklistTemplateShape(row);
  }
  for (const row of rows("taskSessions")) {
    const taskId = requireString(row, "taskSessions", "taskId");
    const subjectId = requireString(row, "taskSessions", "subjectId");
    const classId = requireString(row, "taskSessions", "classId");
    requireReference(taskId, taskIds, "taskSessions", "taskId");
    requireReference(subjectId, subjectIds, "taskSessions", "subjectId");
    requireReference(classId, classIds, "taskSessions", "classId");
    if (!subjectCourseKeys.has(`${subjectId}:${classId}`)) {
      throw new Error("La tabla 'taskSessions' usa una asignatura no asociada al curso.");
    }
    if (!taskSubjectKeys.has(`${taskId}:${subjectId}`)) {
      throw new Error("La tabla 'taskSessions' usa una tarea no vinculada a la asignatura.");
    }
    const subject = subjectById.get(subjectId);
    const scheduleSlotId = optionalString(row, "taskSessions", "scheduleSlotId");
    requireDateString(row, "taskSessions", "date");
    requireReference(scheduleSlotId, scheduleSlotIds, "taskSessions", "scheduleSlotId");
    const subjectSlotIds = Array.isArray(subject?.scheduleSlotIds) ? subject.scheduleSlotIds : [];
    if (scheduleSlotId && !subjectSlotIds.includes(scheduleSlotId)) {
      throw new Error("La tabla 'taskSessions' usa una hora no asociada a la asignatura.");
    }
    if (row.status !== undefined && !["planned", "done", "moved", "cancelled"].includes(String(row.status))) {
      throw new Error("La tabla 'taskSessions' contiene 'status' no válido.");
    }
    optionalString(row, "taskSessions", "objectives");
    optionalString(row, "taskSessions", "competencies");
    optionalString(row, "taskSessions", "materials");
    optionalString(row, "taskSessions", "homework");
    optionalString(row, "taskSessions", "teacherNotes");
  }
  requireUniqueLogicalRows(
    rows("taskSessions"),
    "taskSessions",
    "taskId+classId+subjectId+date+scheduleSlotId",
    (row) =>
      `${row.taskId as string}:${row.classId as string}:${row.subjectId as string}:${row.date as string}:${String(row.scheduleSlotId ?? "")}`
  );
  requireUniqueLogicalRows(
    rows("taskSessions"),
    "taskSessions",
    "classId+date+scheduleSlotId",
    (row) => `${row.classId as string}:${row.date as string}:${String(row.scheduleSlotId ?? "")}`
  );
  for (const row of rows("taskStudentComments")) {
    const taskId = requireString(row, "taskStudentComments", "taskId");
    const studentId = requireString(row, "taskStudentComments", "studentId");
    const classId = optionalString(row, "taskStudentComments", "classId");
    const subjectId = optionalString(row, "taskStudentComments", "subjectId");
    requireReference(taskId, taskIds, "taskStudentComments", "taskId");
    requireReference(studentId, studentIds, "taskStudentComments", "studentId");
    requireReference(classId, classIds, "taskStudentComments", "classId");
    requireReference(subjectId, subjectIds, "taskStudentComments", "subjectId");
    if (Boolean(classId) !== Boolean(subjectId)) {
      throw new Error("La tabla 'taskStudentComments' debe indicar curso y asignatura juntos.");
    }
    if (classId && studentClassById.get(studentId) !== classId) {
      throw new Error("La tabla 'taskStudentComments' tiene comentarios de un alumno fuera del curso indicado.");
    }
    if (classId && subjectId && !subjectCourseKeys.has(`${subjectId}:${classId}`)) {
      throw new Error("La tabla 'taskStudentComments' usa una asignatura no asociada al curso.");
    }
    if (subjectId && !taskSubjectKeys.has(`${taskId}:${subjectId}`)) {
      throw new Error("La tabla 'taskStudentComments' usa una tarea no vinculada a la asignatura.");
    }
    const date = optionalString(row, "taskStudentComments", "date");
    const scheduleSlotId = optionalString(row, "taskStudentComments", "scheduleSlotId");
    requireText(row, "taskStudentComments", "comment");
    if (date) {
      requireDateString(row, "taskStudentComments", "date");
    }
    if (scheduleSlotId) {
      requireReference(scheduleSlotId, scheduleSlotIds, "taskStudentComments", "scheduleSlotId");
      if (classId && subjectId && !taskSessionScopedKeys.has(`${taskId}:${classId}:${subjectId}:${date}:${scheduleSlotId}`)) {
        throw new Error("La tabla 'taskStudentComments' usa una fecha/hora sin sesion de tarea para su curso y asignatura.");
      }
      const sessions = (taskSessionsByKey.get(`${taskId}:${date}:${scheduleSlotId}`) ?? []).filter(
        (session) => (!classId || session.classId === classId) && (!subjectId || session.subjectId === subjectId)
      );
      if (sessions.length === 0) {
        throw new Error("La tabla 'taskStudentComments' usa una fecha/hora sin sesion de tarea.");
      }
      if (!sessions.some((session) => session.classId === studentClassById.get(studentId))) {
        throw new Error("La tabla 'taskStudentComments' tiene comentarios de un alumno fuera del curso de la sesion.");
      }
    }
  }
  for (const row of rows("taskDailyEvaluationSettings")) {
    const taskId = requireString(row, "taskDailyEvaluationSettings", "taskId");
    const classId = optionalString(row, "taskDailyEvaluationSettings", "classId");
    const subjectId = optionalString(row, "taskDailyEvaluationSettings", "subjectId");
    const date = requireDateString(row, "taskDailyEvaluationSettings", "date");
    const scheduleSlotId = optionalString(row, "taskDailyEvaluationSettings", "scheduleSlotId");
    optionalString(row, "taskDailyEvaluationSettings", "generalComment");
    const rubricTemplateId = optionalString(row, "taskDailyEvaluationSettings", "rubricTemplateId");
    const checklistTemplateId = optionalString(row, "taskDailyEvaluationSettings", "checklistTemplateId");
    requireReference(taskId, taskIds, "taskDailyEvaluationSettings", "taskId");
    requireReference(classId, classIds, "taskDailyEvaluationSettings", "classId");
    requireReference(subjectId, subjectIds, "taskDailyEvaluationSettings", "subjectId");
    if (Boolean(classId) !== Boolean(subjectId)) {
      throw new Error("La tabla 'taskDailyEvaluationSettings' debe indicar curso y asignatura juntos.");
    }
    requireReference(scheduleSlotId, scheduleSlotIds, "taskDailyEvaluationSettings", "scheduleSlotId");
    requireReference(rubricTemplateId, rubricTemplateIds, "taskDailyEvaluationSettings", "rubricTemplateId");
    requireReference(checklistTemplateId, checklistTemplateIds, "taskDailyEvaluationSettings", "checklistTemplateId");
    if (rubricTemplateId && checklistTemplateId) {
      throw new Error("La tabla 'taskDailyEvaluationSettings' contiene rubrica y lista a la vez.");
    }
    if (classId && subjectId && !subjectCourseKeys.has(`${subjectId}:${classId}`)) {
      throw new Error("La tabla 'taskDailyEvaluationSettings' usa una asignatura no asociada al curso.");
    }
    if (subjectId && !taskSubjectKeys.has(`${taskId}:${subjectId}`)) {
      throw new Error("La tabla 'taskDailyEvaluationSettings' usa una tarea no vinculada a la asignatura.");
    }
    if (
      scheduleSlotId &&
      ((classId && subjectId && !taskSessionScopedKeys.has(`${taskId}:${classId}:${subjectId}:${date}:${scheduleSlotId}`)) ||
        (!classId && !subjectId && !taskSessionKeys.has(`${taskId}:${date}:${scheduleSlotId}`)))
    ) {
      throw new Error("La tabla 'taskDailyEvaluationSettings' usa una fecha/hora sin sesion de tarea.");
    }
    const rubricTemplate = rubricTemplateId ? rubricTemplateById.get(rubricTemplateId) : null;
    const checklistTemplate = checklistTemplateId ? checklistTemplateById.get(checklistTemplateId) : null;
    if (rubricTemplate?.taskId && rubricTemplate.taskId !== taskId) {
      throw new Error("La tabla 'taskDailyEvaluationSettings' usa una rubrica de otra tarea.");
    }
    if (checklistTemplate?.taskId && checklistTemplate.taskId !== taskId) {
      throw new Error("La tabla 'taskDailyEvaluationSettings' usa una lista de otra tarea.");
    }
  }
  requireUniqueLogicalRows(
    rows("taskDailyEvaluationSettings"),
    "taskDailyEvaluationSettings",
    "taskId+classId+subjectId+date+scheduleSlotId",
    (row) =>
      `${row.taskId as string}:${String(row.classId ?? "")}:${String(row.subjectId ?? "")}:${row.date as string}:${String(row.scheduleSlotId ?? "")}`
  );
  for (const row of rows("taskRubricAssessments")) {
    const taskId = requireString(row, "taskRubricAssessments", "taskId");
    const classId = optionalString(row, "taskRubricAssessments", "classId");
    const subjectId = optionalString(row, "taskRubricAssessments", "subjectId");
    const date = requireDateString(row, "taskRubricAssessments", "date");
    const scheduleSlotId = optionalString(row, "taskRubricAssessments", "scheduleSlotId");
    const studentId = requireString(row, "taskRubricAssessments", "studentId");
    const rubricTemplateId = requireString(row, "taskRubricAssessments", "rubricTemplateId");
    const criterionId = requireString(row, "taskRubricAssessments", "criterionId");
    const levelId = requireString(row, "taskRubricAssessments", "levelId");
    requireReference(taskId, taskIds, "taskRubricAssessments", "taskId");
    requireReference(classId, classIds, "taskRubricAssessments", "classId");
    requireReference(subjectId, subjectIds, "taskRubricAssessments", "subjectId");
    if (Boolean(classId) !== Boolean(subjectId)) {
      throw new Error("La tabla 'taskRubricAssessments' debe indicar curso y asignatura juntos.");
    }
    requireReference(studentId, studentIds, "taskRubricAssessments", "studentId");
    requireReference(rubricTemplateId, rubricTemplateIds, "taskRubricAssessments", "rubricTemplateId");
    requireReference(scheduleSlotId, scheduleSlotIds, "taskRubricAssessments", "scheduleSlotId");
    requireMinNumber(row, "taskRubricAssessments", "score", 0);
    if (classId && studentClassById.get(studentId) !== classId) {
      throw new Error("La tabla 'taskRubricAssessments' evalua a un alumno fuera del curso indicado.");
    }
    if (classId && subjectId && !subjectCourseKeys.has(`${subjectId}:${classId}`)) {
      throw new Error("La tabla 'taskRubricAssessments' usa una asignatura no asociada al curso.");
    }
    if (subjectId && !taskSubjectKeys.has(`${taskId}:${subjectId}`)) {
      throw new Error("La tabla 'taskRubricAssessments' usa una tarea no vinculada a la asignatura.");
    }
    if (scheduleSlotId) {
      if (classId && subjectId && !taskSessionScopedKeys.has(`${taskId}:${classId}:${subjectId}:${date}:${scheduleSlotId}`)) {
        throw new Error("La tabla 'taskRubricAssessments' usa una fecha/hora sin sesion de tarea para su curso y asignatura.");
      }
      const sessions = (taskSessionsByKey.get(`${taskId}:${date}:${scheduleSlotId}`) ?? []).filter(
        (session) => (!classId || session.classId === classId) && (!subjectId || session.subjectId === subjectId)
      );
      if (sessions.length === 0) {
        throw new Error("La tabla 'taskRubricAssessments' usa una fecha/hora sin sesion de tarea.");
      }
      if (!sessions.some((session) => session.classId === studentClassById.get(studentId))) {
        throw new Error("La tabla 'taskRubricAssessments' evalua a un alumno fuera del curso de la sesion.");
      }
    }
    const template = rubricTemplateById.get(rubricTemplateId);
    if (template?.taskId && template.taskId !== taskId) {
      throw new Error("La tabla 'taskRubricAssessments' usa una rubrica de otra tarea.");
    }
    const criteria = Array.isArray(template?.criteria) ? template.criteria : [];
    const criterion = criteria.find((item) => isPlainObject(item) && item.id === criterionId);
    const levels = Array.isArray((criterion as Record<string, unknown> | undefined)?.levels)
      ? ((criterion as Record<string, unknown>).levels as unknown[])
      : Array.isArray(template?.levels)
        ? template.levels
        : [];
    if (!criterion || !levels.some((item) => isPlainObject(item) && item.id === levelId)) {
      throw new Error("La tabla 'taskRubricAssessments' contiene criterio o nivel inexistente.");
    }
  }
  requireUniqueLogicalRows(
    rows("taskRubricAssessments"),
    "taskRubricAssessments",
    "taskId+classId+subjectId+date+scheduleSlotId+studentId+rubricTemplateId+criterionId",
    (row) =>
      [
        row.taskId,
        row.classId ?? "",
        row.subjectId ?? "",
        row.date,
        row.scheduleSlotId ?? "",
        row.studentId,
        row.rubricTemplateId,
        row.criterionId
      ].join(":")
  );
  for (const row of rows("taskChecklistAssessments")) {
    const taskId = requireString(row, "taskChecklistAssessments", "taskId");
    const classId = optionalString(row, "taskChecklistAssessments", "classId");
    const subjectId = optionalString(row, "taskChecklistAssessments", "subjectId");
    const date = requireDateString(row, "taskChecklistAssessments", "date");
    const scheduleSlotId = optionalString(row, "taskChecklistAssessments", "scheduleSlotId");
    const studentId = requireString(row, "taskChecklistAssessments", "studentId");
    const checklistTemplateId = requireString(row, "taskChecklistAssessments", "checklistTemplateId");
    const itemId = requireString(row, "taskChecklistAssessments", "itemId");
    requireReference(taskId, taskIds, "taskChecklistAssessments", "taskId");
    requireReference(classId, classIds, "taskChecklistAssessments", "classId");
    requireReference(subjectId, subjectIds, "taskChecklistAssessments", "subjectId");
    if (Boolean(classId) !== Boolean(subjectId)) {
      throw new Error("La tabla 'taskChecklistAssessments' debe indicar curso y asignatura juntos.");
    }
    requireReference(studentId, studentIds, "taskChecklistAssessments", "studentId");
    requireReference(checklistTemplateId, checklistTemplateIds, "taskChecklistAssessments", "checklistTemplateId");
    requireReference(scheduleSlotId, scheduleSlotIds, "taskChecklistAssessments", "scheduleSlotId");
    requireBoolean(row, "taskChecklistAssessments", "checked");
    if (classId && studentClassById.get(studentId) !== classId) {
      throw new Error("La tabla 'taskChecklistAssessments' evalua a un alumno fuera del curso indicado.");
    }
    if (classId && subjectId && !subjectCourseKeys.has(`${subjectId}:${classId}`)) {
      throw new Error("La tabla 'taskChecklistAssessments' usa una asignatura no asociada al curso.");
    }
    if (subjectId && !taskSubjectKeys.has(`${taskId}:${subjectId}`)) {
      throw new Error("La tabla 'taskChecklistAssessments' usa una tarea no vinculada a la asignatura.");
    }
    if (scheduleSlotId) {
      if (classId && subjectId && !taskSessionScopedKeys.has(`${taskId}:${classId}:${subjectId}:${date}:${scheduleSlotId}`)) {
        throw new Error("La tabla 'taskChecklistAssessments' usa una fecha/hora sin sesion de tarea para su curso y asignatura.");
      }
      const sessions = (taskSessionsByKey.get(`${taskId}:${date}:${scheduleSlotId}`) ?? []).filter(
        (session) => (!classId || session.classId === classId) && (!subjectId || session.subjectId === subjectId)
      );
      if (sessions.length === 0) {
        throw new Error("La tabla 'taskChecklistAssessments' usa una fecha/hora sin sesion de tarea.");
      }
      if (!sessions.some((session) => session.classId === studentClassById.get(studentId))) {
        throw new Error("La tabla 'taskChecklistAssessments' evalua a un alumno fuera del curso de la sesion.");
      }
    }
    const template = checklistTemplateById.get(checklistTemplateId);
    if (template?.taskId && template.taskId !== taskId) {
      throw new Error("La tabla 'taskChecklistAssessments' usa una lista de otra tarea.");
    }
    const items = Array.isArray(template?.items) ? template.items : [];
    if (!items.some((item) => isPlainObject(item) && item.id === itemId)) {
      throw new Error("La tabla 'taskChecklistAssessments' contiene un item inexistente.");
    }
  }
  requireUniqueLogicalRows(
    rows("taskChecklistAssessments"),
    "taskChecklistAssessments",
    "taskId+classId+subjectId+date+scheduleSlotId+studentId+checklistTemplateId+itemId",
    (row) =>
      [
        row.taskId,
        row.classId ?? "",
        row.subjectId ?? "",
        row.date,
        row.scheduleSlotId ?? "",
        row.studentId,
        row.checklistTemplateId,
        row.itemId
      ].join(":")
  );
  for (const row of rows("taskDirectGrades")) {
    const taskId = requireString(row, "taskDirectGrades", "taskId");
    const subjectId = requireString(row, "taskDirectGrades", "subjectId");
    const classId = requireString(row, "taskDirectGrades", "classId");
    const studentId = requireString(row, "taskDirectGrades", "studentId");
    requireReference(taskId, taskIds, "taskDirectGrades", "taskId");
    requireReference(subjectId, subjectIds, "taskDirectGrades", "subjectId");
    requireReference(classId, classIds, "taskDirectGrades", "classId");
    requireReference(studentId, studentIds, "taskDirectGrades", "studentId");
    if (!subjectCourseKeys.has(`${subjectId}:${classId}`)) {
      throw new Error("La tabla 'taskDirectGrades' usa una asignatura no asociada al curso.");
    }
    if (!taskSubjectKeys.has(`${taskId}:${subjectId}`)) {
      throw new Error("La tabla 'taskDirectGrades' usa una tarea no vinculada a la asignatura.");
    }
    if (studentClassById.get(studentId) !== classId) {
      throw new Error("La tabla 'taskDirectGrades' tiene una nota de un alumno que no pertenece al curso.");
    }
    requireNumber(row, "taskDirectGrades", "score");
    const score = Number(row.score);
    if (score < 0 || score > 10) {
      throw new Error("La tabla 'taskDirectGrades' contiene notas fuera del rango 0-10.");
    }
  }
  requireUniqueLogicalRows(
    rows("taskDirectGrades"),
    "taskDirectGrades",
    "taskId+subjectId+classId+studentId",
    (row) => `${row.taskId as string}:${row.subjectId as string}:${row.classId as string}:${row.studentId as string}`
  );
  for (const row of rows("studentFollowUps")) {
    const studentId = requireString(row, "studentFollowUps", "studentId");
    const classId = requireString(row, "studentFollowUps", "classId");
    requireReference(studentId, studentIds, "studentFollowUps", "studentId");
    requireReference(classId, classIds, "studentFollowUps", "classId");
    if (studentClassById.get(studentId) !== classId) {
      throw new Error("La tabla 'studentFollowUps' contiene seguimiento de un alumno fuera del curso indicado.");
    }
    requireDateString(row, "studentFollowUps", "date");
    if (!["incident", "family", "tutorial", "agreement", "adaptation", "wellbeing"].includes(requireString(row, "studentFollowUps", "kind"))) {
      throw new Error("La tabla 'studentFollowUps' contiene 'kind' no válido.");
    }
    requireText(row, "studentFollowUps", "title");
    requireText(row, "studentFollowUps", "notes");
    optionalString(row, "studentFollowUps", "nextStep");
    requireBoolean(row, "studentFollowUps", "resolved");
  }
  for (const row of rows("scheduleSettings")) {
    if (row.id !== "default") {
      throw new Error("La tabla 'scheduleSettings' contiene un id no válido.");
    }
    requireNumber(row, "scheduleSettings", "defaultBlockDurationMinutes");
    const duration = row.defaultBlockDurationMinutes as number;
    if (duration < 15 || duration > 240) {
      throw new Error("La tabla 'scheduleSettings' contiene una duración de bloque fuera del rango 15-240.");
    }
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

  const verifyDatabaseIntegrity = async (): Promise<void> => {
    await runDatabaseAction(async () => {
      const tables: Record<string, unknown[]> = {};
      for (const table of db.tables) {
        tables[table.name] = await table.toArray();
      }
      validateDatabasePayload({
        app: "ProfePlus",
        schemaVersion: DATABASE_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        tables
      });
      setNotice("Integridad verificada: no se han encontrado referencias rotas.");
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
            className="btn secondary"
            disabled={isBusy}
            onClick={() => void verifyDatabaseIntegrity()}
          >
            Verificar integridad
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
