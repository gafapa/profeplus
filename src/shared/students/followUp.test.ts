import { describe, expect, it } from "vitest";
import { defaultFollowUpDraft, followUpKindLabel, normalizeFollowUpDraft } from "./followUp";

describe("student follow-up helpers", () => {
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
