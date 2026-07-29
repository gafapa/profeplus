import { describe, expect, it } from "vitest";
import {
  normalizeGeneratedChecklist,
  normalizeGeneratedRubric,
  parseFirstJsonObject,
  type GeneratedRubric
} from "./instrumentAi";

function rubricWithCriteria(criteriaCount: number, levelsCount = 4): GeneratedRubric {
  return {
    name: "Proyecto",
    criteria: Array.from({ length: criteriaCount }, (_, criterionIndex) => ({
      name: `Criterio ${criterionIndex + 1}`,
      levels: Array.from({ length: levelsCount }, (_, levelIndex) => ({
        name: `Nivel ${levelIndex + 1}`,
        score: levelIndex === 0 ? 12 : levelsCount - levelIndex
      }))
    }))
  };
}

describe("instrument AI helpers", () => {
  it("parses the first JSON object from fenced or explanatory text", () => {
    const parsed = parseFirstJsonObject<{ name: string }>(
      'Texto previo\n```json\n{"name":"Lista",}\n```\nTexto posterior'
    );

    expect(parsed).toEqual({ name: "Lista" });
  });

  it("rejects generated rubrics below the minimum structure", () => {
    expect(normalizeGeneratedRubric(rubricWithCriteria(1, 4), "Tarea")).toBeNull();
    expect(normalizeGeneratedRubric(rubricWithCriteria(3, 2), "Tarea")).toBeNull();
  });

  it("normalizes generated rubrics by clamping and sorting scores", () => {
    const normalized = normalizeGeneratedRubric(rubricWithCriteria(3, 4), "Tarea");

    expect(normalized).not.toBeNull();
    expect(normalized?.criteria).toHaveLength(3);
    const firstCriterion = normalized?.criteria[0];
    const levels = firstCriterion?.levels ?? [];
    expect(levels).toHaveLength(4);
    expect(levels.map((level) => level.score)).toEqual([10, 3, 2, 1]);
  });

  it("rejects generated checklists with fewer than five items", () => {
    const normalized = normalizeGeneratedChecklist(
      {
        name: "Lista",
        items: ["Uno", "Dos", "Tres", "Cuatro"]
      },
      "Tarea"
    );

    expect(normalized).toBeNull();
  });

  it("normalizes nested checklists and removes duplicate items", () => {
    const normalized = normalizeGeneratedChecklist(
      {
        checklist: {
          title: "Revision",
          items: [
            "Entrega a tiempo",
            { text: "Entrega a tiempo" },
            { name: "Incluye fuentes" },
            { item: "Explica el procedimiento" },
            "Presenta de forma clara",
            "Revisa la ortografia"
          ]
        }
      },
      "Tarea"
    );

    expect(normalized?.name).toBe("Revision");
    expect(normalized?.items.map((item) => item.text)).toEqual([
      "Entrega a tiempo",
      "Incluye fuentes",
      "Explica el procedimiento",
      "Presenta de forma clara",
      "Revisa la ortografia"
    ]);
  });
});
