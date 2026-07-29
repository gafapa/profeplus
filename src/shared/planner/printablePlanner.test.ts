import { describe, expect, it } from "vitest";
import { buildPrintablePlannerReport } from "./printablePlanner";

describe("printable planner report", () => {
  it("builds weekly planner tables in chronological order", () => {
    const report = buildPrintablePlannerReport({
      className: "1 ESO A",
      subjectName: "Matemáticas",
      weekRange: "2026-05-18 - 2026-05-24",
      generatedAt: "2026-05-18 08:00",
      visibleSlotsCount: 4,
      unplannedCount: 2,
      sessions: [
        {
          date: "2026-05-19",
          dayName: "Martes",
          time: "10:00 - 11:00",
          className: "1 ESO A",
          subjectName: "Matemáticas",
          taskTitle: "Problemas",
          unitName: "Álgebra",
          statusLabel: "Planificada",
          homework: "Ejercicios 1-4"
        },
        {
          date: "2026-05-18",
          dayName: "Lunes",
          time: "09:00 - 10:00",
          className: "1 ESO A",
          subjectName: "Matemáticas",
          taskTitle: "Ecuaciones",
          statusLabel: "Realizada",
          objectives: "Resolver ecuaciones sencillas"
        }
      ]
    });

    expect(report.title).toBe("Planificador semanal - 1 ESO A");
    expect(report.summary?.[1]).toEqual({ label: "Filtro", value: "Matemáticas" });
    expect(report.tables?.[0].rows[0][3]).toBe("Ecuaciones");
    expect(report.tables?.[0].rows[1][3]).toBe("Problemas");
    expect(report.tables?.[1].rows[0][3]).toBe("Resolver ecuaciones sencillas");
    expect(report.tables?.[1].rows[1][6]).toBe("Ejercicios 1-4");
  });
});
