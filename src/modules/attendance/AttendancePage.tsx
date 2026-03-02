import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../../shared/db/database";
import { useAppSelector } from "../../app/hooks";
import type {
  AttendanceEntry,
  ChecklistTemplate,
  RubricTemplate,
  ScheduleDay,
  Student,
  Subject,
  SubjectStudentLink,
  Task,
  TaskChecklistAssessment,
  TaskDailyEvaluationSetting,
  TaskRubricAssessment,
  TaskSession,
  TaskStudentComment
} from "../../shared/db/types";
import { getStudentFullName } from "../../shared/utils/student";
import { IconButton } from "../../shared/ui/IconButton";
import { Modal } from "../../shared/ui/Modal";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";

const today = new Date().toISOString().slice(0, 10);
const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];
const DAY_LABELS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

type SubjectSlot = {
  key: string;
  subjectId: string;
  subjectName: string;
  slotId: string;
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
};

function statusLabel(value: AttendanceEntry["status"]): string {
  if (value === "present") return "Presente";
  if (value === "late") return "Retraso";
  return "Ausente";
}

function toMinutes(value: string): number {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return 0;
  }
  return hour * 60 + minute;
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mondayFirstIndex(value: Date): number {
  return (value.getDay() + 6) % 7;
}

function monthStart(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, delta: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + delta, 1);
}

function shiftIsoDate(value: string, deltaDays: number): string {
  const [year, month, day] = value.split("-").map((item) => Number(item));
  if (!year || !month || !day) {
    return value;
  }
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + deltaDays);
  return toIsoDate(date);
}

function monthGrid(value: Date): { date: Date; inMonth: boolean }[] {
  const start = monthStart(value);
  const startOffset = mondayFirstIndex(start);
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - startOffset);

  const items: { date: Date; inMonth: boolean }[] = [];
  for (let index = 0; index < 42; index += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + index);
    items.push({
      date: current,
      inMonth: current.getMonth() === value.getMonth()
    });
  }
  return items;
}

function isoDayOfWeek(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map((item) => Number(item));
  if (!year || !month || !day) {
    return 0;
  }
  const value = new Date(year, month - 1, day);
  const jsDay = value.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function getNearestSlotKey(slots: SubjectSlot[]): string {
  if (slots.length === 0) {
    return "";
  }
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let best = slots[0];
  let bestDistance = Math.abs(toMinutes(best.startTime) - nowMinutes);
  for (let index = 1; index < slots.length; index += 1) {
    const current = slots[index];
    const distance = Math.abs(toMinutes(current.startTime) - nowMinutes);
    if (distance < bestDistance) {
      best = current;
      bestDistance = distance;
    }
  }
  return best.key;
}

function rubricDraftKey(studentId: string, criterionId: string): string {
  return `${studentId}:${criterionId}`;
}

function checklistDraftKey(studentId: string, itemId: string): string {
  return `${studentId}:${itemId}`;
}

export function AttendancePage() {
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const selectedSubjectId = useAppSelector((state) => state.app.selectedSubjectId);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [subjectStudentLinks, setSubjectStudentLinks] = useState<SubjectStudentLink[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskSessions, setTaskSessions] = useState<TaskSession[]>([]);
  const [taskStudentComments, setTaskStudentComments] = useState<TaskStudentComment[]>([]);
  const [rubricTemplates, setRubricTemplates] = useState<RubricTemplate[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [taskDailyEvaluationSettings, setTaskDailyEvaluationSettings] = useState<TaskDailyEvaluationSetting[]>([]);
  const [taskRubricAssessments, setTaskRubricAssessments] = useState<TaskRubricAssessment[]>([]);
  const [taskChecklistAssessments, setTaskChecklistAssessments] = useState<TaskChecklistAssessment[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [activeDiaryTab, setActiveDiaryTab] = useState<"attendance" | "tasks">("attendance");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedTaskSessionSlotId, setSelectedTaskSessionSlotId] = useState("");
  const [taskGeneralCommentDraft, setTaskGeneralCommentDraft] = useState("");
  const [taskStudentCommentDraft, setTaskStudentCommentDraft] = useState<Map<string, string>>(new Map());
  const [selectedRubricTemplateId, setSelectedRubricTemplateId] = useState("");
  const [selectedChecklistTemplateId, setSelectedChecklistTemplateId] = useState("");
  const [taskRubricDraft, setTaskRubricDraft] = useState<Map<string, string>>(new Map());
  const [taskChecklistDraft, setTaskChecklistDraft] = useState<Map<string, boolean>>(new Map());
  const [taskDirty, setTaskDirty] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskNotice, setTaskNotice] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => monthStart(new Date()));
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);
  const [draftStatusByStudent, setDraftStatusByStudent] = useState<Map<string, AttendanceEntry["status"]>>(
    new Map()
  );
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [attendanceNotice, setAttendanceNotice] = useState("");
  const [attendanceRecordedByDate, setAttendanceRecordedByDate] = useState<Map<string, number>>(new Map());
  const [attendanceExpectedByDate, setAttendanceExpectedByDate] = useState<Map<string, number>>(new Map());
  const [coverageVersion, setCoverageVersion] = useState(0);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const pendingContextChangeRef = useRef<(() => void) | null>(null);

  const loadMetadata = async (): Promise<void> => {
    const [
      subjectsData,
      scheduleDaysData,
      studentsData,
      subjectStudentLinksData,
      subjectCourseLinksData,
      tasksData,
      taskSessionsData,
      taskStudentCommentsData,
      rubricTemplatesData,
      checklistTemplatesData,
      taskDailyEvaluationSettingsData,
      taskRubricAssessmentsData,
      taskChecklistAssessmentsData
    ] = await Promise.all([
      db.subjects.orderBy("name").toArray(),
      db.scheduleDays.orderBy("dayOfWeek").toArray(),
      db.students.toArray(),
      db.subjectStudentLinks.toArray(),
      db.subjectCourseLinks.toArray(),
      db.tasks.toArray(),
      db.taskSessions.toArray(),
      db.taskStudentComments.toArray(),
      selectedClassId ? db.rubricTemplates.where("classId").equals(selectedClassId).toArray() : Promise.resolve([]),
      selectedClassId
        ? db.checklistTemplates.where("classId").equals(selectedClassId).toArray()
        : Promise.resolve([]),
      db.taskDailyEvaluationSettings.toArray(),
      db.taskRubricAssessments.toArray(),
      db.taskChecklistAssessments.toArray()
    ]);
    const linkedSubjectIds = new Set(
      subjectCourseLinksData
        .filter((item) => (selectedClassId ? item.classId === selectedClassId : true))
        .map((item) => item.subjectId)
    );
    const filteredSubjects = subjectsData.filter((item) => linkedSubjectIds.has(item.id));
    const visibleSubjects =
      filteredSubjects.length > 1 || subjectsData.length <= 1 ? filteredSubjects : subjectsData;

    setSubjects(visibleSubjects);
    setScheduleDays(scheduleDaysData);
    setAllStudents(studentsData.sort((a, b) => getStudentFullName(a).localeCompare(getStudentFullName(b))));
    setSubjectStudentLinks(subjectStudentLinksData);
    setTasks(tasksData);
    setTaskSessions(taskSessionsData);
    setTaskStudentComments(taskStudentCommentsData);
    setRubricTemplates(rubricTemplatesData);
    setChecklistTemplates(checklistTemplatesData);
    setTaskDailyEvaluationSettings(taskDailyEvaluationSettingsData);
    setTaskRubricAssessments(taskRubricAssessmentsData);
    setTaskChecklistAssessments(taskChecklistAssessmentsData);
  };

  const dayOfWeek = useMemo(() => {
    const date = new Date(`${selectedDate}T00:00:00`);
    const jsDay = date.getDay();
    return jsDay === 0 ? 7 : jsDay;
  }, [selectedDate]);
  const selectedDayName = DAY_LABELS[Math.max(0, Math.min(6, dayOfWeek - 1))] ?? "";

  const subjectSlotsForDate = useMemo(() => {
    const slots: SubjectSlot[] = [];
    const day = scheduleDays.find((item) => item.enabled && item.dayOfWeek === dayOfWeek);
    if (!day) {
      return slots;
    }
    if (!selectedSubjectId) {
      return slots;
    }
    const subject = subjects.find((item) => item.id === selectedSubjectId);
    if (!subject) {
      return slots;
    }

    const subjectSlotIds = new Set(subject.scheduleSlotIds ?? []);
    for (const block of day.blocks) {
      if (!subjectSlotIds.has(block.id)) {
        continue;
      }
      slots.push({
        key: `${subject.id}:${block.id}`,
        subjectId: subject.id,
        subjectName: subject.name,
        slotId: block.id,
        dayOfWeek: day.dayOfWeek,
        dayName: day.dayName,
        startTime: block.startTime,
        endTime: block.endTime
      });
    }

    return slots.sort((a, b) => {
      const byStart = a.startTime.localeCompare(b.startTime);
      if (byStart !== 0) {
        return byStart;
      }
      return a.slotId.localeCompare(b.slotId);
    });
  }, [dayOfWeek, scheduleDays, selectedSubjectId, subjects]);

  useEffect(() => {
    if (subjectSlotsForDate.length === 0) {
      setSelectedSlotKey("");
      return;
    }
    const exists = subjectSlotsForDate.some((slot) => slot.key === selectedSlotKey);
    if (exists) {
      return;
    }
    setSelectedSlotKey(getNearestSlotKey(subjectSlotsForDate));
  }, [selectedSlotKey, subjectSlotsForDate]);

  const selectedSubjectSlot = useMemo(
    () => subjectSlotsForDate.find((slot) => slot.key === selectedSlotKey) ?? null,
    [selectedSlotKey, subjectSlotsForDate]
  );
  const selectedSubject = useMemo(
    () => subjects.find((item) => item.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjects]
  );

  useEffect(() => {
    const [year, month] = selectedDate.split("-").map((item) => Number(item));
    if (!year || !month) {
      return;
    }
    setCalendarMonth(new Date(year, month - 1, 1));
  }, [selectedDate]);

  const loadData = async () => {
    if (!selectedSubjectSlot) {
      setStudents([]);
      setAttendanceEntries([]);
      return;
    }

    const links = await db.subjectStudentLinks.where("subjectId").equals(selectedSubjectSlot.subjectId).toArray();
    const studentIds = links.map((link) => link.studentId);
    if (studentIds.length === 0) {
      setStudents([]);
      setAttendanceEntries([]);
      return;
    }

    const [studentsData, attendanceData] = await Promise.all([
      db.students.where("id").anyOf(studentIds).toArray(),
      db.attendanceEntries.where("studentId").anyOf(studentIds).toArray()
    ]);

    setStudents(studentsData.sort((a, b) => getStudentFullName(a).localeCompare(getStudentFullName(b))));
    setAttendanceEntries(
      attendanceData.filter(
        (entry) => entry.date === selectedDate && (entry.scheduleSlotId ?? "") === selectedSubjectSlot.slotId
      )
    );
  };

  useEffect(() => {
    void loadMetadata();
  }, [selectedClassId]);

  useEffect(() => {
    void loadData();
  }, [selectedDate, selectedSubjectSlot?.slotId, selectedSubjectSlot?.subjectId]);

  useEffect(() => {
    setDraftStatusByStudent(new Map());
    setAttendanceNotice("");
  }, [selectedDate, selectedSubjectSlot?.key, students.length, attendanceEntries.length]);

  useEffect(() => {
    const loadCalendarCoverage = async () => {
      if (!selectedSubject) {
        setAttendanceRecordedByDate(new Map());
        setAttendanceExpectedByDate(new Map());
        return;
      }

      const monthStartDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
      const monthEndDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
      const fromIso = toIsoDate(monthStartDate);
      const toIso = toIsoDate(monthEndDate);

      const links = await db.subjectStudentLinks.where("subjectId").equals(selectedSubject.id).toArray();
      const studentIds = links.map((item) => item.studentId);
      if (studentIds.length === 0) {
        setAttendanceRecordedByDate(new Map());
        setAttendanceExpectedByDate(new Map());
        return;
      }

      const subjectSlotIds = new Set(selectedSubject.scheduleSlotIds ?? []);
      const slotIdsByDayOfWeek = new Map<number, string[]>();
      for (const day of scheduleDays) {
        if (!day.enabled) {
          continue;
        }
        const slotIds = day.blocks
          .map((block) => block.id)
          .filter((slotId) => subjectSlotIds.has(slotId));
        if (slotIds.length > 0) {
          slotIdsByDayOfWeek.set(day.dayOfWeek, slotIds);
        }
      }

      const expectedByDate = new Map<string, number>();
      const dateCursor = new Date(monthStartDate);
      while (dateCursor <= monthEndDate) {
        const iso = toIsoDate(dateCursor);
        const dow = isoDayOfWeek(iso);
        const slotIds = slotIdsByDayOfWeek.get(dow) ?? [];
        if (slotIds.length > 0) {
          expectedByDate.set(iso, slotIds.length * studentIds.length);
        }
        dateCursor.setDate(dateCursor.getDate() + 1);
      }

      const monthEntries = (
        await db.attendanceEntries.where("studentId").anyOf(studentIds).toArray()
      ).filter(
        (entry) =>
          subjectSlotIds.has(entry.scheduleSlotId ?? "") &&
          entry.date >= fromIso &&
          entry.date <= toIso
      );

      const uniquePairsByDate = new Map<string, Set<string>>();
      for (const entry of monthEntries) {
        if (!expectedByDate.has(entry.date)) {
          continue;
        }
        const pairSet = uniquePairsByDate.get(entry.date) ?? new Set<string>();
        pairSet.add(`${entry.studentId}:${entry.scheduleSlotId ?? ""}`);
        uniquePairsByDate.set(entry.date, pairSet);
      }

      const recordedByDate = new Map<string, number>();
      for (const [date, pairSet] of uniquePairsByDate.entries()) {
        recordedByDate.set(date, pairSet.size);
      }

      setAttendanceExpectedByDate(expectedByDate);
      setAttendanceRecordedByDate(recordedByDate);
    };

    void loadCalendarCoverage();
  }, [calendarMonth, coverageVersion, scheduleDays, selectedSubject]);

  const attendanceByStudent = useMemo(() => {
    const map = new Map<string, AttendanceEntry>();
    for (const entry of attendanceEntries) {
      map.set(entry.studentId, entry);
    }
    return map;
  }, [attendanceEntries]);

  const studentsById = useMemo(() => {
    const map = new Map<string, Student>();
    for (const student of students) {
      map.set(student.id, student);
    }
    return map;
  }, [students]);

  const baseStatusByStudent = useMemo(() => {
    const map = new Map<string, AttendanceEntry["status"]>();
    for (const student of students) {
      map.set(student.id, attendanceByStudent.get(student.id)?.status ?? "present");
    }
    return map;
  }, [attendanceByStudent, students]);

  const subjectById = useMemo(() => new Map(subjects.map((item) => [item.id, item])), [subjects]);
  const slotTimeLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const day of scheduleDays) {
      for (const block of day.blocks) {
        map.set(block.id, `${block.startTime} - ${block.endTime}`);
      }
    }
    return map;
  }, [scheduleDays]);
  const slotOrderById = useMemo(() => {
    const map = new Map<string, number>();
    let index = 0;
    const sortedDays = [...scheduleDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    for (const day of sortedDays) {
      const sortedBlocks = [...day.blocks].sort((a, b) => {
        if (a.startTime === b.startTime) {
          return a.endTime.localeCompare(b.endTime);
        }
        return a.startTime.localeCompare(b.startTime);
      });
      for (const block of sortedBlocks) {
        if (!map.has(block.id)) {
          map.set(block.id, index);
          index += 1;
        }
      }
    }
    return map;
  }, [scheduleDays]);

  const tasksForSelectedDate = useMemo(() => {
    if (!selectedSubjectId) {
      return [];
    }
    const sessionRows = taskSessions.filter((item) => item.date === selectedDate);
    const sessionsByTask = new Map<string, TaskSession[]>();
    for (const session of sessionRows) {
      if (!sessionsByTask.has(session.taskId)) {
        sessionsByTask.set(session.taskId, []);
      }
      sessionsByTask.get(session.taskId)?.push(session);
    }

    const visible = tasks
      .filter((task) => task.subjectId === selectedSubjectId)
      .filter((task) => sessionsByTask.has(task.id))
      .map((task) => ({
        task,
        sessions: (sessionsByTask.get(task.id) ?? []).sort((a, b) => {
          const orderA = slotOrderById.get(a.scheduleSlotId) ?? Number.MAX_SAFE_INTEGER;
          const orderB = slotOrderById.get(b.scheduleSlotId) ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return a.scheduleSlotId.localeCompare(b.scheduleSlotId);
        })
      }))
      .sort((a, b) => {
        const firstA = a.sessions[0]?.scheduleSlotId ?? "";
        const firstB = b.sessions[0]?.scheduleSlotId ?? "";
        const orderA = slotOrderById.get(firstA) ?? Number.MAX_SAFE_INTEGER;
        const orderB = slotOrderById.get(firstB) ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        const labelA = slotTimeLabelById.get(firstA) ?? firstA;
        const labelB = slotTimeLabelById.get(firstB) ?? firstB;
        return labelA.localeCompare(labelB) || a.task.title.localeCompare(b.task.title);
      });

    return visible;
  }, [selectedDate, selectedSubjectId, slotOrderById, slotTimeLabelById, taskSessions, tasks]);

  const selectedTaskForDay = useMemo(
    () => tasksForSelectedDate.find((item) => item.task.id === selectedTaskId)?.task ?? null,
    [selectedTaskId, tasksForSelectedDate]
  );
  const selectedTaskSessionsForDay = useMemo(
    () => tasksForSelectedDate.find((item) => item.task.id === selectedTaskId)?.sessions ?? [],
    [selectedTaskId, tasksForSelectedDate]
  );
  const selectedTaskSessionForDay = useMemo(
    () =>
      selectedTaskSessionsForDay.find((item) => item.scheduleSlotId === selectedTaskSessionSlotId) ??
      selectedTaskSessionsForDay[0] ??
      null,
    [selectedTaskSessionSlotId, selectedTaskSessionsForDay]
  );

  const taskStudents = useMemo(() => {
    if (!selectedTaskForDay) {
      return [];
    }
    const studentSet = new Set(
      subjectStudentLinks
        .filter((link) => link.subjectId === selectedTaskForDay.subjectId)
        .map((link) => link.studentId)
    );
    return allStudents
      .filter((student) => studentSet.has(student.id))
      .filter((student) => (selectedClassId ? student.classId === selectedClassId : true));
  }, [allStudents, selectedClassId, selectedTaskForDay, subjectStudentLinks]);

  const selectedRubricTemplate = useMemo(
    () => rubricTemplates.find((item) => item.id === selectedRubricTemplateId) ?? null,
    [rubricTemplates, selectedRubricTemplateId]
  );
  const selectedChecklistTemplate = useMemo(
    () => checklistTemplates.find((item) => item.id === selectedChecklistTemplateId) ?? null,
    [checklistTemplates, selectedChecklistTemplateId]
  );
  const taskHasFixedRubric = Boolean(selectedTaskForDay?.rubricTemplateId);
  const taskHasFixedChecklist = !taskHasFixedRubric && Boolean(selectedTaskForDay?.checklistTemplateId);
  const diaryRubricTemplates = useMemo(
    () => rubricTemplates.filter((item) => !item.taskId || item.taskId === selectedTaskForDay?.id),
    [rubricTemplates, selectedTaskForDay]
  );
  const diaryChecklistTemplates = useMemo(
    () => checklistTemplates.filter((item) => !item.taskId || item.taskId === selectedTaskForDay?.id),
    [checklistTemplates, selectedTaskForDay]
  );

  useEffect(() => {
    if (tasksForSelectedDate.length === 0) {
      setSelectedTaskId("");
      return;
    }
    if (!tasksForSelectedDate.some((item) => item.task.id === selectedTaskId)) {
      setSelectedTaskId(tasksForSelectedDate[0].task.id);
    }
  }, [selectedTaskId, tasksForSelectedDate]);

  useEffect(() => {
    if (selectedTaskSessionsForDay.length === 0) {
      setSelectedTaskSessionSlotId("");
      return;
    }
    const exists = selectedTaskSessionsForDay.some((item) => item.scheduleSlotId === selectedTaskSessionSlotId);
    if (!exists) {
      setSelectedTaskSessionSlotId(selectedTaskSessionsForDay[0].scheduleSlotId);
    }
  }, [selectedTaskSessionSlotId, selectedTaskSessionsForDay]);

  useEffect(() => {
    if (!selectedTaskForDay || !selectedTaskSessionForDay) {
      setTaskGeneralCommentDraft("");
      setTaskStudentCommentDraft(new Map());
      setSelectedRubricTemplateId("");
      setSelectedChecklistTemplateId("");
      setTaskRubricDraft(new Map());
      setTaskChecklistDraft(new Map());
      setTaskNotice("");
      setTaskDirty(false);
      return;
    }
    const slotId = selectedTaskSessionForDay.scheduleSlotId;
    const setting =
      taskDailyEvaluationSettings.find(
        (item) =>
          item.taskId === selectedTaskForDay.id &&
          item.date === selectedDate &&
          (item.scheduleSlotId ?? "") === slotId
      ) ?? null;
    const legacySetting =
      taskDailyEvaluationSettings.find(
        (item) => item.taskId === selectedTaskForDay.id && item.date === selectedDate && !item.scheduleSlotId
      ) ?? null;

    setTaskGeneralCommentDraft(
      setting?.generalComment ?? legacySetting?.generalComment ?? selectedTaskForDay.generalComment ?? ""
    );
    const commentsMap = new Map<string, string>();
    let hasScopedComments = false;
    for (const row of taskStudentComments) {
      if (
        row.taskId === selectedTaskForDay.id &&
        row.date === selectedDate &&
        (row.scheduleSlotId ?? "") === slotId
      ) {
        hasScopedComments = true;
        commentsMap.set(row.studentId, row.comment);
      }
    }
    if (!hasScopedComments) {
      for (const row of taskStudentComments) {
        if (row.taskId === selectedTaskForDay.id && !row.date && !row.scheduleSlotId) {
          commentsMap.set(row.studentId, row.comment);
        }
      }
    }
    setTaskStudentCommentDraft(commentsMap);

    const taskRubricId = selectedTaskForDay.rubricTemplateId ?? "";
    const taskChecklistId = selectedTaskForDay.checklistTemplateId ?? "";
    const loadedRubricId =
      taskRubricId || setting?.rubricTemplateId || legacySetting?.rubricTemplateId || "";
    const loadedChecklistId =
      taskChecklistId || setting?.checklistTemplateId || legacySetting?.checklistTemplateId || "";
    if (loadedRubricId) {
      setSelectedRubricTemplateId(loadedRubricId);
      setSelectedChecklistTemplateId("");
    } else if (loadedChecklistId) {
      setSelectedRubricTemplateId("");
      setSelectedChecklistTemplateId(loadedChecklistId);
    } else {
      setSelectedRubricTemplateId("");
      setSelectedChecklistTemplateId("");
    }

    const rubricMap = new Map<string, string>();
    for (const row of taskRubricAssessments) {
      if (
        row.taskId !== selectedTaskForDay.id ||
        row.date !== selectedDate ||
        (row.scheduleSlotId ?? "") !== slotId
      ) {
        continue;
      }
      rubricMap.set(rubricDraftKey(row.studentId, row.criterionId), row.levelId);
    }
    setTaskRubricDraft(rubricMap);

    const checklistMap = new Map<string, boolean>();
    for (const row of taskChecklistAssessments) {
      if (
        row.taskId !== selectedTaskForDay.id ||
        row.date !== selectedDate ||
        (row.scheduleSlotId ?? "") !== slotId
      ) {
        continue;
      }
      checklistMap.set(checklistDraftKey(row.studentId, row.itemId), row.checked);
    }
    setTaskChecklistDraft(checklistMap);
    setTaskNotice("");
    setTaskDirty(false);
  }, [
    selectedDate,
    selectedTaskForDay,
    selectedTaskSessionForDay,
    taskChecklistAssessments,
    taskDailyEvaluationSettings,
    taskRubricAssessments,
    taskStudentComments
  ]);

  const attendanceDirty = draftStatusByStudent.size > 0;

  const setDraftStatus = (studentId: string, status: AttendanceEntry["status"]): void => {
    const baseStatus = baseStatusByStudent.get(studentId) ?? "present";
    setDraftStatusByStudent((prev) => {
      const next = new Map(prev);
      if (status === baseStatus) {
        next.delete(studentId);
      } else {
        next.set(studentId, status);
      }
      return next;
    });
    setAttendanceNotice("");
  };

  const saveAttendance = async (): Promise<boolean> => {
    if (!selectedSubjectSlot) {
      return false;
    }
    setIsSavingAttendance(true);
    try {
      for (const student of students) {
        const studentId = student.id;
        const status =
          draftStatusByStudent.get(studentId) ??
          attendanceByStudent.get(studentId)?.status ??
          "present";
        const studentRecord = studentsById.get(studentId);
        if (!studentRecord) {
          continue;
        }
        const existing = attendanceByStudent.get(studentId);
        await db.attendanceEntries.put({
          id:
            existing?.id ??
            `att-${selectedSubjectSlot.subjectId}-${studentId}-${selectedDate}-${selectedSubjectSlot.slotId}`,
          classId: studentRecord.classId,
          studentId,
          date: selectedDate,
          scheduleSlotId: selectedSubjectSlot.slotId,
          status,
          note: existing?.note
        });
      }
      setDraftStatusByStudent(new Map());
      setAttendanceNotice("Asistencia guardada.");
      await loadData();
      setCoverageVersion((current) => current + 1);
      return true;
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const saveTaskDiary = async (): Promise<boolean> => {
    if (!selectedTaskForDay || !selectedTaskSessionForDay) {
      return false;
    }

    const taskId = selectedTaskForDay.id;
    const scheduleSlotId = selectedTaskSessionForDay.scheduleSlotId;
    const normalizedGeneralComment = taskGeneralCommentDraft.trim();
    const effectiveRubricTemplateId = selectedRubricTemplateId || "";
    const effectiveChecklistTemplateId = effectiveRubricTemplateId ? "" : selectedChecklistTemplateId || "";
    const normalizedComments = taskStudents
      .map((student) => ({
        id: crypto.randomUUID(),
        taskId,
        date: selectedDate,
        scheduleSlotId,
        studentId: student.id,
        comment: (taskStudentCommentDraft.get(student.id) ?? "").trim()
      }))
      .filter((row) => row.comment.length > 0);

    setIsSavingTask(true);
    try {
      await db.transaction(
        "rw",
        [
          db.taskStudentComments,
          db.taskDailyEvaluationSettings,
          db.taskRubricAssessments,
          db.taskChecklistAssessments
        ],
        async () => {
          await db.taskStudentComments
            .where("[taskId+date+scheduleSlotId]")
            .equals([taskId, selectedDate, scheduleSlotId])
            .delete();
          if (normalizedComments.length > 0) {
            await db.taskStudentComments.bulkAdd(normalizedComments);
          }

          await db.taskDailyEvaluationSettings
            .where("[taskId+date+scheduleSlotId]")
            .equals([taskId, selectedDate, scheduleSlotId])
            .delete();
          if (normalizedGeneralComment || effectiveRubricTemplateId || effectiveChecklistTemplateId) {
            await db.taskDailyEvaluationSettings.add({
              id: `task-eval-${taskId}-${selectedDate}-${scheduleSlotId}`,
              taskId,
              date: selectedDate,
              scheduleSlotId,
              generalComment: normalizedGeneralComment || undefined,
              rubricTemplateId: effectiveRubricTemplateId || undefined,
              checklistTemplateId: effectiveChecklistTemplateId || undefined
            });
          }

          await db.taskRubricAssessments
            .where("[taskId+date+scheduleSlotId]")
            .equals([taskId, selectedDate, scheduleSlotId])
            .delete();
          if (effectiveRubricTemplateId && selectedRubricTemplate) {
            const rubricRows: TaskRubricAssessment[] = [];
            for (const student of taskStudents) {
              for (const criterion of selectedRubricTemplate.criteria ?? []) {
                const criterionId = criterion.id;
                const levelId = taskRubricDraft.get(rubricDraftKey(student.id, criterionId));
                const level = (criterion.levels ?? []).find((item) => item.id === levelId);
                if (!level) {
                  continue;
                }
                rubricRows.push({
                  id: crypto.randomUUID(),
                  taskId,
                  date: selectedDate,
                  scheduleSlotId,
                  studentId: student.id,
                  rubricTemplateId: selectedRubricTemplate.id,
                  criterionId,
                  levelId: level.id,
                  score: Number(level.score) || 0
                });
              }
            }
            if (rubricRows.length > 0) {
              await db.taskRubricAssessments.bulkAdd(rubricRows);
            }
          }

          await db.taskChecklistAssessments
            .where("[taskId+date+scheduleSlotId]")
            .equals([taskId, selectedDate, scheduleSlotId])
            .delete();
          if (effectiveChecklistTemplateId && selectedChecklistTemplate) {
            const checklistRows: TaskChecklistAssessment[] = [];
            for (const student of taskStudents) {
              for (const item of selectedChecklistTemplate.items ?? []) {
                if (!taskChecklistDraft.get(checklistDraftKey(student.id, item.id))) {
                  continue;
                }
                checklistRows.push({
                  id: crypto.randomUUID(),
                  taskId,
                  date: selectedDate,
                  scheduleSlotId,
                  studentId: student.id,
                  checklistTemplateId: selectedChecklistTemplate.id,
                  itemId: item.id,
                  checked: true
                });
              }
            }
            if (checklistRows.length > 0) {
              await db.taskChecklistAssessments.bulkAdd(checklistRows);
            }
          }
        }
      );

      setTaskDirty(false);
      setTaskNotice("Registro de tarea guardado.");
      await loadMetadata();
      return true;
    } finally {
      setIsSavingTask(false);
    }
  };

  const hasUnsavedChanges = attendanceDirty || taskDirty;

  const runWithContextGuard = (action: () => void): void => {
    if (!hasUnsavedChanges) {
      action();
      return;
    }
    pendingContextChangeRef.current = action;
    setShowUnsavedModal(true);
  };

  useUnsavedChangesGuard(hasUnsavedChanges);

  const calendarCells = useMemo(() => monthGrid(calendarMonth), [calendarMonth]);

  return (
    <section className="module-card">
      <h2>Diario</h2>

      <div className="courses-layout">
        <aside className="courses-list-panel">
          <div className="attendance-day-nav">
            <button
              type="button"
              className="icon-btn"
              aria-label="Dia anterior"
              onClick={() => {
                runWithContextGuard(() => setSelectedDate((current) => shiftIsoDate(current, -1)));
              }}
            >
              {"<"}
            </button>
            <div className="attendance-day-nav-center">
              <strong>{selectedDayName}</strong>
              <small>{selectedDate}</small>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label="Dia siguiente"
              onClick={() => {
                runWithContextGuard(() => setSelectedDate((current) => shiftIsoDate(current, 1)));
              }}
            >
              {">"}
            </button>
          </div>
          <div className="courses-list section-tabs" role="tablist" aria-label="Horas de la asignatura">
            {subjectSlotsForDate.map((slot) => (
              <button
                key={slot.key}
                type="button"
                role="tab"
                aria-selected={selectedSlotKey === slot.key}
                className={`section-tab ${selectedSlotKey === slot.key ? "active" : ""}`}
                onClick={() => {
                  runWithContextGuard(() => {
                    setSelectedSlotKey(slot.key);
                  });
                }}
              >
                <span>{slot.subjectName}</span>
                <small>
                  {slot.startTime} - {slot.endTime}
                </small>
              </button>
            ))}
            {subjectSlotsForDate.length === 0 ? (
              <p className="hint">No hay horas para la asignatura seleccionada en este dia.</p>
            ) : null}
          </div>
          <section className="attendance-calendar">
            <div className="attendance-calendar-header">
              <button
                type="button"
                className="icon-btn"
                aria-label="Mes anterior"
                onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
              >
                {"<"}
              </button>
              <strong>
                {MONTH_LABELS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
              </strong>
              <button
                type="button"
                className="icon-btn"
                aria-label="Mes siguiente"
                onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
              >
                {">"}
              </button>
            </div>
            <div className="attendance-calendar-grid" role="grid" aria-label="Calendario de asistencia">
              {WEEKDAY_LABELS.map((item) => (
                <span key={item} className="attendance-calendar-weekday">
                  {item}
                </span>
              ))}
              {calendarCells.map((cell) => {
                const iso = toIsoDate(cell.date);
                const expectedCount = attendanceExpectedByDate.get(iso) ?? 0;
                const isClassDay = expectedCount > 0;
                const entriesCount = attendanceRecordedByDate.get(iso) ?? 0;
                const isFuture = iso > today;
                const isToday = iso === today;
                const isDone = isClassDay && entriesCount >= expectedCount;
                const isMissing =
                  isClassDay && !isFuture && entriesCount === 0;
                const isPartial =
                  isClassDay &&
                  !isFuture &&
                  entriesCount > 0 &&
                  entriesCount < expectedCount;
                const isSelected = selectedDate === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`attendance-calendar-day ${cell.inMonth ? "" : "outside"} ${
                      isDone ? "done" : isMissing ? "missing" : isPartial ? "partial" : ""
                    } ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
                    onClick={() => {
                      runWithContextGuard(() => setSelectedDate(iso));
                    }}
                  >
                    {cell.date.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="attendance-calendar-legend">
              <span className="attendance-dot today">Hoy</span>
              <span className="attendance-dot done">Lista pasada</span>
              <span className="attendance-dot partial">Parcial</span>
              <span className="attendance-dot missing">Sin pasar lista</span>
            </div>
          </section>
        </aside>

        <section className="course-detail-panel">
          <div className="evaluation-tool-buttons" aria-label="Tabs del diario">
            <button
              type="button"
              className={`btn secondary ${activeDiaryTab === "attendance" ? "active" : ""}`}
              onClick={() => runWithContextGuard(() => setActiveDiaryTab("attendance"))}
            >
              Asistencia
            </button>
            <button
              type="button"
              className={`btn secondary ${activeDiaryTab === "tasks" ? "active" : ""}`}
              onClick={() => runWithContextGuard(() => setActiveDiaryTab("tasks"))}
            >
              Tareas
            </button>
          </div>

          {activeDiaryTab === "attendance" ? (
            selectedSubjectSlot ? (
            <>
              <div className="course-detail-header">
                <div>
                  <h4>{selectedSubjectSlot.subjectName}</h4>
                  <p>
                    {selectedSubjectSlot.dayName} · {selectedSubjectSlot.startTime} - {selectedSubjectSlot.endTime}
                  </p>
                </div>
              </div>

              <div className="actions-cell" style={{ marginBottom: 8 }}>
                <IconButton
                  icon="save"
                  label="Guardar asistencia"
                  className={attendanceDirty ? "save-attention" : ""}
                  disabled={isSavingAttendance}
                  onClick={async () => {
                    await saveAttendance();
                  }}
                />
              </div>
              {attendanceNotice ? <p className="hint">{attendanceNotice}</p> : null}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Alumno</th>
                      <th>Estado</th>
                      <th>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const entry = attendanceByStudent.get(student.id);
                      const status = entry?.status ?? "present";

                      return (
                        <tr key={student.id}>
                          <td>{getStudentFullName(student)}</td>
                          <td>
                            <select
                              className="status-select"
                              value={draftStatusByStudent.get(student.id) ?? status}
                              onChange={(event) =>
                                setDraftStatus(student.id, event.target.value as AttendanceEntry["status"])
                              }
                            >
                              <option value="present">Presente</option>
                              <option value="late">Retraso</option>
                              <option value="absent">Ausente</option>
                            </select>
                          </td>
                          <td>{entry?.note ?? statusLabel(status)}</td>
                        </tr>
                      );
                    })}
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={3}>No hay alumnos en esta asignatura.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p>Selecciona una combinacion de asignatura y hora para pasar lista.</p>
          )
          ) : (
            <>
              <div className="course-detail-header">
                <h4>Tareas del {selectedDate}</h4>
              </div>

              <div className="courses-list section-tabs" role="tablist" aria-label="Tareas del día">
                {tasksForSelectedDate.map((item) => (
                  <button
                    key={item.task.id}
                    type="button"
                    role="tab"
                    aria-selected={selectedTaskId === item.task.id}
                    className={`section-tab ${selectedTaskId === item.task.id ? "active" : ""}`}
                    onClick={() => runWithContextGuard(() => setSelectedTaskId(item.task.id))}
                  >
                    <span>{item.task.title || "Tarea sin título"}</span>
                    <small>{subjectById.get(item.task.subjectId)?.name ?? "-"}</small>
                    <small>
                      {item.sessions
                        .map((session) => slotTimeLabelById.get(session.scheduleSlotId) ?? session.scheduleSlotId)
                        .join(" · ")}
                    </small>
                  </button>
                ))}
                {tasksForSelectedDate.length === 0 ? (
                  <p className="hint">No hay tareas programadas para este día.</p>
                ) : null}
              </div>

              {selectedTaskForDay ? (
                <>
                  <section className="detail-section">
                    <h5>Hora de la tarea</h5>
                    <div className="inline-form">
                      <select
                        className="input"
                        value={selectedTaskSessionSlotId}
                        onChange={(event) => {
                          const value = event.target.value;
                          runWithContextGuard(() => setSelectedTaskSessionSlotId(value));
                        }}
                      >
                        {selectedTaskSessionsForDay.map((session) => (
                          <option key={`${session.scheduleSlotId}:${session.id}`} value={session.scheduleSlotId}>
                            {slotTimeLabelById.get(session.scheduleSlotId) ?? session.scheduleSlotId}
                          </option>
                        ))}
                      </select>
                    </div>
                  </section>

                  <div className="actions-cell" style={{ marginTop: 8, marginBottom: 8 }}>
                    <IconButton
                      icon="save"
                      label="Guardar registro de tarea"
                      className={taskDirty ? "save-attention" : ""}
                      disabled={isSavingTask || !taskDirty || !selectedTaskSessionForDay}
                      onClick={async () => {
                        await saveTaskDiary();
                      }}
                    />
                  </div>
                  {taskNotice ? <p className="hint">{taskNotice}</p> : null}

                  <section className="detail-section">
                    <h5>Comentario general (tarea + hora)</h5>
                    <textarea
                      className="input"
                      value={taskGeneralCommentDraft}
                      placeholder="Comentario general"
                      onChange={(event) => {
                        setTaskGeneralCommentDraft(event.target.value);
                        setTaskNotice("");
                        setTaskDirty(true);
                      }}
                    />
                  </section>

                  <section className="detail-section">
                    <h5>Comentarios por alumno (tarea + hora)</h5>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Alumno</th>
                            <th>Comentario</th>
                          </tr>
                        </thead>
                        <tbody>
                          {taskStudents.map((student) => (
                            <tr key={student.id}>
                              <td>{getStudentFullName(student)}</td>
                              <td>
                                <textarea
                                  className="input"
                                  value={taskStudentCommentDraft.get(student.id) ?? ""}
                                  placeholder="Comentario individual"
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setTaskStudentCommentDraft((current) => {
                                      const next = new Map(current);
                                      if (value.trim().length === 0) {
                                        next.delete(student.id);
                                      } else {
                                        next.set(student.id, value);
                                      }
                                      return next;
                                    });
                                    setTaskNotice("");
                                    setTaskDirty(true);
                                  }}
                                />
                              </td>
                            </tr>
                          ))}
                          {taskStudents.length === 0 ? (
                            <tr>
                              <td colSpan={2}>No hay alumnos asociados a esta tarea.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {!taskHasFixedChecklist ? (
                    <section className="detail-section">
                      <h5>Rúbrica</h5>
                      <div className="inline-form">
                        <select
                          className="input"
                          value={selectedRubricTemplateId}
                          disabled={taskHasFixedRubric}
                          onChange={(event) => {
                            const value = event.target.value;
                            setSelectedRubricTemplateId(value);
                            if (value) {
                              setSelectedChecklistTemplateId("");
                            }
                            setTaskNotice("");
                            setTaskDirty(true);
                          }}
                        >
                          <option value="">Sin rúbrica</option>
                          {diaryRubricTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {selectedRubricTemplate ? (
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Alumno</th>
                                {(selectedRubricTemplate.criteria ?? []).map((criterion) => (
                                  <th key={criterion.id}>{criterion.name}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {taskStudents.map((student) => (
                                <tr key={student.id}>
                                  <td>{getStudentFullName(student)}</td>
                                  {(selectedRubricTemplate.criteria ?? []).map((criterion) => (
                                    <td key={`${student.id}:${criterion.id}`}>
                                      <select
                                        className="input"
                                        value={taskRubricDraft.get(rubricDraftKey(student.id, criterion.id)) ?? ""}
                                        onChange={(event) => {
                                          const value = event.target.value;
                                          setTaskRubricDraft((current) => {
                                            const next = new Map(current);
                                            if (value) {
                                              next.set(rubricDraftKey(student.id, criterion.id), value);
                                            } else {
                                              next.delete(rubricDraftKey(student.id, criterion.id));
                                            }
                                            return next;
                                          });
                                          setTaskNotice("");
                                          setTaskDirty(true);
                                        }}
                                      >
                                        <option value="">-</option>
                                        {(criterion.levels ?? []).map((level) => (
                                          <option key={level.id} value={level.id}>
                                            {level.name} ({level.score})
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="hint">Selecciona una rúbrica para evaluarla en este día.</p>
                      )}
                    </section>
                  ) : null}

                  {!taskHasFixedRubric ? (
                    <section className="detail-section">
                      <h5>Lista de cotejo</h5>
                      <div className="inline-form">
                        <select
                          className="input"
                          value={selectedChecklistTemplateId}
                          disabled={taskHasFixedChecklist}
                          onChange={(event) => {
                            const value = event.target.value;
                            setSelectedChecklistTemplateId(value);
                            if (value) {
                              setSelectedRubricTemplateId("");
                            }
                            setTaskNotice("");
                            setTaskDirty(true);
                          }}
                        >
                          <option value="">Sin lista de cotejo</option>
                          {diaryChecklistTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {selectedChecklistTemplate ? (
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Alumno</th>
                                {(selectedChecklistTemplate.items ?? []).map((item) => (
                                  <th key={item.id}>{item.text}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {taskStudents.map((student) => (
                                <tr key={student.id}>
                                  <td>{getStudentFullName(student)}</td>
                                  {(selectedChecklistTemplate.items ?? []).map((item) => (
                                    <td key={`${student.id}:${item.id}`}>
                                      <input
                                        type="checkbox"
                                        checked={Boolean(taskChecklistDraft.get(checklistDraftKey(student.id, item.id)))}
                                        onChange={(event) => {
                                          const checked = event.target.checked;
                                          setTaskChecklistDraft((current) => {
                                            const next = new Map(current);
                                            if (checked) {
                                              next.set(checklistDraftKey(student.id, item.id), true);
                                            } else {
                                              next.delete(checklistDraftKey(student.id, item.id));
                                            }
                                            return next;
                                          });
                                          setTaskNotice("");
                                          setTaskDirty(true);
                                        }}
                                      />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="hint">Selecciona una lista de cotejo para cubrirla en este día.</p>
                      )}
                    </section>
                  ) : null}

                  <p className="hint">
                    Sesiones del día:{" "}
                    {selectedTaskSessionsForDay
                      .map((session) => slotTimeLabelById.get(session.scheduleSlotId) ?? session.scheduleSlotId)
                      .join(" · ") || "-"}
                  </p>
                  <p className="hint">
                    Hora activa:{" "}
                    {selectedTaskSessionForDay
                      ? slotTimeLabelById.get(selectedTaskSessionForDay.scheduleSlotId) ??
                        selectedTaskSessionForDay.scheduleSlotId
                      : "-"}
                  </p>
                </>
              ) : (
                <p>Selecciona una tarea para registrar comentarios y evaluación.</p>
              )}
            </>
          )}
        </section>
      </div>

      <Modal
        open={showUnsavedModal}
        title="Cambios sin guardar"
        onClose={() => {
          setShowUnsavedModal(false);
          pendingContextChangeRef.current = null;
        }}
      >
        <p>Tienes cambios sin guardar en Diario.</p>
        <div className="inline-form">
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setShowUnsavedModal(false);
              pendingContextChangeRef.current = null;
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setDraftStatusByStudent(new Map());
              setAttendanceNotice("");
              setTaskDirty(false);
              setTaskNotice("");
              void loadMetadata();
              setShowUnsavedModal(false);
              const action = pendingContextChangeRef.current;
              pendingContextChangeRef.current = null;
              action?.();
            }}
          >
            Descartar y continuar
          </button>
          <button
            type="button"
            className="btn"
            disabled={isSavingAttendance || isSavingTask}
            onClick={async () => {
              const attendanceSaved = attendanceDirty ? await saveAttendance() : true;
              if (!attendanceSaved) {
                return;
              }
              const taskSaved = taskDirty ? await saveTaskDiary() : true;
              if (!taskSaved) {
                return;
              }
              setShowUnsavedModal(false);
              const action = pendingContextChangeRef.current;
              pendingContextChangeRef.current = null;
              action?.();
            }}
          >
            Guardar y continuar
          </button>
        </div>
      </Modal>
    </section>
  );
}
