export function normalizeAttendanceNote(value: string | undefined): string | undefined {
  const note = value?.trim() ?? "";
  return note || undefined;
}

export function resolveAttendanceNoteForSave(
  studentId: string,
  noteDraftByStudent: Map<string, string>,
  existingNote: string | undefined
): string | undefined {
  if (noteDraftByStudent.has(studentId)) {
    return normalizeAttendanceNote(noteDraftByStudent.get(studentId));
  }
  return normalizeAttendanceNote(existingNote);
}

export type AttendanceDetailsDraft = {
  absenceJustified: boolean;
  lateMinutes: string;
  earlyDepartureMinutes: string;
};

export type NormalizedAttendanceDetails = {
  absenceJustified?: boolean;
  lateMinutes?: number;
  earlyDepartureMinutes?: number;
};

function normalizeMinutes(value: string): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.min(720, Math.round(parsed));
}

export function normalizeAttendanceDetails(
  status: "present" | "late" | "absent",
  draft: AttendanceDetailsDraft
): NormalizedAttendanceDetails {
  return {
    absenceJustified: status === "absent" && draft.absenceJustified ? true : undefined,
    lateMinutes: status === "late" ? normalizeMinutes(draft.lateMinutes) : undefined,
    earlyDepartureMinutes: normalizeMinutes(draft.earlyDepartureMinutes)
  };
}
