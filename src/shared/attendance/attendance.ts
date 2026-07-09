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
