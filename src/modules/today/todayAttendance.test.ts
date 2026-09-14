import { describe, expect, it } from "vitest";
import { buildAllPresentDraft } from "./todayAttendance";

describe("buildAllPresentDraft", () => {
  it("keeps the draft empty when every student is already present", () => {
    const result = buildAllPresentDraft(
      ["student-1", "student-2"],
      new Map([
        ["student-1", "present" as const],
        ["student-2", "present" as const]
      ])
    );

    expect(Array.from(result.entries())).toEqual([]);
  });

  it("overrides only saved attendance exceptions", () => {
    const result = buildAllPresentDraft(
      ["student-1", "student-2", "student-3"],
      new Map([
        ["student-1", "late" as const],
        ["student-2", "absent" as const],
        ["student-3", "present" as const]
      ])
    );

    expect(Array.from(result.entries())).toEqual([
      ["student-1", "present"],
      ["student-2", "present"]
    ]);
  });

  it("treats a missing saved status as present", () => {
    expect(buildAllPresentDraft(["student-1"], new Map()).size).toBe(0);
  });
});
