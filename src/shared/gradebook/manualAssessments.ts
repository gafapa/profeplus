import type { Assessment, GradeEntry } from "../db/types";

export type ManualAssessmentDraft = {
  title: string;
  weight: string;
  period: string;
  competency: string;
  groupId: string;
};

export function parseManualGradeValue(rawValue: string): number | null {
  const normalized = rawValue.replace(",", ".").trim();
  if (normalized.length === 0) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
    return Number.NaN;
  }
  return Number(parsed.toFixed(2));
}

export function normalizeManualAssessmentDraft(draft: ManualAssessmentDraft): {
  title: string;
  weight: number;
  period: string;
  competency?: string;
  groupId?: string;
} | null {
  const title = draft.title.trim();
  if (title.length < 2) {
    return null;
  }

  const normalizedWeight = draft.weight.replace(",", ".").trim();
  const weight = normalizedWeight.length > 0 ? Number(normalizedWeight) : 0;
  if (!Number.isFinite(weight) || weight < 0) {
    return null;
  }

  return {
    title,
    weight: Number(weight.toFixed(2)),
    period: draft.period.trim(),
    competency: draft.competency.trim() || undefined,
    groupId: draft.groupId || undefined
  };
}

export function buildManualGradeEntry(input: {
  existingEntry?: GradeEntry;
  classId: string;
  assessment: Assessment;
  studentId: string;
  numericValue?: number;
  comment?: string;
}): GradeEntry {
  const comment = input.comment === undefined ? input.existingEntry?.comment : input.comment.trim() || undefined;
  return {
    id: input.existingEntry?.id ?? `grade-${input.assessment.id}-${input.studentId}`,
    classId: input.classId,
    assessmentId: input.assessment.id,
    studentId: input.studentId,
    numericValue: input.numericValue,
    comment,
    colorTag: input.existingEntry?.colorTag,
    iconTag: input.existingEntry?.iconTag,
    textValue: input.existingEntry?.textValue
  };
}
