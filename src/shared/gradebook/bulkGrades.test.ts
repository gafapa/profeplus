import { describe, expect, it } from "vitest";
import { parsePastedGradeGrid } from "./bulkGrades";

describe("parsePastedGradeGrid", () => {
  it("parses spreadsheet rows, comma decimals, and blank cells", () => {
    expect(parsePastedGradeGrid("7,5\t8\n\t10", 2, 2)).toEqual({
      ok: true,
      rows: [
        [7.5, 8],
        [null, 10]
      ]
    });
  });

  it("rejects invalid grades and matrices larger than the visible selection", () => {
    expect(parsePastedGradeGrid("11", 1, 1)).toEqual({
      ok: false,
      message: "La celda 1:1 debe estar entre 0 y 10."
    });
    expect(parsePastedGradeGrid("7\n8", 1, 1)).toEqual({
      ok: false,
      message: "Hay 2 filas, pero solo 1 alumnos visibles."
    });
  });
});
