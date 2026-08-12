import { describe, expect, it } from "vitest";
import { buildSearchResults, type SearchData } from "./search";

const data: SearchData = {
  classGroups: [{ id: "class-1", name: "1 ESO A", level: "ESO", schoolYear: "2026-2027" }],
  students: [{ id: "student-1", classId: "class-1", firstName: "Ángela", lastName: "López", fullName: "Ángela López", comments: "Needs reading support" }],
  subjects: [{ id: "subject-1", name: "Matemáticas", scheduleSlotIds: [] }],
  subjectCourseLinks: [{ id: "course-link-1", subjectId: "subject-1", classId: "class-1" }],
  tasks: [{ id: "task-1", title: "Fractions project", description: "Collaborative poster", sessionCount: 2, sendToGradebook: false }],
  taskSubjectLinks: [{ id: "task-link-1", taskId: "task-1", subjectId: "subject-1" }],
  assessments: [{ id: "assessment-1", classId: "class-1", subjectId: "subject-1", title: "Problem solving", weight: 1, period: "First term", competency: "Mathematical reasoning" }],
  followUps: [{ id: "follow-1", studentId: "student-1", classId: "class-1", date: "2026-08-12", kind: "tutorial", title: "Reading review", notes: "Coordinate support", resolved: false }],
  familyContacts: [],
  resources: []
};

describe("global search", () => {
  it("matches accents and secondary fields", () => {
    expect(buildSearchResults(data, "angela")[0]).toMatchObject({ kind: "student", classId: "class-1" });
    expect(buildSearchResults(data, "collaborative")[0]).toMatchObject({ kind: "task", subjectId: "subject-1" });
    expect(buildSearchResults(data, "reasoning")[0]).toMatchObject({ kind: "assessment" });
  });

  it("finds follow-up notes and returns contextual student navigation", () => {
    expect(buildSearchResults(data, "support")).toContainEqual(
      expect.objectContaining({ kind: "followUp", href: "/management/students?studentId=student-1" })
    );
  });

  it("requires at least two normalized characters", () => {
    expect(buildSearchResults(data, "a")).toEqual([]);
  });
});
