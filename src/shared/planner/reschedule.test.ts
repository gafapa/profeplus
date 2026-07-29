import { describe, expect, it } from "vitest";
import type { ScheduleDay, Subject } from "../db/types";
import { availableRescheduleBlocks } from "./reschedule";

const subject: Subject = {
  id: "math",
  name: "Matemáticas",
  scheduleSlotIds: ["monday-class", "monday-break"]
};

const scheduleDays: ScheduleDay[] = [
  {
    id: "monday",
    dayOfWeek: 1,
    dayName: "Lunes",
    enabled: true,
    blocks: [
      { id: "monday-class", startTime: "08:00", endTime: "08:55" },
      { id: "monday-break", startTime: "08:55", endTime: "09:15", isBreak: true }
    ]
  },
  {
    id: "tuesday",
    dayOfWeek: 2,
    dayName: "Martes",
    enabled: false,
    blocks: [{ id: "tuesday-class", startTime: "08:00", endTime: "08:55" }]
  }
];

describe("availableRescheduleBlocks", () => {
  it("returns only active non-break blocks assigned to the subject", () => {
    expect(availableRescheduleBlocks("2026-07-13", subject, scheduleDays).map((block) => block.id)).toEqual([
      "monday-class"
    ]);
  });

  it("returns no targets for disabled days or invalid dates", () => {
    expect(availableRescheduleBlocks("2026-07-14", subject, scheduleDays)).toEqual([]);
    expect(availableRescheduleBlocks("invalid", subject, scheduleDays)).toEqual([]);
  });
});
