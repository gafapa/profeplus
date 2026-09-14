/** Keep only generated labels and structured values; free text may identify people. */
export function protectAiReportRows(rows: string[][]): string[][] {
  const subjectLabels = new Map<string, string>();
  return rows.filter((row, index) => index === 0 || !["Observaciones", "Seguimiento"].includes(row[0])).map((row, index) => {
    if (index === 0) return row;
    const next = [...row];
    if (row[4]) {
      if (!subjectLabels.has(row[4])) subjectLabels.set(row[4], `Asignatura ${subjectLabels.size + 1}`);
      next[4] = subjectLabels.get(row[4])!;
    }
    if (["Evaluación", "Tarea"].includes(row[0])) {
      next[5] = `Actividad ${index}`;
      next[7] = "";
    }
    return next;
  });
}
