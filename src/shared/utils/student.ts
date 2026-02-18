import type { Student } from "../db/types";

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const normalized = fullName.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }
  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join("")
  };
}

export function getStudentFullName(student: Student): string {
  const composed = `${student.firstName} ${student.lastName}`.trim();
  if (composed) {
    return composed;
  }
  return student.fullName;
}

