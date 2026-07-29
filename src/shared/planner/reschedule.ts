import type { ScheduleBlock, ScheduleDay, Subject } from "../db/types";
import { isoDayOfWeek } from "./week";

export function availableRescheduleBlocks(
  date: string,
  subject: Subject | undefined,
  scheduleDays: ScheduleDay[]
): ScheduleBlock[] {
  if (!subject || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const scheduleDay = scheduleDays.find(
    (day) => day.enabled && day.dayOfWeek === isoDayOfWeek(date)
  );
  if (!scheduleDay) return [];

  const subjectSlotIds = new Set(subject.scheduleSlotIds);
  return scheduleDay.blocks
    .filter((block) => !block.isBreak && subjectSlotIds.has(block.id))
    .sort(
      (left, right) => left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime)
    );
}
