import { describe, expect, it } from "vitest";
import { defaultFollowUpDraft, followUpKindLabel, normalizeFollowUpDraft, updateFollowUpDetails } from "./followUp";

describe("student follow-up helpers", () => {
  it("preserves coordination metadata when editing basic details and reconciles completion", () => {
    const original = {
      id: "f", classId: "c", studentId: "s", date: "2026-09-08", kind: "tutorial" as const,
      title: "Original", notes: "Original notes", resolved: false, status: "inProgress" as const,
      responsiblePerson: "Tutor", dueDate: "2026-09-15", priority: "high" as const, createdAt: "2026-09-01T00:00:00Z"
    };
    const draft = { ...defaultFollowUpDraft(original.date), title: "Edited", notes: "Edited notes" };
    const updated = updateFollowUpDetails(original, draft, "2026-09-08T00:00:00Z");
    expect(updated).toMatchObject({ ...original, title: "Edited", notes: "Edited notes", updatedAt: "2026-09-08T00:00:00Z" });
    expect(updateFollowUpDetails(original, { ...draft, resolved: true })?.status).toBe("done");
    expect(updateFollowUpDetails({ ...original, status: "done", resolved: true }, draft)?.status).toBe("open");
    expect(updateFollowUpDetails(original, { ...draft, title: "" })).toBeNull();
  });
  it("creates a default tutorial draft", () => {
    expect(defaultFollowUpDraft("2026-07-08")).toEqual({
      date: "2026-07-08",
      kind: "tutorial",
      title: "",
      notes: "",
      nextStep: "",
      resolved: false
    });
  });

  it("normalizes valid follow-up drafts", () => {
    expect(
      normalizeFollowUpDraft({
        date: "2026-07-08",
        kind: "family",
        title: "  Phone call ",
        notes: "  Family agreed daily reading. ",
        nextStep: " Review next week ",
        resolved: false
      })
    ).toEqual({
      date: "2026-07-08",
      kind: "family",
      title: "Phone call",
      notes: "Family agreed daily reading.",
      nextStep: "Review next week",
      resolved: false
    });
  });

  it("rejects invalid follow-up drafts", () => {
    expect(
      normalizeFollowUpDraft({
        date: "08/07/2026",
        kind: "tutorial",
        title: "Meeting",
        notes: "Notes",
        nextStep: "",
        resolved: false
      })
    ).toBeNull();
    expect(
      normalizeFollowUpDraft({
        date: "2026-07-08",
        kind: "tutorial",
        title: "A",
        notes: "Notes",
        nextStep: "",
        resolved: false
      })
    ).toBeNull();
  });

  it("returns user-facing labels", () => {
    expect(followUpKindLabel("incident")).toBe("Incidencia");
    expect(followUpKindLabel("wellbeing")).toBe("Bienestar");
  });
});
