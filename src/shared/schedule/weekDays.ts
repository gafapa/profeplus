import type { ScheduleDay } from "../db/types";

const DEFAULT_WEEK_DAYS = [
  { id: "mon", dayOfWeek: 1, dayName: "Lunes", enabled: true },
  { id: "tue", dayOfWeek: 2, dayName: "Martes", enabled: true },
  { id: "wed", dayOfWeek: 3, dayName: "Miércoles", enabled: true },
  { id: "thu", dayOfWeek: 4, dayName: "Jueves", enabled: true },
  { id: "fri", dayOfWeek: 5, dayName: "Viernes", enabled: true },
  { id: "sat", dayOfWeek: 6, dayName: "Sábado", enabled: false },
  { id: "sun", dayOfWeek: 7, dayName: "Domingo", enabled: false }
] satisfies Array<Omit<ScheduleDay, "blocks">>;

export function defaultScheduleDays(): ScheduleDay[] {
  return DEFAULT_WEEK_DAYS.map((day) => ({ ...day, blocks: [] }));
}

export function completeScheduleDays(existingDays: ScheduleDay[]): ScheduleDay[] {
  const byDayOfWeek = new Map(existingDays.map((day) => [day.dayOfWeek, day]));
  return defaultScheduleDays()
    .map((defaultDay) => byDayOfWeek.get(defaultDay.dayOfWeek) ?? defaultDay)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}
