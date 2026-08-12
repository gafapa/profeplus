import { describe, expect, it } from "vitest";
import {
  matchesAttendanceScope,
  normalizeAttendanceDetails,
  normalizeAttendanceNote,
  resolveAttendanceNoteForSave
} from "./attendance";
import type { AttendanceEntry } from "../db/types";

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

  it("normalizes justified absence, late minutes and early departure", () => {
    expect(
      normalizeAttendanceDetails("absent", {
        absenceJustified: true,
        lateMinutes: "15",
        earlyDepartureMinutes: " 20 "
      })
    ).toEqual({ absenceJustified: true, lateMinutes: undefined, earlyDepartureMinutes: 20 });

    expect(
      normalizeAttendanceDetails("late", {
        absenceJustified: true,
        lateMinutes: "12.6",
        earlyDepartureMinutes: "0"
      })
    ).toEqual({ absenceJustified: undefined, lateMinutes: 13, earlyDepartureMinutes: undefined });
  });

  it("drops invalid minute values and caps extreme values", () => {
    expect(
      normalizeAttendanceDetails("present", {
        absenceJustified: false,
        lateMinutes: "invalid",
        earlyDepartureMinutes: "900"
      })
    ).toEqual({ absenceJustified: undefined, lateMinutes: undefined, earlyDepartureMinutes: 720 });
  });

  it("does not reuse an attendance row from a different session scope", () => {
    const entry: AttendanceEntry = {
      id: "attendance-1",
      classId: "class-a",
      subjectId: "subject-a",
      studentId: "student-a",
      date: "2026-08-05",
      scheduleSlotId: "slot-a",
      status: "present",
      createdAt: "2026-08-05T08:00:00.000Z",
      updatedAt: "2026-08-05T08:00:00.000Z"
    };

    expect(matchesAttendanceScope(entry, {
      classId: "class-a",
      subjectId: "subject-a",
      date: "2026-08-05",
      scheduleSlotId: "slot-a"
    })).toBe(true);
    expect(matchesAttendanceScope(entry, {
      classId: "class-a",
      subjectId: "subject-a",
      date: "2026-08-06",
      scheduleSlotId: "slot-a"
    })).toBe(false);
  });
});
