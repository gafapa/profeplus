import type { TaskSession } from "../db/types";

export type SessionStatus = NonNullable<TaskSession["status"]>;

export type SessionPlanDraft = {
  status: SessionStatus;
  objectives: string;
  competencies: string;
  materials: string;
  homework: string;
  teacherNotes: string;
};

export const SESSION_STATUSES: SessionStatus[] = ["planned", "done", "moved", "cancelled"];

export function sessionStatusLabel(status: SessionStatus): string {
  if (status === "done") return "Realizada";
  if (status === "moved") return "Reprogramada";
  if (status === "cancelled") return "Cancelada";
  return "Planificada";
}

export function sessionPlanDraftFromSession(session?: TaskSession): SessionPlanDraft {
  return {
    status: session?.status ?? "planned",
    objectives: session?.objectives ?? "",
    competencies: session?.competencies ?? "",
    materials: session?.materials ?? "",
    homework: session?.homework ?? "",
    teacherNotes: session?.teacherNotes ?? ""
  };
}

export function normalizeSessionPlanDraft(draft: SessionPlanDraft): Pick<
  TaskSession,
  "status" | "objectives" | "competencies" | "materials" | "homework" | "teacherNotes"
> {
  const status = SESSION_STATUSES.includes(draft.status) ? draft.status : "planned";
  const clean = (value: string): string | undefined => value.trim() || undefined;
  return {
    status,
    objectives: clean(draft.objectives),
    competencies: clean(draft.competencies),
    materials: clean(draft.materials),
    homework: clean(draft.homework),
    teacherNotes: clean(draft.teacherNotes)
  };
}
