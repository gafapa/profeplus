import { describe, expect, it } from "vitest";
import { normalizeAttendanceNote, resolveAttendanceNoteForSave } from "./attendance";

describe("attendance helpers", () => {
  it("trims attendance notes and removes empty values", () => {
    expect(normalizeAttendanceNote("  Needs follow-up  ")).toBe("Needs follow-up");
    expect(normalizeAttendanceNote("   ")).toBeUndefined();
    expect(normalizeAttendanceNote(undefined)).toBeUndefined();
  });

  it("uses explicit note drafts so clearing a note is persisted", () => {
    const drafts = new Map([["student-1", "   "]]);

    expect(resolveAttendanceNoteForSave("student-1", drafts, "Existing note")).toBeUndefined();
    expect(resolveAttendanceNoteForSave("student-2", drafts, " Existing note ")).toBe("Existing note");
  });
});
