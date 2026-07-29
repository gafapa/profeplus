import type { TaskSession } from "../../shared/db/types";

export type TaskSessionAcademicContext = Pick<TaskSession, "classId" | "subjectId">;

export type TaskSessionEvaluationContext = TaskSessionAcademicContext & Pick<TaskSession, "taskId">;

export function filterTaskSessionsByAcademicContext(
  sessions: TaskSession[],
  context: TaskSessionAcademicContext
): TaskSession[] {
  return sessions.filter(
    (session) => session.classId === context.classId && session.subjectId === context.subjectId
  );
}

export function filterTaskSessionsForEvaluation(
  sessions: TaskSession[],
  context: TaskSessionEvaluationContext
): TaskSession[] {
  return filterTaskSessionsByAcademicContext(sessions, context).filter(
    (session) => session.taskId === context.taskId
  );
}

export function selectTaskSessionByDateAndSlot(
  sessions: TaskSession[],
  date: string,
  scheduleSlotId: string
): TaskSession | null {
  return (
    sessions.find((session) => session.scheduleSlotId === scheduleSlotId && session.date === date) ??
    sessions.find((session) => session.scheduleSlotId === scheduleSlotId) ??
    sessions[0] ??
    null
  );
}
