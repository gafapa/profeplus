import { describe, expect, it } from "vitest";
import type { ClassGroup, Student } from "../db/types";
import type { ParsedStudentCsvGroup } from "./studentsCsv";
import { prepareGroupedStudentsImport } from "./groupedStudentsImport";

const csvGroup: ParsedStudentCsvGroup = {
  key: "2o eso::a",
  course: "2º ESO",
  group: "A",
  name: "2º ESO A",
  students: [
    {
      sourceId: "A-001",
      sourceRow: 2,
      firstName: "Ana",
      lastName: "García López",
      email: "ana@example.com",
      comments: "Seguimiento",
      hasAcs: false,
      hasReinforcement: false
    }
  ]
};

function idFactory(...ids: string[]): () => string {
  let index = 0;
  return () => ids[index++] ?? `id-${index}`;
}

describe("grouped students import plan", () => {
  it("creates the selected course and its students", () => {
    const plan = prepareGroupedStudentsImport({
      selectedGroups: [csvGroup],
      schoolYear: "2026-2027",
      existingCourses: [],
      existingStudents: [],
      createId: idFactory("course-1", "student-1")
    });

    expect(plan.coursesToAdd).toEqual([
      { id: "course-1", name: "2º ESO A", level: "2º ESO", schoolYear: "2026-2027" }
    ]);
    expect(plan.studentsToAdd).toEqual([
      expect.objectContaining({
        id: "student-1",
        personId: "A-001",
        classId: "course-1",
        firstName: "Ana",
        lastName: "García López",
        email: "ana@example.com",
        comments: "Seguimiento"
      })
    ]);
    expect(plan.selectedCourseIds).toEqual(["course-1"]);
  });

  it("reuses an existing course for the same school year", () => {
    const existingCourse: ClassGroup = {
      id: "course-existing",
      name: "2º ESO A",
      level: "2º ESO",
      schoolYear: "2026-2027"
    };
    const plan = prepareGroupedStudentsImport({
      selectedGroups: [csvGroup],
      schoolYear: "2026-2027",
      existingCourses: [existingCourse],
      existingStudents: [],
      createId: idFactory("student-1")
    });

    expect(plan.coursesToAdd).toEqual([]);
    expect(plan.studentsToAdd[0]).toMatchObject({ id: "student-1", classId: "course-existing" });
  });

  it("skips a student already in the target course", () => {
    const existingCourse: ClassGroup = {
      id: "course-existing",
      name: "2º ESO A",
      level: "2º ESO",
      schoolYear: "2026-2027"
    };
    const existingStudent: Student = {
      id: "student-existing",
      personId: "A-001",
      classId: "course-existing",
      firstName: "Ana",
      lastName: "García López",
      fullName: "Ana García López"
    };
    const plan = prepareGroupedStudentsImport({
      selectedGroups: [csvGroup],
      schoolYear: "2026-2027",
      existingCourses: [existingCourse],
      existingStudents: [existingStudent]
    });

    expect(plan.studentsToAdd).toEqual([]);
    expect(plan.skippedExistingCount).toBe(1);
    expect(plan.conflictingStudentCount).toBe(0);
  });

  it("does not silently move a matching student from another course", () => {
    const existingStudent: Student = {
      id: "student-existing",
      personId: "A-001",
      classId: "another-course",
      firstName: "Ana",
      lastName: "García López",
      fullName: "Ana García López"
    };
    const plan = prepareGroupedStudentsImport({
      selectedGroups: [csvGroup],
      schoolYear: "2026-2027",
      existingCourses: [],
      existingStudents: [existingStudent],
      createId: idFactory("course-1")
    });

    expect(plan.coursesToAdd).toEqual([]);
    expect(plan.studentsToAdd).toEqual([]);
    expect(plan.conflictingStudentCount).toBe(1);
  });

  it("derives per-group results cumulatively when a student code appears in two selected groups", () => {
    const secondGroup: ParsedStudentCsvGroup = {
      ...csvGroup,
      key: "3o eso::b",
      course: "3º ESO",
      group: "B",
      name: "3º ESO B"
    };
    const plan = prepareGroupedStudentsImport({
      selectedGroups: [csvGroup, secondGroup],
      schoolYear: "2026-2027",
      existingCourses: [],
      existingStudents: [],
      createId: idFactory("course-1", "student-1", "course-2")
    });

    expect(plan.coursesToAdd.map((course) => course.name)).toEqual(["2º ESO A"]);
    expect(plan.studentsToAdd).toHaveLength(1);
    expect(plan.groupResults).toEqual([
      expect.objectContaining({
        groupKey: "2o eso::a",
        courseCreated: true,
        studentsToAdd: 1,
        conflictingStudentCount: 0
      }),
      expect.objectContaining({
        groupKey: "3o eso::b",
        courseCreated: false,
        studentsToAdd: 0,
        conflictingStudentCount: 1
      })
    ]);
  });
});
