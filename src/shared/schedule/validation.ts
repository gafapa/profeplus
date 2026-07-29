import type { ScheduleDay } from "../db/types";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateScheduleDay(day: ScheduleDay): string | null {
  const sortedBlocks = [...day.blocks].sort(
    (left, right) => left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime)
  );

  for (const block of sortedBlocks) {
    if (!TIME_PATTERN.test(block.startTime) || !TIME_PATTERN.test(block.endTime)) {
      return "Todas las horas deben tener un formato válido.";
    }
    if (block.endTime <= block.startTime) {
      return `El bloque ${block.startTime} - ${block.endTime} debe terminar después de empezar.`;
    }
  }

  for (let index = 1; index < sortedBlocks.length; index += 1) {
    const previous = sortedBlocks[index - 1];
    const current = sortedBlocks[index];
    if (current.startTime < previous.endTime) {
      return `Los bloques ${previous.startTime} - ${previous.endTime} y ${current.startTime} - ${current.endTime} se solapan.`;
    }
  }

  return null;
}

export function removedActiveScheduleSlotIds(previousDay: ScheduleDay, nextDay: ScheduleDay): string[] {
  const nextActiveSlotIds = new Set(
    nextDay.enabled ? nextDay.blocks.filter((block) => !block.isBreak).map((block) => block.id) : []
  );
  return previousDay.blocks
    .filter((block) => !block.isBreak && !nextActiveSlotIds.has(block.id))
    .map((block) => block.id);
}
