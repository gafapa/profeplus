import { describe, expect, it } from "vitest";
import { appendFeedbackComment, feedbackCategoryLabel, normalizeFeedbackComment } from "./comments";

describe("reusable feedback comments", () => {
  it("normalizes whitespace and rejects invalid lengths", () => {
    expect(normalizeFeedbackComment("  Participa   de forma activa. ")).toBe("Participa de forma activa.");
    expect(() => normalizeFeedbackComment(" ")).toThrow(/entre 2 y 500/);
  });

  it("appends comments on a new line without duplicating existing feedback", () => {
    expect(appendFeedbackComment("Buen trabajo.", "Revisa la presentación.")).toBe("Buen trabajo.\nRevisa la presentación.");
    expect(appendFeedbackComment("Revisa la presentación.", "revisa la presentación.")).toBe("Revisa la presentación.");
  });

  it("provides labels for every category", () => {
    expect(feedbackCategoryLabel("attendance")).toBe("Asistencia");
    expect(feedbackCategoryLabel("work")).toBe("Trabajo en clase");
    expect(feedbackCategoryLabel("gradebook")).toBe("Cuaderno");
    expect(feedbackCategoryLabel("general")).toBe("General");
  });
});
