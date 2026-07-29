import { describe, expect, it } from "vitest";
import type { AttendanceEntry } from "../../shared/db/types";
import {
  buildTodayLink,
  formatAttendanceDetails,
  formatAttendanceStatus
} from "./AttendanceHistoryPage";

const entry: AttendanceEntry = {
  id: "attendance-1",
  classId: "class-1",
  subjectId: "subject-1",
  studentId: "student-1",
  date: "2026-07-10",
  scheduleSlotId: "slot-2",
  status: "late",
  createdAt: "2026-07-10T08:00:00.000Z",
  updatedAt: "2026-07-10T08:00:00.000Z"
};

describe("buildTodayLink", () => {
  it("preserves date, class, subject, and slot context", () => {
    const link = buildTodayLink(entry);
    const url = new URL(link, "https://profeplus.local");

    expect(url.pathname).toBe("/today");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      date: "2026-07-10",
      classId: "class-1",
      slotId: "slot-2",
      subjectId: "subject-1"
    });
  });

  it("uses the subject stored in the attendance record", () => {
    const link = buildTodayLink({ ...entry, subjectId: "subject-historical" });
    const url = new URL(link, "https://profeplus.local");

    expect(url.searchParams.get("subjectId")).toBe("subject-historical");
  });

  it("formats justified absences and timed attendance details", () => {
    expect(
      formatAttendanceStatus({
        ...entry,
        status: "absent",
        absenceJustified: true
      })
    ).toBe("Ausencia justificada");
    expect(formatAttendanceStatus({ ...entry, lateMinutes: 12 })).toBe("Retraso · 12 min");
    expect(
      formatAttendanceDetails({
        ...entry,
        earlyDepartureMinutes: 20,
        note: "Recogida familiar"
      })
    ).toBe("Salida anticipada: 20 min · Recogida familiar");
  });
});
