import type { AttendanceEntry } from "../../shared/db/types";

type AttendanceStatus = AttendanceEntry["status"];

export function buildAllPresentDraft(
  studentIds: readonly string[],
  baseStatusByStudent: ReadonlyMap<string, AttendanceStatus>
): Map<string, AttendanceStatus> {
  const draft = new Map<string, AttendanceStatus>();
  for (const studentId of studentIds) {
    if ((baseStatusByStudent.get(studentId) ?? "present") !== "present") {
      draft.set(studentId, "present");
    }
  }
  return draft;
}
