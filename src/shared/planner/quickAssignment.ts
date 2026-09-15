// A cell can hold several tasks (one per subject conflict-free slot), so this only
// blocks assigning the *same* task twice into one cell - not any occupied cell.
export function canQuickAssignTask(
  selectedSubjectId: string | undefined,
  cellSubjectId: string,
  hasSessionForTask: boolean
): boolean {
  return Boolean(selectedSubjectId) && selectedSubjectId === cellSubjectId && !hasSessionForTask;
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
