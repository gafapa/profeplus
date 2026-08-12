import { describe, expect, it } from "vitest";
import {
  assignStudentToSeat,
  defaultLayoutDimensions,
  generateStudentGroups,
  pickNextStudent,
  randomSeatAssignments,
  sanitizeSeatAssignments
} from "./layout";

describe("classroom layout", () => {
  it("creates dimensions that fit a typical class", () => {
    expect(defaultLayoutDimensions(25)).toEqual({ rows: 5, columns: 5 });
    expect(defaultLayoutDimensions(1)).toEqual({ rows: 2, columns: 2 });
  });

  it("removes missing students, duplicate seats, and out-of-range seats", () => {
    expect(sanitizeSeatAssignments({ a: 0, b: 0, c: 6, missing: 1 }, new Set(["a", "b", "c"]), 4)).toEqual({ a: 0 });
  });

  it("swaps an occupied seat and can unassign a student", () => {
    expect(assignStudentToSeat({ a: 0, b: 1 }, "a", 1)).toEqual({ a: 1, b: 0 });
    expect(assignStudentToSeat({ a: 0, b: 1 }, "a", null)).toEqual({ b: 1 });
  });

  it("creates unique random seat assignments", () => {
    const assignments = randomSeatAssignments(["a", "b", "c"], 4, () => 0.25);
    expect(Object.keys(assignments)).toHaveLength(3);
    expect(new Set(Object.values(assignments)).size).toBe(3);
  });

  it("generates balanced groups", () => {
    const groups = generateStudentGroups([1, 2, 3, 4, 5], 2, () => 0.5);
    expect(groups.map((group) => group.length).sort()).toEqual([2, 3]);
    expect(groups.flat().sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("does not repeat a random pick until the pool is exhausted", () => {
    const students = [{ id: "a" }, { id: "b" }];
    const first = pickNextStudent(students, new Set(), () => 0);
    const second = pickNextStudent(students, first.nextPickedIds, () => 0);
    const third = pickNextStudent(students, second.nextPickedIds, () => 0);
    expect([first.student?.id, second.student?.id, third.student?.id]).toEqual(["a", "b", "a"]);
  });
});
