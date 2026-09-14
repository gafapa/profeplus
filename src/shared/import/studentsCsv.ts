export type ParsedStudentCsvRow = {
  firstName: string;
  lastName: string;
  email?: string;
  comments?: string;
  hasAcs: boolean;
  hasReinforcement: boolean;
};

export type ParsedGroupedStudentCsvRow = ParsedStudentCsvRow & {
  sourceId?: string;
  sourceRow: number;
};

export type ParsedStudentCsvGroup = {
  key: string;
  course: string;
  group: string;
  name: string;
  students: ParsedGroupedStudentCsvRow[];
};

export type GroupedStudentsCsvResult = {
  groups: ParsedStudentCsvGroup[];
  totalRowCount: number;
  skippedRowCount: number;
  duplicateRowCount: number;
  missingHeaders: string[];
};

const TRUE_VALUES = new Set(["1", "true", "yes", "y", "si", "sí", "x"]);
const FULL_NAME_HEADERS = [
  "fullname",
  "nombrecompleto",
  "alumno",
  "alumnoa",
  "estudiante",
  "student",
  "apellidosnombre",
  "apellidosynombre",
  "nombreapellidos",
  "nombreyapellidos"
];
const FIRST_NAME_HEADERS = ["firstname", "nombre", "nome", "name", "nombres"];
const LAST_NAME_HEADERS = ["lastname", "apellidos", "apellido", "surname", "surnames"];
const EMAIL_HEADERS = ["email", "correo", "mail", "correoelectronico", "emailaddress"];
const COMMENT_HEADERS = [
  "comments",
  "comentarios",
  "observaciones",
  "observacion",
  "observacions",
  "notas",
  "notes"
];
const ACS_HEADERS = ["acs", "adaptacioncurricular", "adaptacioncurricularsignificativa"];
const REINFORCEMENT_HEADERS = ["reinforcement", "refuerzo", "apoyo", "apoyorefuerzo"];
const SOURCE_ID_HEADERS = ["codalumno", "codigoxade", "studentid"];
const FIRST_SURNAME_HEADERS = ["apelido1", "apellido1", "primerapelido", "primerapellido"];
const SECOND_SURNAME_HEADERS = ["apelido2", "apellido2", "segundoapelido", "segundoapellido"];
const COURSE_HEADERS = ["curso", "course"];
const GROUP_HEADERS = ["grupo", "group"];

const GROUP_IMPORT_REQUIRED_HEADERS = [
  { label: "NOME", names: FIRST_NAME_HEADERS },
  { label: "APELIDO 1", names: FIRST_SURNAME_HEADERS },
  { label: "CURSO", names: COURSE_HEADERS },
  { label: "GRUPO", names: GROUP_HEADERS }
];

function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === "\"") {
      if (quoted && nextChar === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      values.push(current.trim());
      if (values.some((value) => value.length > 0)) {
        rows.push(values);
      }
      values = [];
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  if (values.some((value) => value.length > 0)) {
    rows.push(values);
  }
  return rows;
}

function detectDelimiter(text: string): string {
  const firstContentLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const tabCount = (firstContentLine.match(/\t/g) ?? []).length;
  const semicolonCount = (firstContentLine.match(/;/g) ?? []).length;
  const commaCount = (firstContentLine.match(/,/g) ?? []).length;
  if (tabCount >= semicolonCount && tabCount >= commaCount && tabCount > 0) {
    return "\t";
  }
  return semicolonCount >= commaCount ? ";" : ",";
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function hasHeader(values: string[]): boolean {
  const normalized = values.map(normalizeHeader);
  return normalized.some((value) => [...FIRST_NAME_HEADERS, ...LAST_NAME_HEADERS, ...FULL_NAME_HEADERS].includes(value));
}

function readBoolean(value: string | undefined): boolean {
  return TRUE_VALUES.has((value ?? "").trim().toLowerCase());
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const commaIndex = fullName.indexOf(",");
  if (commaIndex > -1) {
    const lastName = fullName.slice(0, commaIndex).trim();
    const firstName = fullName.slice(commaIndex + 1).trim();
    return { firstName, lastName };
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: fullName.trim(), lastName: "" };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1]
  };
}

function valueAt(row: string[], headerIndexes: Map<string, number>, names: string[], fallbackIndex: number): string {
  for (const name of names) {
    const index = headerIndexes.get(name);
    if (typeof index === "number") {
      return row[index] ?? "";
    }
  }
  return row[fallbackIndex] ?? "";
}

function hasAnyHeader(headerIndexes: Map<string, number>, names: string[]): boolean {
  return names.some((name) => headerIndexes.has(name));
}

function normalizeCellValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeGroupKey(course: string, group: string): string {
  return `${course}::${group}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function parseGroupedStudentsCsv(text: string): GroupedStudentsCsvResult {
  const delimiter = detectDelimiter(text);
  const rows = parseCsvRows(text, delimiter);
  if (rows.length === 0) {
    return {
      groups: [],
      totalRowCount: 0,
      skippedRowCount: 0,
      duplicateRowCount: 0,
      missingHeaders: GROUP_IMPORT_REQUIRED_HEADERS.map((header) => header.label)
    };
  }

  const headerIndexes = new Map<string, number>();
  rows[0].forEach((header, index) => {
    headerIndexes.set(normalizeHeader(header), index);
  });
  const missingHeaders = GROUP_IMPORT_REQUIRED_HEADERS
    .filter((header) => !hasAnyHeader(headerIndexes, header.names))
    .map((header) => header.label);
  const dataRows = rows.slice(1);
  if (missingHeaders.length > 0) {
    return {
      groups: [],
      totalRowCount: dataRows.length,
      skippedRowCount: dataRows.length,
      duplicateRowCount: 0,
      missingHeaders
    };
  }

  const groupsByKey = new Map<string, ParsedStudentCsvGroup>();
  const seenSourceIds = new Set<string>();
  let skippedRowCount = 0;
  let duplicateRowCount = 0;

  dataRows.forEach((row, index) => {
    const firstName = normalizeCellValue(valueAt(row, headerIndexes, FIRST_NAME_HEADERS, -1));
    const firstSurname = normalizeCellValue(valueAt(row, headerIndexes, FIRST_SURNAME_HEADERS, -1));
    const secondSurname = normalizeCellValue(valueAt(row, headerIndexes, SECOND_SURNAME_HEADERS, -1));
    const course = normalizeCellValue(valueAt(row, headerIndexes, COURSE_HEADERS, -1));
    const group = normalizeCellValue(valueAt(row, headerIndexes, GROUP_HEADERS, -1));
    if (!firstName || !firstSurname || !course || !group) {
      skippedRowCount += 1;
      return;
    }

    const groupKey = normalizeGroupKey(course, group);
    const sourceId = normalizeCellValue(valueAt(row, headerIndexes, SOURCE_ID_HEADERS, -1));
    const sourceKey = sourceId ? `${groupKey}::${sourceId.toLowerCase()}` : "";
    if (sourceKey && seenSourceIds.has(sourceKey)) {
      duplicateRowCount += 1;
      return;
    }
    if (sourceKey) {
      seenSourceIds.add(sourceKey);
    }

    const csvGroup = groupsByKey.get(groupKey) ?? {
      key: groupKey,
      course,
      group,
      name: `${course} ${group}`,
      students: []
    };
    csvGroup.students.push({
      sourceId: sourceId || undefined,
      sourceRow: index + 2,
      firstName,
      lastName: [firstSurname, secondSurname].filter(Boolean).join(" "),
      email: normalizeCellValue(valueAt(row, headerIndexes, EMAIL_HEADERS, -1)) || undefined,
      comments: normalizeCellValue(valueAt(row, headerIndexes, COMMENT_HEADERS, -1)) || undefined,
      hasAcs: readBoolean(valueAt(row, headerIndexes, ACS_HEADERS, -1)),
      hasReinforcement: readBoolean(valueAt(row, headerIndexes, REINFORCEMENT_HEADERS, -1))
    });
    groupsByKey.set(groupKey, csvGroup);
  });

  return {
    groups: Array.from(groupsByKey.values()),
    totalRowCount: dataRows.length,
    skippedRowCount,
    duplicateRowCount,
    missingHeaders: []
  };
}

export function parseStudentsCsv(text: string): ParsedStudentCsvRow[] {
  const delimiter = detectDelimiter(text);
  const rows = parseCsvRows(text, delimiter);

  if (rows.length === 0) {
    return [];
  }

  const headerIndexes = new Map<string, number>();
  let dataRows = rows;
  if (hasHeader(rows[0])) {
    rows[0].forEach((header, index) => {
      headerIndexes.set(normalizeHeader(header), index);
    });
    dataRows = rows.slice(1);
  }
  const hasExplicitHeaders = headerIndexes.size > 0;

  const parsedRows: ParsedStudentCsvRow[] = [];
  for (const row of dataRows) {
    const fullName = valueAt(row, headerIndexes, FULL_NAME_HEADERS, -1);
    const firstName = valueAt(row, headerIndexes, FIRST_NAME_HEADERS, hasExplicitHeaders ? -1 : 0);
    const lastName = valueAt(row, headerIndexes, LAST_NAME_HEADERS, hasExplicitHeaders ? -1 : 1);
    const splitName = fullName ? splitFullName(fullName) : null;
    const normalizedFirstName = (firstName || splitName?.firstName || "").trim();
    const normalizedLastName = (lastName || splitName?.lastName || "").trim();

    if (normalizedFirstName.length < 1 || normalizedLastName.length < 1) {
      continue;
    }

    parsedRows.push({
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      email: valueAt(row, headerIndexes, EMAIL_HEADERS, hasExplicitHeaders ? -1 : 2).trim() || undefined,
      comments: valueAt(row, headerIndexes, COMMENT_HEADERS, hasExplicitHeaders ? -1 : 3).trim() || undefined,
      hasAcs: readBoolean(valueAt(row, headerIndexes, ACS_HEADERS, hasExplicitHeaders ? -1 : 4)),
      hasReinforcement: readBoolean(valueAt(row, headerIndexes, REINFORCEMENT_HEADERS, hasExplicitHeaders ? -1 : 5))
    });
  }

  return parsedRows;
}
