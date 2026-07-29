import type { WeekStartsOn } from "../../app/store";
import type { ScheduleDay } from "../db/types";

const DEFAULT_DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export type PlannerWeekDate = {
  date: Date;
  iso: string;
  dayOfWeek: number;
  label: string;
};

export function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map((item) => Number(item));
  return new Date(year, month - 1, day);
}

export function addDays(value: Date, amount: number): Date {
  const next = new Date(value);
  next.setDate(value.getDate() + amount);
  return next;
}

export function isoDayOfWeek(isoDate: string): number {
  const day = fromIsoDate(isoDate).getDay();
  return day === 0 ? 7 : day;
}

export function startOfWeek(value: Date, weekStartsOn: WeekStartsOn): Date {
  const jsDay = value.getDay();
  const offset = weekStartsOn === "sunday" ? jsDay : (jsDay + 6) % 7;
  return addDays(value, -offset);
}

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  return `${toIsoDate(weekStart)} - ${toIsoDate(weekEnd)}`;
}

export function buildVisiblePlannerWeekDates(weekStart: Date, scheduleDays: ScheduleDay[]): PlannerWeekDate[] {
  const activeScheduleDays = new Map(
    scheduleDays
      .filter((day) => day.enabled)
      .map((day) => [day.dayOfWeek, day.dayName || DEFAULT_DAY_LABELS[day.dayOfWeek - 1]])
  );

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const iso = toIsoDate(date);
    const dayOfWeek = isoDayOfWeek(iso);
    const label = activeScheduleDays.get(dayOfWeek);
    if (!label) {
      return null;
    }
    return {
      date,
      iso,
      dayOfWeek,
      label
    };
  }).filter((day): day is PlannerWeekDate => day !== null);
}
