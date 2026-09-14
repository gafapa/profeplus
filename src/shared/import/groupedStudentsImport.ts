import type { ClassGroup, Student } from "../db/types";
import type { ParsedStudentCsvGroup } from "./studentsCsv";

export type GroupedStudentsImportPlan = {
  coursesToAdd: ClassGroup[];
  studentsToAdd: Student[];
  selectedCourseIds: string[];
  skippedExistingCount: number;
  conflictingStudentCount: number;
  groupResults: GroupedStudentsImportGroupResult[];
};

export type GroupedStudentsImportGroupResult = {
  groupKey: string;
  courseCreated: boolean;
  studentsToAdd: number;
  skippedExistingCount: number;
  conflictingStudentCount: number;
};

type GroupedStudentsImportPlanInput = {
  selectedGroups: ParsedStudentCsvGroup[];
  schoolYear: string;
  existingCourses: ClassGroup[];
  existingStudents: Student[];
  createId?: () => string;
};

function normalizeIdentity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function courseIdentity(name: string, schoolYear: string): string {
  return `${normalizeIdentity(name)}::${normalizeIdentity(schoolYear)}`;
}

function studentNameIdentity(firstName: string, lastName: string): string {
  return normalizeIdentity(`${firstName} ${lastName}`);
}

export function prepareGroupedStudentsImport({
  selectedGroups,
  schoolYear,
  existingCourses,
  existingStudents,
  createId = () => crypto.randomUUID()
}: GroupedStudentsImportPlanInput): GroupedStudentsImportPlan {
  const coursesToAdd: ClassGroup[] = [];
  const studentsToAdd: Student[] = [];
  const selectedCourseIds: string[] = [];
  const coursesByIdentity = new Map(
    existingCourses.map((course) => [courseIdentity(course.name, course.schoolYear), course])
  );
  const knownStudents = [...existingStudents];
  const groupResults: GroupedStudentsImportGroupResult[] = [];
  let skippedExistingCount = 0;
  let conflictingStudentCount = 0;

  for (const group of selectedGroups) {
    const identity = courseIdentity(group.name, schoolYear);
    const existingCourse = coursesByIdentity.get(identity);
    const targetCourse =
      existingCourse ?? {
        id: createId(),
        name: group.name,
        level: group.course,
        schoolYear
      };
    const studentCountBeforeGroup = studentsToAdd.length;
    const skippedCountBeforeGroup = skippedExistingCount;
    const conflictCountBeforeGroup = conflictingStudentCount;

    for (const row of group.students) {
      const sourceMatch = row.sourceId
        ? knownStudents.find((student) => student.personId === row.sourceId)
        : undefined;
      if (sourceMatch) {
        if (sourceMatch.classId === targetCourse.id) {
          skippedExistingCount += 1;
        } else {
          conflictingStudentCount += 1;
        }
        continue;
      }

      const nameIdentity = studentNameIdentity(row.firstName, row.lastName);
      const nameMatch = knownStudents.some(
        (student) =>
          student.classId === targetCourse.id &&
          studentNameIdentity(student.firstName, student.lastName) === nameIdentity
      );
      if (nameMatch) {
        skippedExistingCount += 1;
        continue;
      }

      const id = createId();
      const student: Student = {
        id,
        personId: row.sourceId || id,
        classId: targetCourse.id,
        firstName: row.firstName,
        lastName: row.lastName,
        fullName: `${row.firstName} ${row.lastName}`.trim(),
        email: row.email,
        comments: row.comments,
        hasAcs: false,
        hasReinforcement: false
      };
      studentsToAdd.push(student);
      knownStudents.push(student);
    }

    if (existingCourse || studentsToAdd.length > studentCountBeforeGroup) {
      selectedCourseIds.push(targetCourse.id);
    }
    if (!existingCourse && studentsToAdd.length > studentCountBeforeGroup) {
      coursesToAdd.push(targetCourse);
      coursesByIdentity.set(identity, targetCourse);
    }
    groupResults.push({
      groupKey: group.key,
      courseCreated: !existingCourse && studentsToAdd.length > studentCountBeforeGroup,
      studentsToAdd: studentsToAdd.length - studentCountBeforeGroup,
      skippedExistingCount: skippedExistingCount - skippedCountBeforeGroup,
      conflictingStudentCount: conflictingStudentCount - conflictCountBeforeGroup
    });
  }

  return {
    coursesToAdd,
    studentsToAdd,
    selectedCourseIds,
    skippedExistingCount,
    conflictingStudentCount,
    groupResults
  };
}
