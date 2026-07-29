import { describe, expect, it } from "vitest";
import { canQuickAssignTask, completesTaskWithNextSession, countsAsPlannedSession } from "./quickAssignment";

describe("quick planner assignment", () => {
  it("only enables empty cells for the selected subject", () => {
    expect(canQuickAssignTask("math", "math", false)).toBe(true);
    expect(canQuickAssignTask("math", "language", false)).toBe(false);
    expect(canQuickAssignTask("math", "math", true)).toBe(false);
  });

  it("keeps multi-session tasks selected until the last required session", () => {
    expect(completesTaskWithNextSession(0, 3)).toBe(false);
    expect(completesTaskWithNextSession(1, 3)).toBe(false);
    expect(completesTaskWithNextSession(2, 3)).toBe(true);
  });

  it("does not count cancelled or calendar-incompatible sessions as planned", () => {
    expect(countsAsPlannedSession("planned", 1, 1, true)).toBe(true);
    expect(countsAsPlannedSession("cancelled", 1, 1, true)).toBe(false);
    expect(countsAsPlannedSession("planned", 2, 1, true)).toBe(false);
    expect(countsAsPlannedSession("planned", 1, 1, false)).toBe(false);
  });
});
