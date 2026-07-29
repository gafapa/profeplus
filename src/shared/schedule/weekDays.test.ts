import { describe, expect, it } from "vitest";
import type { ScheduleDay } from "../db/types";
import { completeScheduleDays, defaultScheduleDays } from "./weekDays";

function day(dayOfWeek: number, dayName: string, enabled: boolean): ScheduleDay {
  return {
    id: `custom-${dayOfWeek}`,
    dayOfWeek,
    dayName,
    enabled,
    blocks: [{ id: `slot-${dayOfWeek}`, startTime: "09:00", endTime: "10:00" }]
  };
}

describe("schedule week days", () => {
  it("creates seven configurable days with weekend disabled by default", () => {
    const days = defaultScheduleDays();

    expect(days.map((item) => item.dayName)).toEqual([
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo"
    ]);
    expect(days.filter((item) => item.enabled).map((item) => item.dayName)).toEqual([
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes"
    ]);
  });

  it("preserves existing disabled weekdays and fills missing weekend days", () => {
    const days = completeScheduleDays([
      day(1, "Lunes", true),
      day(2, "Martes", false),
      day(3, "Miércoles", true),
      day(4, "Jueves", true),
      day(5, "Viernes", true)
    ]);

    expect(days).toHaveLength(7);
    expect(days[1].enabled).toBe(false);
    expect(days[1].blocks).toHaveLength(1);
    expect(days[5]).toMatchObject({ dayOfWeek: 6, dayName: "Sábado", enabled: false, blocks: [] });
    expect(days[6]).toMatchObject({ dayOfWeek: 7, dayName: "Domingo", enabled: false, blocks: [] });
  });
});
