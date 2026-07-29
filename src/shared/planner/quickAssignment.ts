export function canQuickAssignTask(
  selectedSubjectId: string | undefined,
  cellSubjectId: string,
  hasSession: boolean
): boolean {
  return Boolean(selectedSubjectId) && selectedSubjectId === cellSubjectId && !hasSession;
}

export function completesTaskWithNextSession(planned: number, expected: number): boolean {
  return planned + 1 >= Math.max(1, expected);
}

export function countsAsPlannedSession(
  status: TaskSession["status"],
  sessionDayOfWeek: number,
  slotDayOfWeek: number | undefined,
  subjectHasSlot: boolean
): boolean {
  return status !== "cancelled" && subjectHasSlot && slotDayOfWeek === sessionDayOfWeek;
}
import type { TaskSession } from "../db/types";
