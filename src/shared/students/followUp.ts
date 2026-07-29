import type { StudentFollowUpKind } from "../db/types";

export const FOLLOW_UP_KINDS: StudentFollowUpKind[] = [
  "incident",
  "family",
  "tutorial",
  "agreement",
  "adaptation",
  "wellbeing"
];

export type StudentFollowUpDraft = {
  date: string;
  kind: StudentFollowUpKind;
  title: string;
  notes: string;
  nextStep: string;
  resolved: boolean;
};

export function followUpKindLabel(kind: StudentFollowUpKind): string {
  if (kind === "incident") return "Incidencia";
  if (kind === "family") return "Familia";
  if (kind === "tutorial") return "Tutoría";
  if (kind === "agreement") return "Acuerdo";
  if (kind === "adaptation") return "Adaptación";
  return "Bienestar";
}

export function defaultFollowUpDraft(date: string): StudentFollowUpDraft {
  return {
    date,
    kind: "tutorial",
    title: "",
    notes: "",
    nextStep: "",
    resolved: false
  };
}

export function normalizeFollowUpDraft(draft: StudentFollowUpDraft): {
  date: string;
  kind: StudentFollowUpKind;
  title: string;
  notes: string;
  nextStep?: string;
  resolved: boolean;
} | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
    return null;
  }
  if (!FOLLOW_UP_KINDS.includes(draft.kind)) {
    return null;
  }
  const title = draft.title.trim();
  const notes = draft.notes.trim();
  if (title.length < 2 || notes.length < 2) {
    return null;
  }
  return {
    date: draft.date,
    kind: draft.kind,
    title,
    notes,
    nextStep: draft.nextStep.trim() || undefined,
    resolved: draft.resolved
  };
}
