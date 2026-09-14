import type { AttendanceEntry } from "../../shared/db/types";
import type { AttendanceDetailsDraft } from "../../shared/attendance/attendance";

export type TodayDraft = {
  statuses: Array<[string, AttendanceEntry["status"]]>;
  notes: Array<[string, string]>;
  details: Array<[string, AttendanceDetailsDraft]>;
  generalComment: string;
  studentComments: Array<[string, string]>;
};

export function isTodayDraft(value: unknown): value is TodayDraft {
  if (!value || typeof value !== "object") return false;
  const saved = value as TodayDraft;
  const pairs = (items: unknown, check: (item: unknown) => boolean): boolean => Array.isArray(items) && items.every((item: unknown) =>
    Array.isArray(item) && item.length === 2 && typeof item[0] === "string" && check(item[1]));
  return typeof saved.generalComment === "string" &&
    pairs(saved.statuses, (item) => ["present", "late", "absent"].includes(String(item))) &&
    pairs(saved.notes, (item) => typeof item === "string") && pairs(saved.studentComments, (item) => typeof item === "string") &&
    pairs(saved.details, (item) => {
      if (!item || typeof item !== "object") return false;
      const detail = item as AttendanceDetailsDraft;
      return typeof detail.absenceJustified === "boolean" && typeof detail.lateMinutes === "string" && typeof detail.earlyDepartureMinutes === "string";
    });
}
