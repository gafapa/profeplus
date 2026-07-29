import { describe, expect, it } from "vitest";
import type { ScheduleDay } from "../db/types";
import { removedActiveScheduleSlotIds, validateScheduleDay } from "./validation";

function scheduleDay(overrides: Partial<ScheduleDay> = {}): ScheduleDay {
  return {
    id: "monday",
    dayOfWeek: 1,
    dayName: "Lunes",
    enabled: true,
    blocks: [
      { id: "one", startTime: "08:00", endTime: "08:55" },
      { id: "two", startTime: "09:00", endTime: "09:55" }
    ],
    ...overrides
  };
}

describe("validateScheduleDay", () => {
  it("accepts ordered non-overlapping class and break blocks", () => {
    expect(validateScheduleDay(scheduleDay())).toBeNull();
  });

  it("rejects blocks that end before they start", () => {
    const error = validateScheduleDay(
      scheduleDay({ blocks: [{ id: "one", startTime: "09:00", endTime: "08:55" }] })
    );

    expect(error).toContain("después de empezar");
  });

  it("rejects overlapping blocks regardless of their stored order", () => {
    const error = validateScheduleDay(
      scheduleDay({
        blocks: [
          { id: "two", startTime: "08:45", endTime: "09:30", isBreak: true },
          { id: "one", startTime: "08:00", endTime: "08:55" }
        ]
      })
    );

    expect(error).toContain("se solapan");
  });
});

describe("removedActiveScheduleSlotIds", () => {
  it("treats every class block as removed when an active day is disabled", () => {
    const previousDay = scheduleDay();
    const nextDay = scheduleDay({ enabled: false });

    expect(removedActiveScheduleSlotIds(previousDay, nextDay)).toEqual(["one", "two"]);
  });

  it("includes blocks converted into breaks", () => {
    const previousDay = scheduleDay();
    const nextDay = scheduleDay({
      blocks: [
        { id: "one", startTime: "08:00", endTime: "08:55", isBreak: true },
        { id: "two", startTime: "09:00", endTime: "09:55" }
      ]
    });

    expect(removedActiveScheduleSlotIds(previousDay, nextDay)).toEqual(["one"]);
  });
});
