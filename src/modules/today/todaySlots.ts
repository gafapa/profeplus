import type {
  ClassGroup,
  DailyClassRecord,
  ScheduleDay,
  Subject,
  SubjectCourseLink,
  TaskSession
} from "../../shared/db/types";

export type TodaySlot = {
  key: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  slotId: string;
  startTime: string;
  endTime: string;
  kind: "recurring" | "adHoc" | "rescheduled";
  title?: string;
  recordId?: string;
};

type BuildTodaySlotsInput = {
  selectedDate: string;
  classGroups: ClassGroup[];
  subjects: Subject[];
  subjectCourseLinks: SubjectCourseLink[];
  scheduleDays: ScheduleDay[];
  taskSessions: TaskSession[];
  dailyClassRecords?: DailyClassRecord[];
};

function dayOfWeekFromIso(value: string): number {
  const date = new Date(value + "T00:00:00");
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function buildTodaySlots({
  selectedDate,
  classGroups,
  subjects,
  subjectCourseLinks,
  scheduleDays,
  taskSessions,
  dailyClassRecords = []
}: BuildTodaySlotsInput): TodaySlot[] {
  const day = scheduleDays.find(
    (item) => item.enabled && item.dayOfWeek === dayOfWeekFromIso(selectedDate)
  );
  const classGroupById = new Map(classGroups.map((classGroup) => [classGroup.id, classGroup]));
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const linksBySubjectId = new Map<string, SubjectCourseLink[]>();
  for (const link of subjectCourseLinks) {
    const links = linksBySubjectId.get(link.subjectId) ?? [];
    links.push(link);
    linksBySubjectId.set(link.subjectId, links);
  }

  const sessionsBySubjectSlot = new Map<string, Set<string>>();
  for (const session of taskSessions) {
    if (session.date !== selectedDate) continue;
    const key = session.subjectId + ":" + session.scheduleSlotId;
    const classIds = sessionsBySubjectSlot.get(key) ?? new Set<string>();
    classIds.add(session.classId);
    sessionsBySubjectSlot.set(key, classIds);
  }

  const slots: TodaySlot[] = [];
  const addedKeys = new Set<string>();
  const suppressedRecurringKeys = new Set(
    dailyClassRecords
      .filter(
        (record) =>
          record.sessionKind === "rescheduled" &&
          record.originalDate === selectedDate &&
          Boolean(record.originalScheduleSlotId)
      )
      .map(
        (record) =>
          `${record.classId}:${record.subjectId}:${record.originalScheduleSlotId as string}`
      )
  );

  if (day) {
    for (const block of day.blocks) {
      if (block.isBreak) continue;

      for (const subject of subjects) {
        if (!(subject.scheduleSlotIds ?? []).includes(block.id)) continue;

        const links = linksBySubjectId.get(subject.id) ?? [];
        const plannedClassIds = sessionsBySubjectSlot.get(subject.id + ":" + block.id);
        const matchingLinks = plannedClassIds?.size
          ? links.filter((link) => plannedClassIds.has(link.classId))
          : links;

        for (const link of matchingLinks) {
          const key = link.classId + ":" + subject.id + ":" + block.id;
          if (addedKeys.has(key) || suppressedRecurringKeys.has(key)) continue;
          addedKeys.add(key);

          slots.push({
            key,
            classId: link.classId,
            className: classGroupById.get(link.classId)?.name ?? "Curso sin nombre",
            subjectId: subject.id,
            subjectName: subject.name,
            slotId: block.id,
            startTime: block.startTime,
            endTime: block.endTime,
            kind: "recurring"
          });
        }
      }
    }
  }

  for (const record of dailyClassRecords) {
    if (
      record.date !== selectedDate ||
      !record.sessionKind ||
      !record.startTime ||
      !record.endTime
    ) {
      continue;
    }
    const subject = subjectById.get(record.subjectId);
    const classGroup = classGroupById.get(record.classId);
    if (!subject || !classGroup) continue;
    const key = `${record.classId}:${record.subjectId}:${record.scheduleSlotId}`;
    if (addedKeys.has(key)) continue;
    addedKeys.add(key);
    slots.push({
      key,
      classId: record.classId,
      className: classGroup.name || "Curso sin nombre",
      subjectId: record.subjectId,
      subjectName: subject.name,
      slotId: record.scheduleSlotId,
      startTime: record.startTime,
      endTime: record.endTime,
      kind: record.sessionKind,
      title: record.sessionTitle,
      recordId: record.id
    });
  }

  return slots.sort(
    (a, b) =>
      a.startTime.localeCompare(b.startTime) ||
      a.className.localeCompare(b.className) ||
      a.subjectName.localeCompare(b.subjectName)
  );
}
