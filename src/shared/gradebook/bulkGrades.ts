export type ParsedGradeCell = number | null;

export type ParsedGradeGrid =
  | { ok: true; rows: ParsedGradeCell[][] }
  | { ok: false; message: string };

export function parsePastedGradeGrid(
  rawValue: string,
  maximumRows: number,
  maximumColumns: number
): ParsedGradeGrid {
  const normalized = rawValue.trim();
  if (!normalized) {
    return { ok: false, message: "Pega al menos una calificación." };
  }

  const rawRows = normalized.split(/\r?\n/).map((row) => row.split("\t"));
  if (rawRows.length > maximumRows) {
    return {
      ok: false,
      message: `Hay ${rawRows.length} filas, pero solo ${maximumRows} alumnos visibles.`
    };
  }

  if (rawRows.some((row) => row.length > maximumColumns)) {
    return {
      ok: false,
      message: `La matriz supera las ${maximumColumns} pruebas visibles.`
    };
  }

  const rows: ParsedGradeCell[][] = [];
  for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex += 1) {
    const row: ParsedGradeCell[] = [];
    for (let columnIndex = 0; columnIndex < rawRows[rowIndex].length; columnIndex += 1) {
      const rawCell = rawRows[rowIndex][columnIndex].trim();
      if (!rawCell) {
        row.push(null);
        continue;
      }
      const value = Number(rawCell.replace(",", "."));
      if (!Number.isFinite(value) || value < 0 || value > 10) {
        return {
          ok: false,
          message: `La celda ${rowIndex + 1}:${columnIndex + 1} debe estar entre 0 y 10.`
        };
      }
      row.push(Number(value.toFixed(2)));
    }
    rows.push(row);
  }

  return { ok: true, rows };
}
