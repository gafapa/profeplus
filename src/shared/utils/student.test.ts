import { describe, expect, it } from "vitest";
import type { Student } from "../db/types";
import { compareStudentsByField, formatStudentName, splitFullName } from "./student";

const createStudent = (firstName: string, lastName: string): Student => ({
  id: `${firstName}-${lastName}`,
    classId: "",
  firstName,
  lastName,
  fullName: `${firstName} ${lastName}`.trim()
});

describe("student utilities", () => {
  it("splits a full name into first and last name fields", () => {
    expect(splitFullName(" Ana Maria Lopez ")).toEqual({
      firstName: "Ana Maria",
      lastName: "Lopez"
    });
  });

  it("formats names according to the selected display preference", () => {
    const student = createStudent("Ana", "Lopez");
    expect(formatStudentName(student, "firstLast")).toBe("Ana Lopez");
    expect(formatStudentName(student, "lastFirst")).toBe("Lopez, Ana");
  });

  it("sorts by first name when requested", () => {
    const students = [createStudent("Bea", "Alonso"), createStudent("Ana", "Zulueta")];
    expect([...students].sort(compareStudentsByField("firstName")).map((student) => student.firstName)).toEqual([
      "Ana",
      "Bea"
    ]);
  });
});
