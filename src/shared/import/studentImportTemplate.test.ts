import { describe, expect, it } from "vitest";
import { STUDENT_IMPORT_TEMPLATE } from "./studentImportTemplate";
import { parseGroupedStudentsCsv } from "./studentsCsv";

describe("student import template", () => {
  it("provides supported headers without example student records", () => {
    const result = parseGroupedStudentsCsv(STUDENT_IMPORT_TEMPLATE);
    expect(result.missingHeaders).toEqual([]);
    expect(result.groups).toEqual([]);
  });

  it("accepts a teacher-filled row including accented names", () => {
    const result = parseGroupedStudentsCsv(`${STUDENT_IMPORT_TEMPLATE}Lucía;Ejemplo;3 Primaria;A\r\n`);
    expect(result.missingHeaders).toEqual([]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].students).toHaveLength(1);
  });
});
