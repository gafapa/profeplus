import { describe, expect, it } from "vitest";
import type { Assessment, GradeEntry } from "../db/types";
import {
  buildManualGradeEntry,
  normalizeManualAssessmentDraft,
  parseManualGradeValue,
  resolveGradeEntryScore,
  resolveGradeEntryStatus
} from "./manualAssessments";

describe("manual assessment helpers", () => {
  it("parses empty grades as deletion and accepts comma decimals", () => {
    expect(parseManualGradeValue("")).toBeNull();
    expect(parseManualGradeValue("  ")).toBeNull();
    expect(parseManualGradeValue("7,25")).toBe(7.25);
    expect(parseManualGradeValue("10")).toBe(10);
  });

  it("rejects manual grades outside the 0-10 range", () => {
    expect(Number.isNaN(parseManualGradeValue("-1"))).toBe(true);
    expect(Number.isNaN(parseManualGradeValue("10.5"))).toBe(true);
    expect(Number.isNaN(parseManualGradeValue("abc"))).toBe(true);
  });

  it("normalizes assessment drafts", () => {
    expect(
      normalizeManualAssessmentDraft({
        title: "  Exam 1  ",
        weight: "2,5",
        period: "  Term 1 ",
        competency: "  Problem solving ",
        groupId: ""
      })
    ).toEqual({
      title: "Exam 1",
      weight: 2.5,
      period: "Term 1",
      competency: "Problem solving",
      groupId: undefined
    });
  });

  it("rejects invalid assessment drafts", () => {
    expect(
      normalizeManualAssessmentDraft({
        title: "A",
        weight: "1",
        period: "",
        competency: "",
        groupId: ""
      })
    ).toBeNull();
    expect(
      normalizeManualAssessmentDraft({
        title: "Exam",
        weight: "-1",
        period: "",
        competency: "",
        groupId: ""
      })
    ).toBeNull();
  });

  it("builds grade entries while preserving existing metadata", () => {
    const assessment: Assessment = {
      id: "assessment-1",
      classId: "class-1",
      subjectId: "subject-1",
      title: "Exam",
      weight: 1,
      period: ""
    };
    const existingEntry: GradeEntry = {
      id: "entry-1",
      classId: "class-1",
      assessmentId: "assessment-1",
      studentId: "student-1",
      numericValue: 4,
      comment: "Needs review",
      colorTag: "red"
    };

    expect(
      buildManualGradeEntry({
        existingEntry,
        classId: "class-1",
        assessment,
        studentId: "student-1",
        numericValue: 8.5,
        comment: "Updated"
      })
    ).toEqual({
      ...existingEntry,
      numericValue: 8.5,
      status: "graded",
      comment: "Updated",
      iconTag: undefined,
      textValue: undefined
    });
  });

  it("builds comment-only grade entries for report observations", () => {
    const assessment: Assessment = {
      id: "assessment-1",
      classId: "class-1",
      subjectId: "subject-1",
      title: "Exam",
      weight: 1,
      period: ""
    };

    expect(
      buildManualGradeEntry({
        classId: "class-1",
        assessment,
        studentId: "student-1",
        comment: "Needs family follow-up"
      })
    ).toEqual({
      id: "grade-assessment-1-student-1",
      classId: "class-1",
      assessmentId: "assessment-1",
      studentId: "student-1",
      numericValue: undefined,
      status: "pending",
      comment: "Needs family follow-up",
      colorTag: undefined,
      iconTag: undefined,
      textValue: undefined
    });
  });

  it("resolves explicit grade statuses and the not-submitted policy", () => {
    const baseEntry: GradeEntry = {
      id: "entry-1",
      classId: "class-1",
      assessmentId: "assessment-1",
      studentId: "student-1",
      numericValue: 8
    };

    expect(resolveGradeEntryStatus(baseEntry)).toBe("graded");
    expect(resolveGradeEntryScore(baseEntry, "exclude")).toBe(8);
    expect(resolveGradeEntryScore({ ...baseEntry, status: "pending" }, "zero")).toBeNull();
    expect(resolveGradeEntryScore({ ...baseEntry, status: "exempt" }, "zero")).toBeNull();
    expect(resolveGradeEntryScore({ ...baseEntry, status: "notSubmitted" }, "exclude")).toBeNull();
    expect(resolveGradeEntryScore({ ...baseEntry, status: "notSubmitted" }, "zero")).toBe(0);
  });
});
