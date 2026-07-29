import { describe, expect, it } from "vitest";
import type { ScheduleDay } from "../db/types";
import { buildVisiblePlannerWeekDates, formatWeekRange, startOfWeek } from "./week";

function scheduleDay(dayOfWeek: number, dayName: string, enabled = true): ScheduleDay {
  return {
    id: `day-${dayOfWeek}`,
    dayOfWeek,
    dayName,
    enabled,
    blocks: []
  };
}

describe("planner visible week dates", () => {
  it("uses only enabled schedule days instead of rendering the full seven-day week", () => {
    const weekStart = startOfWeek(new Date(2026, 6, 8), "monday");
    const days = buildVisiblePlannerWeekDates(weekStart, [
      scheduleDay(1, "Lunes"),
      scheduleDay(2, "Martes"),
      scheduleDay(3, "Miércoles"),
      scheduleDay(4, "Jueves"),
      scheduleDay(5, "Viernes")
    ]);

    expect(formatWeekRange(weekStart)).toBe("2026-07-06 - 2026-07-12");
    expect(days.map((day) => day.label)).toEqual(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]);
    expect(days.map((day) => day.iso)).toEqual([
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10"
    ]);
  });

  it("shows weekend days only when they are enabled in the schedule", () => {
    const weekStart = startOfWeek(new Date(2026, 6, 8), "monday");
    const days = buildVisiblePlannerWeekDates(weekStart, [
      scheduleDay(1, "Lunes"),
      scheduleDay(6, "Sábado"),
      scheduleDay(7, "Domingo", false)
    ]);

    expect(days.map((day) => day.label)).toEqual(["Lunes", "Sábado"]);
    expect(days.map((day) => day.iso)).toEqual(["2026-07-06", "2026-07-11"]);
  });
});
