import type { ClassroomLayout, Student } from "../db/types";

export const MIN_LAYOUT_DIMENSION = 2;
export const MAX_LAYOUT_DIMENSION = 12;

export function clampLayoutDimension(value: number): number {
  return Math.min(MAX_LAYOUT_DIMENSION, Math.max(MIN_LAYOUT_DIMENSION, Math.round(value) || MIN_LAYOUT_DIMENSION));
}

export function defaultLayoutDimensions(studentCount: number): { rows: number; columns: number } {
  const columns = clampLayoutDimension(Math.ceil(Math.sqrt(Math.max(1, studentCount))));
  const rows = clampLayoutDimension(Math.ceil(Math.max(1, studentCount) / columns));
  return { rows, columns };
}

export function sanitizeSeatAssignments(
  assignments: Record<string, number>,
  studentIds: Set<string>,
  capacity: number
): Record<string, number> {
  const normalized: Record<string, number> = {};
  const occupiedSeats = new Set<number>();
  for (const [studentId, seat] of Object.entries(assignments)) {
    if (!studentIds.has(studentId) || !Number.isInteger(seat) || seat < 0 || seat >= capacity || occupiedSeats.has(seat)) {
      continue;
    }
    normalized[studentId] = seat;
    occupiedSeats.add(seat);
  }
  return normalized;
}

export function assignStudentToSeat(
  assignments: Record<string, number>,
  studentId: string,
  targetSeat: number | null
): Record<string, number> {
  const next = { ...assignments };
  const previousSeat = next[studentId];
  delete next[studentId];
  if (targetSeat === null) return next;

  const displacedStudentId = Object.entries(next).find(([, seat]) => seat === targetSeat)?.[0];
  if (displacedStudentId) {
    if (previousSeat === undefined) delete next[displacedStudentId];
    else next[displacedStudentId] = previousSeat;
  }
  next[studentId] = targetSeat;
  return next;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(random() * (index + 1));
    [result[index], result[otherIndex]] = [result[otherIndex], result[index]];
  }
  return result;
}

export function randomSeatAssignments(studentIds: string[], capacity: number, random = Math.random): Record<string, number> {
  const seats = shuffled(Array.from({ length: capacity }, (_, index) => index), random);
  return Object.fromEntries(shuffled(studentIds, random).slice(0, capacity).map((studentId, index) => [studentId, seats[index]]));
}

export function generateStudentGroups<T>(students: T[], groupCountValue: number, random = Math.random): T[][] {
  if (students.length === 0) return [];
  const groupCount = Math.min(students.length, Math.max(1, Math.round(groupCountValue) || 1));
  const groups = Array.from({ length: groupCount }, () => [] as T[]);
  shuffled(students, random).forEach((student, index) => groups[index % groupCount].push(student));
  return groups;
}

export function pickNextStudent<T extends { id: string }>(
  students: T[],
  pickedIds: Set<string>,
  random = Math.random
): { student: T | null; nextPickedIds: Set<string> } {
  if (students.length === 0) return { student: null, nextPickedIds: new Set() };
  const available = students.filter((student) => !pickedIds.has(student.id));
  const pool = available.length > 0 ? available : students;
  const nextPickedIds = available.length > 0 ? new Set(pickedIds) : new Set<string>();
  const student = pool[Math.floor(random() * pool.length)] ?? pool[0];
  nextPickedIds.add(student.id);
  return { student, nextPickedIds };
}

export function createDefaultClassroomLayout(
  classId: string,
  students: Student[],
  now = new Date().toISOString()
): ClassroomLayout {
  const { rows, columns } = defaultLayoutDimensions(students.length);
  return {
    id: classId,
    classId,
    rows,
    columns,
    assignments: Object.fromEntries(students.slice(0, rows * columns).map((student, index) => [student.id, index])),
    createdAt: now,
    updatedAt: now
  };
}
