export type ParsedStudentCsvRow = {
  firstName: string;
  lastName: string;
  email?: string;
  comments?: string;
  hasAcs: boolean;
  hasReinforcement: boolean;
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
const FIRST_NAME_HEADERS = ["firstname", "nombre", "name", "nombres"];
const LAST_NAME_HEADERS = ["lastname", "apellidos", "apellido", "surname", "surnames"];
const EMAIL_HEADERS = ["email", "correo", "mail", "correoelectronico", "emailaddress"];
const COMMENT_HEADERS = ["comments", "comentarios", "observaciones", "observacion", "notas", "notes"];
const ACS_HEADERS = ["acs", "adaptacioncurricular", "adaptacioncurricularsignificativa"];
const REINFORCEMENT_HEADERS = ["reinforcement", "refuerzo", "apoyo", "apoyorefuerzo"];

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

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

    current += char;
  }

  values.push(current.trim());
  return values;
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

export function parseStudentsCsv(text: string): ParsedStudentCsvRow[] {
  const delimiter = detectDelimiter(text);
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseCsvLine(line, delimiter));

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
