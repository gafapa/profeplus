import { describe, expect, it } from "vitest";
import { protectAiReportRows } from "./aiPrivacy";

describe("AI report privacy", () => {
  it("excludes identifiers embedded in notes, subjects, activity titles and comments", () => {
    const rows = [
      ["Ámbito", "Alumno", "ACS", "Refuerzo", "Asignatura", "Indicador", "Valor", "Detalle", "Prioridad"],
      ["Observaciones", "Alumno 1", "No", "No", "", "Asistencia", "", "Ana García, ana@example.com", "Alto"],
      ["Seguimiento", "Alumno 1", "No", "No", "", "Tutoría", "", "Familia García", "Alto"],
      ["Tarea", "Alumno 1", "No", "No", "Apoyo Ana García", "Examen de Ana", "4", "Llamar al 666123456", "Alto"]
    ];
    const protectedRows = protectAiReportRows(rows);
    expect(protectedRows).toHaveLength(2);
    expect(protectedRows[1]).toEqual(["Tarea", "Alumno 1", "No", "No", "Asignatura 1", "Actividad 1", "4", "", "Alto"]);
    expect(JSON.stringify(protectedRows)).not.toMatch(/Ana|García|example|666123456/);
  });
});
