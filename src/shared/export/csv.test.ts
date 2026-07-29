import { describe, expect, it } from "vitest";
import { buildCsv, sanitizeSpreadsheetCell } from "./csv";

describe("CSV export", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@IMPORTDATA('https://example.test')", "\t=1+1"])(
    "neutralizes spreadsheet formulas in %s",
    (value) => {
      expect(sanitizeSpreadsheetCell(value)).toBe(`'${value}`);
    }
  );

  it("preserves ordinary text and escapes quotes", () => {
    expect(buildCsv([["Ana", 'Dijo "hola"']])).toBe('"Ana","Dijo ""hola"""');
  });
});
