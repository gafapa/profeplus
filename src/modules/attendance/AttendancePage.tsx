import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../../shared/db/database";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setSelectedClass, setSelectedSubject, type WeekStartsOn } from "../../app/store";
import type {
  AttendanceEntry,
  ChecklistTemplate,
  ClassGroup,
  RubricTemplate,
  ScheduleDay,
  Student,
  Subject,
  SubjectCourseLink,
  SubjectStudentLink,
  Task,
  TaskChecklistAssessment,
  TaskDailyEvaluationSetting,
  TaskDirectGrade,
  TaskGradebookConfig,
  TaskRubricAssessment,
  TaskSession,
  TaskStudentComment,
  TaskSubjectLink,
  UnitBlock
} from "../../shared/db/types";
import { normalizeAttendanceNote, resolveAttendanceNoteForSave } from "../../shared/attendance/attendance";
import { matchesTaskScope } from "../../shared/gradebook/calculations";
import { useStudentDisplay } from "../../shared/hooks/useStudentDisplay";

const today = new Date().toISOString().slice(0, 10);
const MONDAY_FIRST_WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const SUNDAY_FIRST_WEEKDAY_LABELS = ["D", "L", "M", "X", "J", "V", "S"];
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
const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const WORK_DIARY_SLOT_ID = "work";

type SubjectSlot = {
  key: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  slotId: string;
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
};

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

function weekStartIndex(value: Date, weekStartsOn: WeekStartsOn): number {
  if (weekStartsOn === "sunday") {
    return value.getDay();
  }
  return (value.getDay() + 6) % 7;
}

function weekdayLabels(weekStartsOn: WeekStartsOn): string[] {
  return weekStartsOn === "sunday" ? SUNDAY_FIRST_WEEKDAY_LABELS : MONDAY_FIRST_WEEKDAY_LABELS;
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

function monthGrid(value: Date, weekStartsOn: WeekStartsOn): { date: Date; inMonth: boolean }[] {
  const start = monthStart(value);
  const startOffset = weekStartIndex(start, weekStartsOn);
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

type AttendancePageProps = {
  mode: "attendance" | "work";
};

export function AttendancePage({ mode }: AttendancePageProps) {
  const { formatName, compareFn } = useStudentDisplay();
  const dispatch = useAppDispatch();
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const selectedSubjectId = useAppSelector((state) => state.app.selectedSubjectId);
  const weekStartsOn = useAppSelector((state) => state.app.weekStartsOn);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectCourseLinks, setSubjectCourseLinks] = useState<SubjectCourseLink[]>([]);
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [subjectStudentLinks, setSubjectStudentLinks] = useState<SubjectStudentLink[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskSubjectLinks, setTaskSubjectLinks] = useState<TaskSubjectLink[]>([]);
  const [unitBlocks, setUnitBlocks] = useState<UnitBlock[]>([]);
  const [taskGradebookConfigs, setTaskGradebookConfigs] = useState<TaskGradebookConfig[]>([]);
  const [taskSessions, setTaskSessions] = useState<TaskSession[]>([]);
  const [taskStudentComments, setTaskStudentComments] = useState<TaskStudentComment[]>([]);
  const [rubricTemplates, setRubricTemplates] = useState<RubricTemplate[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [taskDailyEvaluationSettings, setTaskDailyEvaluationSettings] = useState<TaskDailyEvaluationSetting[]>([]);
  const [taskRubricAssessments, setTaskRubricAssessments] = useState<TaskRubricAssessment[]>([]);
  const [taskChecklistAssessments, setTaskChecklistAssessments] = useState<TaskChecklistAssessment[]>([]);
  const [taskDirectGrades, setTaskDirectGrades] = useState<TaskDirectGrade[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedWorkUnitId, setSelectedWorkUnitId] = useState("");
  const [selectedUnitToAssignId, setSelectedUnitToAssignId] = useState("");
  const [selectedTaskToAssignId, setSelectedTaskToAssignId] = useState("");
  const [selectedTaskSessionSlotId, setSelectedTaskSessionSlotId] = useState("");
  const [taskGeneralCommentDraft, setTaskGeneralCommentDraft] = useState("");
  const [taskStudentCommentDraft, setTaskStudentCommentDraft] = useState<Map<string, string>>(new Map());
  const [selectedRubricTemplateId, setSelectedRubricTemplateId] = useState("");
  const [selectedChecklistTemplateId, setSelectedChecklistTemplateId] = useState("");
  const [taskRubricDraft, setTaskRubricDraft] = useState<Map<string, string>>(new Map());
  const [taskChecklistDraft, setTaskChecklistDraft] = useState<Map<string, boolean>>(new Map());
  const [taskDirectGradeDraft, setTaskDirectGradeDraft] = useState<Map<string, string>>(new Map());
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
  const [draftNoteByStudent, setDraftNoteByStudent] = useState<Map<string, string>>(new Map());
  const [attendanceNotice, setAttendanceNotice] = useState("");
  const attendanceAutoSaveTimerRef = useRef<number | null>(null);
  const taskAutoSaveTimerRef = useRef<number | null>(null);
  const taskEditVersionRef = useRef(0);
  const taskPickerContextRef = useRef("");

  const loadMetadata = async (): Promise<void> => {
    const [
      classGroupsData,
      subjectsData,
      scheduleDaysData,
      studentsData,
      subjectStudentLinksData,
      subjectCourseLinksData,
      tasksData,
      taskSubjectLinksData,
      unitBlocksData,
      taskSessionsData,
      taskStudentCommentsData,
      rubricTemplatesData,
      checklistTemplatesData,
      taskDailyEvaluationSettingsData,
      taskRubricAssessmentsData,
      taskChecklistAssessmentsData,
      taskDirectGradesData,
      taskGradebookConfigsData
    ] = await Promise.all([
      db.classGroups.orderBy("name").toArray(),
      db.subjects.orderBy("name").toArray(),
      db.scheduleDays.orderBy("dayOfWeek").toArray(),
      db.students.toArray(),
      db.subjectStudentLinks.toArray(),
      db.subjectCourseLinks.toArray(),
      db.tasks.toArray(),
      db.taskSubjectLinks.toArray(),
      db.unitBlocks.toArray(),
      db.taskSessions.toArray(),
      db.taskStudentComments.toArray(),
      db.rubricTemplates.toArray(),
      db.checklistTemplates.toArray(),
      db.taskDailyEvaluationSettings.toArray(),
      db.taskRubricAssessments.toArray(),
      db.taskChecklistAssessments.toArray(),
      db.taskDirectGrades.toArray(),
      db.taskGradebookConfigs.toArray()
    ]);

    setClassGroups(classGroupsData);
    setSubjects(subjectsData);
    setSubjectCourseLinks(subjectCourseLinksData);
    setScheduleDays(scheduleDaysData);
    setAllStudents(studentsData.sort(compareFn));
    setSubjectStudentLinks(subjectStudentLinksData);
    setTasks(tasksData);
    setTaskSubjectLinks(taskSubjectLinksData);
    setUnitBlocks(unitBlocksData);
    setTaskGradebookConfigs(taskGradebookConfigsData);
    setTaskSessions(taskSessionsData);
    setTaskStudentComments(taskStudentCommentsData);
    setRubricTemplates(rubricTemplatesData);
    setChecklistTemplates(checklistTemplatesData);
    setTaskDailyEvaluationSettings(taskDailyEvaluationSettingsData);
    setTaskRubricAssessments(taskRubricAssessmentsData);
    setTaskChecklistAssessments(taskChecklistAssessmentsData);
    setTaskDirectGrades(taskDirectGradesData);
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
    const classGroupById = new Map(classGroups.map((item) => [item.id, item]));
    const linksBySubjectId = new Map<string, SubjectCourseLink[]>();
    for (const link of subjectCourseLinks) {
      const links = linksBySubjectId.get(link.subjectId) ?? [];
      links.push(link);
      linksBySubjectId.set(link.subjectId, links);
    }

    for (const block of day.blocks) {
      if (block.isBreak) {
        continue;
      }
      for (const subject of subjects) {
        const subjectSlotIds = new Set(subject.scheduleSlotIds ?? []);
        if (!subjectSlotIds.has(block.id)) {
          continue;
        }
        const links = linksBySubjectId.get(subject.id) ?? [];
        for (const link of links) {
          const classGroup = classGroupById.get(link.classId);
          slots.push({
            key: `${link.classId}:${subject.id}:${block.id}`,
            classId: link.classId,
            className: classGroup?.name ?? "Curso sin nombre",
            subjectId: subject.id,
            subjectName: subject.name,
            slotId: block.id,
            dayOfWeek: day.dayOfWeek,
            dayName: day.dayName,
            startTime: block.startTime,
            endTime: block.endTime
          });
        }
      }
    }

    return slots.sort((a, b) => {
      const byStart = a.startTime.localeCompare(b.startTime);
      if (byStart !== 0) {
        return byStart;
      }
      return (
        a.className.localeCompare(b.className) ||
        a.subjectName.localeCompare(b.subjectName) ||
        a.slotId.localeCompare(b.slotId)
      );
    });
  }, [classGroups, dayOfWeek, scheduleDays, subjectCourseLinks, subjects]);

  useEffect(() => {
    if (subjectSlotsForDate.length === 0) {
      if (selectedSlotKey) {
        setSelectedSlotKey("");
      }
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
  const activeClassId = mode === "work" ? selectedClassId : (selectedSubjectSlot?.classId ?? "");
  const activeSubjectId = mode === "work" ? selectedSubjectId : (selectedSubjectSlot?.subjectId ?? "");
  const workSubjects = useMemo(() => {
    if (!selectedClassId) {
      return [];
    }
    const linkedSubjectIds = new Set(
      subjectCourseLinks
        .filter((link) => link.classId === selectedClassId)
        .map((link) => link.subjectId)
    );
    return subjects
      .filter((subject) => linkedSubjectIds.has(subject.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedClassId, subjectCourseLinks, subjects]);
  const workUnits = useMemo(() => {
    if (!selectedSubjectId) {
      return [];
    }
    return unitBlocks
      .filter((unit) => unit.subjectId === selectedSubjectId)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }, [selectedSubjectId, unitBlocks]);
  const workDiaryDateKey = mode === "work" && activeClassId && activeSubjectId
    ? `work:${activeClassId}:${activeSubjectId}`
    : selectedDate;
  const workDiarySlotId = mode === "work" ? WORK_DIARY_SLOT_ID : "";
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

    setStudents(studentsData.filter((student) => student.classId === selectedSubjectSlot.classId).sort(compareFn));
    setAttendanceEntries(
      attendanceData.filter(
        (entry) =>
          entry.classId === selectedSubjectSlot.classId &&
          entry.date === selectedDate &&
          (entry.scheduleSlotId ?? "") === selectedSubjectSlot.slotId
      )
    );
  };

  useEffect(() => {
    void loadMetadata();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== "work") {
      return;
    }
    if (workSubjects.length === 0) {
      if (selectedSubjectId) {
        dispatch(setSelectedSubject(""));
      }
      return;
    }
    if (!workSubjects.some((subject) => subject.id === selectedSubjectId)) {
      dispatch(setSelectedSubject(workSubjects[0].id));
    }
  }, [dispatch, mode, selectedSubjectId, workSubjects]);

  useEffect(() => {
    if (mode !== "work") {
      return;
    }
    if (workUnits.length === 0) {
      setSelectedWorkUnitId("");
      return;
    }
    if (!workUnits.some((unit) => unit.id === selectedWorkUnitId)) {
      setSelectedWorkUnitId(workUnits[0].id);
    }
  }, [mode, selectedWorkUnitId, workUnits]);

  useEffect(() => {
    if (mode !== "attendance") {
      return;
    }
    if (!selectedSubjectSlot) {
      return;
    }
    if (selectedClassId !== selectedSubjectSlot.classId) {
      dispatch(setSelectedClass(selectedSubjectSlot.classId));
    }
    if (selectedSubjectId !== selectedSubjectSlot.subjectId) {
      dispatch(setSelectedSubject(selectedSubjectSlot.subjectId));
    }
  }, [dispatch, mode, selectedClassId, selectedSubjectId, selectedSubjectSlot]);

  // Re-ordenar alumnos cuando cambia la preferencia sin recargar la BD
  useEffect(() => {
    setAllStudents((prev) => [...prev].sort(compareFn));
    setStudents((prev) => [...prev].sort(compareFn));
  }, [compareFn]);

  useEffect(() => {
    void loadData();
  }, [selectedDate, selectedSubjectSlot?.slotId, selectedSubjectSlot?.subjectId]);

  useEffect(() => {
    setDraftStatusByStudent(new Map());
    setAttendanceNotice("");
  }, [selectedDate, selectedSubjectSlot?.key, students.length, attendanceEntries.length]);

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

  // Task id to subject id map (first match per task).
  const slotTimeLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const day of scheduleDays) {
      for (const block of day.blocks) {
        if (block.isBreak) continue;
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
        if (block.isBreak) continue;
        if (!map.has(block.id)) {
          map.set(block.id, index);
          index += 1;
        }
      }
    }
    return map;
  }, [scheduleDays]);

  const tasksForSelectedDate = useMemo(() => {
    if (!selectedSubjectSlot) {
      return [];
    }
    const sessionRows = taskSessions.filter(
      (item) => item.classId === selectedSubjectSlot.classId && item.date === selectedDate
    );
    const sessionsByTask = new Map<string, TaskSession[]>();
    for (const session of sessionRows) {
      if (!sessionsByTask.has(session.taskId)) {
        sessionsByTask.set(session.taskId, []);
      }
      sessionsByTask.get(session.taskId)?.push(session);
    }
    const taskIdsForSubject = new Set(
      taskSubjectLinks
        .filter((link) => link.subjectId === selectedSubjectSlot.subjectId)
        .map((link) => link.taskId)
    );

    const visible = tasks
      .filter((task) => taskIdsForSubject.has(task.id))
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
  }, [selectedDate, selectedSubjectSlot, slotOrderById, slotTimeLabelById, taskSessions, taskSubjectLinks, tasks]);

  const unitsForSelectedSubject = useMemo(() => {
    if (!selectedSubjectSlot) {
      return [];
    }
    return unitBlocks
      .filter((unit) => unit.subjectId === selectedSubjectSlot.subjectId)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }, [selectedSubjectSlot, unitBlocks]);

  const tasksForSelectedUnit = useMemo(() => {
    if (!selectedSubjectSlot || !selectedUnitToAssignId) {
      return [];
    }
    const linkedTaskIds = new Set(
      taskSubjectLinks
        .filter(
          (link) =>
            link.subjectId === selectedSubjectSlot.subjectId &&
            (link.unitId ?? "") === selectedUnitToAssignId
        )
        .map((link) => link.taskId)
    );
    return tasks
      .filter((task) => linkedTaskIds.has(task.id))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [selectedSubjectSlot, selectedUnitToAssignId, taskSubjectLinks, tasks]);

  const availableTasksToAssign = useMemo(() => {
    if (!selectedSubjectSlot || !selectedUnitToAssignId) {
      return [];
    }
    const linkedTaskIds = new Set(
      taskSubjectLinks
        .filter(
          (link) =>
            link.subjectId === selectedSubjectSlot.subjectId &&
            (link.unitId ?? "") === selectedUnitToAssignId
        )
        .map((link) => link.taskId)
    );
    const currentSlotSessions = taskSessions.filter(
      (session) =>
        session.classId === selectedSubjectSlot.classId &&
        session.date === selectedDate &&
        session.scheduleSlotId === selectedSubjectSlot.slotId
    );
    const assignedToCurrentSlot = new Set(currentSlotSessions.map((session) => session.taskId));
    const currentTaskId = currentSlotSessions[0]?.taskId ?? "";
    return tasks
      .filter((task) => linkedTaskIds.has(task.id) && (!assignedToCurrentSlot.has(task.id) || task.id === currentTaskId))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [selectedDate, selectedSubjectSlot, selectedUnitToAssignId, taskSessions, taskSubjectLinks, tasks]);

  const taskSessionForSelectedSlot = useMemo(() => {
    if (!selectedSubjectSlot) {
      return null;
    }
    return (
      taskSessions.find(
        (session) =>
          session.classId === selectedSubjectSlot.classId &&
          session.date === selectedDate &&
          session.scheduleSlotId === selectedSubjectSlot.slotId
      ) ?? null
    );
  }, [selectedDate, selectedSubjectSlot, taskSessions]);

  const taskForSelectedSlot = useMemo(
    () => tasks.find((task) => task.id === taskSessionForSelectedSlot?.taskId) ?? null,
    [taskSessionForSelectedSlot?.taskId, tasks]
  );

  const taskTitleByClassSlot = useMemo(() => {
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const unitById = new Map(unitBlocks.map((unit) => [unit.id, unit]));
    const subjectLinksByTaskId = new Map<string, TaskSubjectLink[]>();
    for (const link of taskSubjectLinks) {
      if (!subjectLinksByTaskId.has(link.taskId)) {
        subjectLinksByTaskId.set(link.taskId, []);
      }
      subjectLinksByTaskId.get(link.taskId)?.push(link);
    }
    const map = new Map<string, string>();
    for (const session of taskSessions) {
      if (session.date !== selectedDate) {
        continue;
      }
      const task = taskById.get(session.taskId);
      if (!task) {
        continue;
      }
      const links = subjectLinksByTaskId.get(session.taskId) ?? [];
      const link = links.find((item) => item.subjectId === session.subjectId) ?? links[0];
      const unit = link?.unitId ? unitById.get(link.unitId) : null;
      const unitName = unit?.name || "Sin unidad";
      const taskTitle = task.title || "Tarea sin título";
      map.set(`${session.classId}:${session.scheduleSlotId}`, `${unitName} / ${taskTitle}`);
    }
    return map;
  }, [selectedDate, taskSessions, taskSubjectLinks, tasks, unitBlocks]);

  const taskPickerOptions = mode === "work" ? tasksForSelectedUnit : availableTasksToAssign;

  const unitNameByTaskId = useMemo(() => {
    const unitById = new Map(unitBlocks.map((unit) => [unit.id, unit]));
    const map = new Map<string, string>();
    for (const link of taskSubjectLinks) {
      if (selectedSubjectId && link.subjectId !== selectedSubjectId) {
        continue;
      }
      if (!link.unitId || map.has(link.taskId)) {
        continue;
      }
      const unit = unitById.get(link.unitId);
      if (unit) {
        map.set(link.taskId, unit.name);
      }
    }
    return map;
  }, [selectedSubjectId, taskSubjectLinks, unitBlocks]);

  const workTaskOptions = useMemo(() => {
    if (!selectedClassId || !selectedSubjectId || !selectedWorkUnitId) {
      return [];
    }
    const taskIdsForSubject = new Set(
      taskSubjectLinks
        .filter((link) => link.subjectId === selectedSubjectId && (link.unitId ?? "") === selectedWorkUnitId)
        .map((link) => link.taskId)
    );
    const sessionCountByTask = new Map<string, number>();
    for (const session of taskSessions) {
      if (session.classId !== selectedClassId || !taskIdsForSubject.has(session.taskId)) {
        continue;
      }
      sessionCountByTask.set(session.taskId, (sessionCountByTask.get(session.taskId) ?? 0) + 1);
    }
    return tasks
      .filter((task) => taskIdsForSubject.has(task.id))
      .map((task) => ({
        task,
        unitName: unitNameByTaskId.get(task.id) ?? "Sin unidad",
        sessionCount: sessionCountByTask.get(task.id) ?? 0
      }))
      .sort((a, b) => {
        return a.task.title.localeCompare(b.task.title);
      });
  }, [selectedClassId, selectedSubjectId, selectedWorkUnitId, taskSessions, taskSubjectLinks, tasks, unitNameByTaskId]);

  const selectedTaskForDay = useMemo(() => {
    if (mode === "work") {
      return workTaskOptions.find((item) => item.task.id === selectedTaskId)?.task ?? null;
    }
    return tasksForSelectedDate.find((item) => item.task.id === selectedTaskId)?.task ?? null;
  }, [mode, selectedTaskId, tasksForSelectedDate, workTaskOptions]);

  const workTaskSessions = useMemo(() => {
    if (mode !== "work" || !selectedTaskForDay || !selectedClassId || !selectedSubjectId) {
      return [];
    }
    const selectedTaskBelongsToContext = taskSubjectLinks.some(
      (link) =>
        link.taskId === selectedTaskForDay.id &&
        link.subjectId === selectedSubjectId &&
        (!selectedWorkUnitId || (link.unitId ?? "") === selectedWorkUnitId)
    );
    return taskSessions
      .filter(
        (session) =>
          session.taskId === selectedTaskForDay.id &&
          session.classId === selectedClassId &&
          (session.subjectId === selectedSubjectId || selectedTaskBelongsToContext)
      )
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) {
          return byDate;
        }
        const orderA = slotOrderById.get(a.scheduleSlotId) ?? Number.MAX_SAFE_INTEGER;
        const orderB = slotOrderById.get(b.scheduleSlotId) ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a.scheduleSlotId.localeCompare(b.scheduleSlotId);
      });
  }, [
    mode,
    selectedClassId,
    selectedSubjectId,
    selectedTaskForDay,
    selectedWorkUnitId,
    slotOrderById,
    taskSessions,
    taskSubjectLinks
  ]);

  const selectedTaskSessionsForDay = useMemo(() => {
    if (mode === "work") {
      return workTaskSessions;
    }
    return tasksForSelectedDate.find((item) => item.task.id === selectedTaskId)?.sessions ?? [];
  }, [
    mode,
    selectedClassId,
    selectedSubjectId,
    selectedSubjectSlot,
    selectedTaskForDay,
    selectedTaskId,
    slotOrderById,
    taskSessions,
    tasksForSelectedDate,
    workTaskSessions
  ]);
  const selectedTaskSessionForDay = useMemo(
    () =>
      selectedTaskSessionsForDay.find(
        (item) => item.scheduleSlotId === selectedTaskSessionSlotId && item.date === selectedDate
      ) ??
      selectedTaskSessionsForDay.find((item) => item.scheduleSlotId === selectedTaskSessionSlotId) ??
      selectedTaskSessionsForDay[0] ??
      null,
    [selectedDate, selectedTaskSessionSlotId, selectedTaskSessionsForDay]
  );
  const selectedTaskGradebookConfig = useMemo(() => {
    if (!selectedTaskForDay || !activeClassId || !activeSubjectId) {
      return null;
    }
    return (
      taskGradebookConfigs.find(
        (config) =>
          config.taskId === selectedTaskForDay.id &&
          config.subjectId === activeSubjectId &&
          config.classId === activeClassId
      ) ?? null
    );
  }, [activeClassId, activeSubjectId, selectedTaskForDay, taskGradebookConfigs]);

  const taskStudents = useMemo(() => {
    if (!selectedTaskForDay) {
      return [];
    }
    const studentSet = new Set(
      subjectStudentLinks
        .filter((link) => link.subjectId === activeSubjectId)
        .map((link) => link.studentId)
    );
    return allStudents
      .filter((student) => studentSet.has(student.id))
      .filter((student) => student.classId === activeClassId);
  }, [activeClassId, activeSubjectId, allStudents, selectedTaskForDay, subjectStudentLinks]);

  const selectedRubricTemplate = useMemo(
    () => rubricTemplates.find((item) => item.id === selectedRubricTemplateId) ?? null,
    [rubricTemplates, selectedRubricTemplateId]
  );
  const selectedChecklistTemplate = useMemo(
    () => checklistTemplates.find((item) => item.id === selectedChecklistTemplateId) ?? null,
    [checklistTemplates, selectedChecklistTemplateId]
  );
  const taskHasFixedRubric = Boolean(selectedTaskGradebookConfig?.rubricTemplateId);
  const taskHasFixedChecklist = !taskHasFixedRubric && Boolean(selectedTaskGradebookConfig?.checklistTemplateId);
  const taskHasDirectGrade = Boolean(selectedTaskGradebookConfig?.directGradeEnabled);
  const diaryRubricTemplates = selectedRubricTemplate ? [selectedRubricTemplate] : [];
  const diaryChecklistTemplates = selectedChecklistTemplate ? [selectedChecklistTemplate] : [];
  const taskHasAssignedInstrument = Boolean(
    selectedTaskGradebookConfig?.rubricTemplateId ||
      selectedTaskGradebookConfig?.checklistTemplateId ||
      selectedTaskGradebookConfig?.directGradeEnabled
  );

  useEffect(() => {
    if (mode !== "attendance") {
      return;
    }
    if (taskForSelectedSlot?.id) {
      if (selectedTaskId !== taskForSelectedSlot.id) {
        setSelectedTaskId(taskForSelectedSlot.id);
      }
      return;
    }
    if (tasksForSelectedDate.length === 0 || !taskForSelectedSlot) {
      setSelectedTaskId("");
      return;
    }
    if (!tasksForSelectedDate.some((item) => item.task.id === selectedTaskId)) {
      setSelectedTaskId(tasksForSelectedDate[0].task.id);
    }
  }, [mode, selectedTaskId, taskForSelectedSlot, tasksForSelectedDate]);

  useEffect(() => {
    if (mode !== "work") {
      return;
    }
    if (workTaskOptions.length === 0) {
      setSelectedTaskId("");
      return;
    }
    if (!workTaskOptions.some((item) => item.task.id === selectedTaskId)) {
      setSelectedTaskId(workTaskOptions[0].task.id);
    }
  }, [mode, selectedTaskId, workTaskOptions]);

  useEffect(() => {
    if (mode !== "attendance") {
      return;
    }
    const contextKey = `${selectedDate}:${selectedSubjectSlot?.key ?? ""}:${taskForSelectedSlot?.id ?? ""}`;
    if (taskPickerContextRef.current === contextKey) {
      return;
    }
    taskPickerContextRef.current = contextKey;

    const currentTaskUnitId =
      taskSubjectLinks.find(
        (link) =>
          link.subjectId === selectedSubjectSlot?.subjectId &&
          link.taskId === taskForSelectedSlot?.id
      )?.unitId ?? "";
    const hasCurrentTaskUnit = unitsForSelectedSubject.some((unit) => unit.id === currentTaskUnitId);

    setSelectedUnitToAssignId(hasCurrentTaskUnit ? currentTaskUnitId : "");
    setSelectedTaskToAssignId(taskForSelectedSlot?.id ?? "");
  }, [
    mode,
    selectedDate,
    selectedSubjectSlot?.key,
    selectedSubjectSlot?.subjectId,
    taskForSelectedSlot?.id,
    taskSubjectLinks,
    unitsForSelectedSubject
  ]);

  useEffect(() => {
    if (unitsForSelectedSubject.length === 0) {
      setSelectedUnitToAssignId("");
      return;
    }
    if (mode === "attendance" && !taskForSelectedSlot) {
      const selectedUnitExists = unitsForSelectedSubject.some((unit) => unit.id === selectedUnitToAssignId);
      if (selectedUnitToAssignId && !selectedUnitExists) {
        setSelectedUnitToAssignId("");
      }
      return;
    }
    const currentTaskUnitId = taskSubjectLinks.find(
      (link) =>
        link.subjectId === selectedSubjectSlot?.subjectId &&
        link.taskId === taskForSelectedSlot?.id
    )?.unitId;
    const hasCurrentTaskUnit = Boolean(
      currentTaskUnitId && unitsForSelectedSubject.some((unit) => unit.id === currentTaskUnitId)
    );
    if (
      !unitsForSelectedSubject.some((unit) => unit.id === selectedUnitToAssignId) ||
      (hasCurrentTaskUnit && selectedUnitToAssignId !== currentTaskUnitId)
    ) {
      const preferredUnitId = hasCurrentTaskUnit && currentTaskUnitId ? currentTaskUnitId : unitsForSelectedSubject[0].id;
      setSelectedUnitToAssignId(preferredUnitId);
    }
  }, [
    mode,
    selectedSubjectSlot?.subjectId,
    selectedUnitToAssignId,
    taskForSelectedSlot?.id,
    taskSubjectLinks,
    unitsForSelectedSubject
  ]);

  useEffect(() => {
    if (mode !== "attendance") {
      return;
    }
    if (taskPickerOptions.length === 0) {
      setSelectedTaskToAssignId("");
      return;
    }
    const currentTaskId = taskForSelectedSlot?.id;
    if (mode === "attendance" && currentTaskId && taskPickerOptions.some((task) => task.id === currentTaskId)) {
      setSelectedTaskToAssignId(currentTaskId);
      return;
    }
    if (mode === "attendance" && !currentTaskId) {
      if (selectedTaskToAssignId && !taskPickerOptions.some((task) => task.id === selectedTaskToAssignId)) {
        setSelectedTaskToAssignId("");
      }
      return;
    }
    if (!taskPickerOptions.some((task) => task.id === selectedTaskToAssignId)) {
      setSelectedTaskToAssignId(taskPickerOptions[0].id);
    }
  }, [mode, selectedTaskToAssignId, taskForSelectedSlot?.id, taskPickerOptions]);

  useEffect(() => {
    if (selectedTaskSessionsForDay.length === 0) {
      setSelectedTaskSessionSlotId("");
      return;
    }
    const exists = selectedTaskSessionsForDay.some(
      (item) =>
        item.scheduleSlotId === selectedTaskSessionSlotId &&
        (mode !== "work" || item.date === selectedDate)
    );
    if (!exists) {
      const firstSession = selectedTaskSessionsForDay[0];
      setSelectedTaskSessionSlotId(firstSession.scheduleSlotId);
      if (mode === "work" && selectedDate !== firstSession.date) {
        setSelectedDate(firstSession.date);
      }
    }
  }, [mode, selectedDate, selectedTaskSessionSlotId, selectedTaskSessionsForDay]);

  useEffect(() => {
    if (!selectedTaskForDay || !selectedTaskSessionForDay || !activeClassId || !activeSubjectId) {
      setTaskGeneralCommentDraft("");
      setTaskStudentCommentDraft(new Map());
      setSelectedRubricTemplateId("");
      setSelectedChecklistTemplateId("");
      setTaskRubricDraft(new Map());
      setTaskChecklistDraft(new Map());
      setTaskDirectGradeDraft(new Map());
      setTaskNotice("");
      setTaskDirty(false);
      return;
    }
    const diaryDate = mode === "work" ? (selectedTaskSessionForDay?.date ?? workDiaryDateKey) : selectedDate;
    const slotId = mode === "work" ? (selectedTaskSessionForDay?.scheduleSlotId ?? workDiarySlotId) : (selectedTaskSessionForDay?.scheduleSlotId ?? "");
    const setting =
      taskDailyEvaluationSettings.find(
        (item) =>
          item.taskId === selectedTaskForDay.id &&
          item.date === diaryDate &&
          (item.scheduleSlotId ?? "") === slotId &&
          matchesTaskScope(item, activeClassId, activeSubjectId)
      ) ?? null;
    const legacySetting =
      taskDailyEvaluationSettings.find(
        (item) =>
          item.taskId === selectedTaskForDay.id &&
          item.date === diaryDate &&
          !item.scheduleSlotId &&
          matchesTaskScope(item, activeClassId, activeSubjectId)
      ) ?? null;

    setTaskGeneralCommentDraft(setting?.generalComment ?? legacySetting?.generalComment ?? "");
    const commentsMap = new Map<string, string>();
    let hasScopedComments = false;
    for (const row of taskStudentComments) {
      if (
        row.taskId === selectedTaskForDay.id &&
        row.date === diaryDate &&
        (row.scheduleSlotId ?? "") === slotId &&
        matchesTaskScope(row, activeClassId, activeSubjectId)
      ) {
        hasScopedComments = true;
        commentsMap.set(row.studentId, row.comment);
      }
    }
    if (!hasScopedComments) {
      for (const row of taskStudentComments) {
        if (
          row.taskId === selectedTaskForDay.id &&
          !row.date &&
          !row.scheduleSlotId &&
          matchesTaskScope(row, activeClassId, activeSubjectId)
        ) {
          commentsMap.set(row.studentId, row.comment);
        }
      }
    }
    setTaskStudentCommentDraft(commentsMap);

    const taskRubricId = selectedTaskGradebookConfig?.rubricTemplateId ?? "";
    const taskChecklistId = selectedTaskGradebookConfig?.checklistTemplateId ?? "";
    if (taskRubricId) {
      setSelectedRubricTemplateId(taskRubricId);
      setSelectedChecklistTemplateId("");
    } else if (taskChecklistId) {
      setSelectedRubricTemplateId("");
      setSelectedChecklistTemplateId(taskChecklistId);
    } else {
      setSelectedRubricTemplateId("");
      setSelectedChecklistTemplateId("");
    }

    const rubricMap = new Map<string, string>();
    for (const row of taskRubricAssessments) {
      if (
        row.taskId !== selectedTaskForDay.id ||
        row.date !== diaryDate ||
        (row.scheduleSlotId ?? "") !== slotId ||
        !matchesTaskScope(row, activeClassId, activeSubjectId)
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
        row.date !== diaryDate ||
        (row.scheduleSlotId ?? "") !== slotId ||
        !matchesTaskScope(row, activeClassId, activeSubjectId)
      ) {
        continue;
      }
      checklistMap.set(checklistDraftKey(row.studentId, row.itemId), row.checked);
    }
    setTaskChecklistDraft(checklistMap);

    const directGradeMap = new Map<string, string>();
    for (const row of taskDirectGrades) {
      if (
        row.taskId !== selectedTaskForDay.id ||
        row.classId !== activeClassId ||
        row.subjectId !== activeSubjectId
      ) {
        continue;
      }
      directGradeMap.set(row.studentId, String(row.score));
    }
    setTaskDirectGradeDraft(directGradeMap);
    setTaskNotice("");
    setTaskDirty(false);
  }, [
    activeClassId,
    activeSubjectId,
    selectedDate,
    selectedTaskGradebookConfig,
    selectedTaskForDay,
    selectedTaskSessionForDay,
    taskChecklistAssessments,
    taskDailyEvaluationSettings,
    taskDirectGrades,
    taskRubricAssessments,
    taskStudentComments,
    mode,
    workDiaryDateKey,
    workDiarySlotId
  ]);

  const attendanceDirty = draftStatusByStudent.size > 0 || draftNoteByStudent.size > 0;

  const markTaskDirty = (): void => {
    taskEditVersionRef.current += 1;
    setTaskDirty(true);
  };

  const setDraftNote = (studentId: string, note: string): void => {
    const existingNote = normalizeAttendanceNote(attendanceByStudent.get(studentId)?.note) ?? "";
    const normalizedNote = normalizeAttendanceNote(note) ?? "";
    setDraftNoteByStudent((prev) => {
      const next = new Map(prev);
      if (normalizedNote === existingNote) {
        next.delete(studentId);
      } else {
        next.set(studentId, note);
      }
      return next;
    });
    setAttendanceNotice("");
  };

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
    if (attendanceAutoSaveTimerRef.current !== null) {
      window.clearTimeout(attendanceAutoSaveTimerRef.current);
      attendanceAutoSaveTimerRef.current = null;
    }
    const statusDraftSnapshot = new Map(draftStatusByStudent);
    const noteDraftSnapshot = new Map(draftNoteByStudent);
    setIsSavingAttendance(true);
    try {
      for (const student of students) {
        const studentId = student.id;
        const status =
          statusDraftSnapshot.get(studentId) ??
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
          classId: selectedSubjectSlot.classId,
          studentId,
          date: selectedDate,
          scheduleSlotId: selectedSubjectSlot.slotId,
          status,
          note: resolveAttendanceNoteForSave(studentId, noteDraftSnapshot, existing?.note)
        });
      }
      setDraftStatusByStudent((current) => {
        const next = new Map(current);
        for (const [studentId, status] of statusDraftSnapshot) {
          if (next.get(studentId) === status) {
            next.delete(studentId);
          }
        }
        return next;
      });
      setDraftNoteByStudent((current) => {
        const next = new Map(current);
        for (const [studentId, note] of noteDraftSnapshot) {
          if (next.get(studentId) === note) {
            next.delete(studentId);
          }
        }
        return next;
      });
      setAttendanceNotice("Asistencia guardada automaticamente.");
      await loadData();
      return true;
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const saveTaskDiary = async (): Promise<boolean> => {
    if (!selectedTaskForDay || !activeClassId || !activeSubjectId || !selectedTaskSessionForDay) {
      return false;
    }
    if (taskAutoSaveTimerRef.current !== null) {
      window.clearTimeout(taskAutoSaveTimerRef.current);
      taskAutoSaveTimerRef.current = null;
    }

    const saveVersion = taskEditVersionRef.current;
    const taskId = selectedTaskForDay.id;
    const diaryDate = mode === "work" ? (selectedTaskSessionForDay?.date ?? workDiaryDateKey) : selectedDate;
    const scheduleSlotId = mode === "work" ? (selectedTaskSessionForDay?.scheduleSlotId ?? workDiarySlotId) : (selectedTaskSessionForDay?.scheduleSlotId ?? "");
    const normalizedGeneralComment = taskGeneralCommentDraft.trim();
    const effectiveRubricTemplateId = selectedTaskGradebookConfig?.rubricTemplateId ?? "";
    const effectiveChecklistTemplateId = effectiveRubricTemplateId
      ? ""
      : (selectedTaskGradebookConfig?.checklistTemplateId ?? "");
    const usesDirectGrade = Boolean(selectedTaskGradebookConfig?.directGradeEnabled);
    const normalizedDirectGrades: TaskDirectGrade[] = [];
    if (usesDirectGrade) {
      for (const student of taskStudents) {
        const rawValue = taskDirectGradeDraft.get(student.id)?.trim() ?? "";
        if (!rawValue) {
          continue;
        }
        const score = Number(rawValue.replace(",", "."));
        if (!Number.isFinite(score) || score < 0 || score > 10) {
          setTaskNotice("La nota directa debe estar entre 0 y 10.");
          return false;
        }
        normalizedDirectGrades.push({
          id: `task-direct-${taskId}-${activeSubjectId}-${activeClassId}-${student.id}`,
          taskId,
          subjectId: activeSubjectId,
          classId: activeClassId,
          studentId: student.id,
          score: Number(score.toFixed(2))
        });
      }
    }
    const normalizedComments = taskStudents
      .map((student) => ({
        id: crypto.randomUUID(),
        taskId,
        subjectId: activeSubjectId,
        classId: activeClassId,
        date: diaryDate,
        scheduleSlotId,
        studentId: student.id,
        comment: (taskStudentCommentDraft.get(student.id) ?? "").trim()
      }))
      .filter((row) => row.comment.length > 0);

    setIsSavingTask(true);
    try {
      await db.transaction(
        "rw",
        db.taskStudentComments,
        db.taskDailyEvaluationSettings,
        db.taskRubricAssessments,
        db.taskChecklistAssessments,
        db.taskDirectGrades,
        async () => {
          const commentIds = (await db.taskStudentComments
            .where("[taskId+classId+subjectId+date+scheduleSlotId]")
            .equals([taskId, activeClassId, activeSubjectId, diaryDate, scheduleSlotId])
            .primaryKeys()) as string[];
          await db.taskStudentComments.bulkDelete(commentIds);
          if (normalizedComments.length > 0) {
            await db.taskStudentComments.bulkAdd(normalizedComments);
          }

          const settingIds = (await db.taskDailyEvaluationSettings
            .where("[taskId+classId+subjectId+date+scheduleSlotId]")
            .equals([taskId, activeClassId, activeSubjectId, diaryDate, scheduleSlotId])
            .primaryKeys()) as string[];
          await db.taskDailyEvaluationSettings.bulkDelete(settingIds);
          if (normalizedGeneralComment || effectiveRubricTemplateId || effectiveChecklistTemplateId) {
            await db.taskDailyEvaluationSettings.add({
              id: `task-eval-${taskId}-${activeSubjectId}-${activeClassId}-${diaryDate}-${scheduleSlotId}`,
              taskId,
              subjectId: activeSubjectId,
              classId: activeClassId,
              date: diaryDate,
              scheduleSlotId,
              generalComment: normalizedGeneralComment || undefined,
              rubricTemplateId: effectiveRubricTemplateId || undefined,
              checklistTemplateId: effectiveChecklistTemplateId || undefined
            });
          }

          const rubricIds = (await db.taskRubricAssessments
            .where("[taskId+classId+subjectId+date+scheduleSlotId]")
            .equals([taskId, activeClassId, activeSubjectId, diaryDate, scheduleSlotId])
            .primaryKeys()) as string[];
          await db.taskRubricAssessments.bulkDelete(rubricIds);
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
                  subjectId: activeSubjectId,
                  classId: activeClassId,
                  date: diaryDate,
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

          const checklistIds = (await db.taskChecklistAssessments
            .where("[taskId+classId+subjectId+date+scheduleSlotId]")
            .equals([taskId, activeClassId, activeSubjectId, diaryDate, scheduleSlotId])
            .primaryKeys()) as string[];
          await db.taskChecklistAssessments.bulkDelete(checklistIds);
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
                  subjectId: activeSubjectId,
                  classId: activeClassId,
                  date: diaryDate,
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

          if (usesDirectGrade) {
            await db.taskDirectGrades
              .where("[taskId+subjectId+classId]")
              .equals([taskId, activeSubjectId, activeClassId])
              .delete();
            if (normalizedDirectGrades.length > 0) {
              await db.taskDirectGrades.bulkAdd(normalizedDirectGrades);
            }
          }
        }
      );

      if (taskEditVersionRef.current === saveVersion) {
        setTaskDirty(false);
        setTaskNotice("Registro de tarea guardado automaticamente.");
        await loadMetadata();
      }
      return true;
    } finally {
      setIsSavingTask(false);
    }
  };

  const assignTaskToSelectedClass = async (taskId = selectedTaskToAssignId): Promise<void> => {
    if (!selectedSubjectSlot || !taskId) {
      return;
    }
    const occupied = taskSessionForSelectedSlot;
    if (occupied && occupied.taskId !== taskId) {
      await db.transaction(
        "rw",
        db.tables,
        async () => {
          await db.taskSessions.where("id").equals(occupied.id).delete();
          const settingIds = (await db.taskDailyEvaluationSettings
            .where("[taskId+classId+subjectId+date+scheduleSlotId]")
            .equals([occupied.taskId, selectedSubjectSlot.classId, selectedSubjectSlot.subjectId, selectedDate, selectedSubjectSlot.slotId])
            .primaryKeys()) as string[];
          await db.taskDailyEvaluationSettings.bulkDelete(settingIds);
          const commentIds = (await db.taskStudentComments
            .where("[taskId+classId+subjectId+date+scheduleSlotId]")
            .equals([occupied.taskId, selectedSubjectSlot.classId, selectedSubjectSlot.subjectId, selectedDate, selectedSubjectSlot.slotId])
            .primaryKeys()) as string[];
          await db.taskStudentComments.bulkDelete(commentIds);
          const rubricIds = (await db.taskRubricAssessments
            .where("[taskId+classId+subjectId+date+scheduleSlotId]")
            .equals([occupied.taskId, selectedSubjectSlot.classId, selectedSubjectSlot.subjectId, selectedDate, selectedSubjectSlot.slotId])
            .primaryKeys()) as string[];
          await db.taskRubricAssessments.bulkDelete(rubricIds);
          const checklistIds = (await db.taskChecklistAssessments
            .where("[taskId+classId+subjectId+date+scheduleSlotId]")
            .equals([occupied.taskId, selectedSubjectSlot.classId, selectedSubjectSlot.subjectId, selectedDate, selectedSubjectSlot.slotId])
            .primaryKeys()) as string[];
          await db.taskChecklistAssessments.bulkDelete(checklistIds);
          await db.taskSessions.add({
            id: crypto.randomUUID(),
            taskId,
            subjectId: selectedSubjectSlot.subjectId,
            classId: selectedSubjectSlot.classId,
            date: selectedDate,
            scheduleSlotId: selectedSubjectSlot.slotId
          });
        }
      );
      setSelectedTaskId(taskId);
      setSelectedTaskSessionSlotId(selectedSubjectSlot.slotId);
      setTaskNotice("Tarea cambiada en esta hora.");
      await loadMetadata();
      return;
    }
    const duplicate = taskSessions.some(
      (session) =>
        session.taskId === taskId &&
        session.classId === selectedSubjectSlot.classId &&
        session.date === selectedDate &&
        session.scheduleSlotId === selectedSubjectSlot.slotId
    );
    if (duplicate) {
      setSelectedTaskId(taskId);
      setSelectedTaskSessionSlotId(selectedSubjectSlot.slotId);
      return;
    }

    await db.taskSessions.add({
      id: crypto.randomUUID(),
      taskId,
      subjectId: selectedSubjectSlot.subjectId,
      classId: selectedSubjectSlot.classId,
      date: selectedDate,
      scheduleSlotId: selectedSubjectSlot.slotId
    });
    setSelectedTaskId(taskId);
    setSelectedTaskSessionSlotId(selectedSubjectSlot.slotId);
    setTaskNotice("Tarea asignada a la clase.");
    await loadMetadata();
  };

  const hasUnsavedChanges = attendanceDirty || taskDirty;

  const runWithContextGuard = (action: () => void): void => {
    if (!hasUnsavedChanges) {
      action();
      return;
    }
    void (async () => {
      const attendanceSaved = attendanceDirty ? await saveAttendance() : true;
      if (!attendanceSaved) {
        return;
      }
      const taskSaved = taskDirty ? await saveTaskDiary() : true;
      if (!taskSaved) {
        return;
      }
      action();
    })();
  };

  useEffect(() => {
    if (!attendanceDirty || !selectedSubjectSlot || isSavingAttendance) {
      return;
    }
    if (attendanceAutoSaveTimerRef.current !== null) {
      window.clearTimeout(attendanceAutoSaveTimerRef.current);
    }
    attendanceAutoSaveTimerRef.current = window.setTimeout(() => {
      attendanceAutoSaveTimerRef.current = null;
      void saveAttendance();
    }, 600);
    return () => {
      if (attendanceAutoSaveTimerRef.current !== null) {
        window.clearTimeout(attendanceAutoSaveTimerRef.current);
        attendanceAutoSaveTimerRef.current = null;
      }
    };
  }, [
    attendanceDirty,
    draftNoteByStudent,
    draftStatusByStudent,
    isSavingAttendance,
    selectedDate,
    selectedSubjectSlot?.key
  ]);

  useEffect(() => {
    if (!taskDirty || !selectedTaskForDay || !selectedTaskSessionForDay || isSavingTask) {
      return;
    }
    if (taskAutoSaveTimerRef.current !== null) {
      window.clearTimeout(taskAutoSaveTimerRef.current);
    }
    taskAutoSaveTimerRef.current = window.setTimeout(() => {
      taskAutoSaveTimerRef.current = null;
      void saveTaskDiary();
    }, 700);
    return () => {
      if (taskAutoSaveTimerRef.current !== null) {
        window.clearTimeout(taskAutoSaveTimerRef.current);
        taskAutoSaveTimerRef.current = null;
      }
    };
  }, [
    isSavingTask,
    mode,
    selectedDate,
    selectedTaskForDay?.id,
    selectedTaskSessionForDay?.date,
    selectedTaskSessionForDay?.scheduleSlotId,
    taskDirectGradeDraft,
    taskChecklistDraft,
    taskDirty,
    taskGeneralCommentDraft,
    taskRubricDraft,
    taskStudentCommentDraft,
    workDiaryDateKey
  ]);

  const calendarCells = useMemo(() => monthGrid(calendarMonth, weekStartsOn), [calendarMonth, weekStartsOn]);
  const calendarWeekdayLabels = useMemo(() => weekdayLabels(weekStartsOn), [weekStartsOn]);
  const renderStudentCommentInput = (student: Student) => (
    <textarea
      className="input observation-textarea student-comment-textarea"
      rows={2}
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
        markTaskDirty();
      }}
    />
  );
  const renderDirectGradeInput = (student: Student) => (
    <input
      className="input"
      type="number"
      min={0}
      max={10}
      step={0.1}
      value={taskDirectGradeDraft.get(student.id) ?? ""}
      placeholder="0-10"
      onChange={(event) => {
        const value = event.target.value;
        setTaskDirectGradeDraft((current) => {
          const next = new Map(current);
          if (value.trim().length === 0) {
            next.delete(student.id);
          } else {
            next.set(student.id, value);
          }
          return next;
        });
        setTaskNotice("");
        markTaskDirty();
      }}
    />
  );
  const savePendingWorkChanges = async (): Promise<void> => {
    if (attendanceDirty) {
      await saveAttendance();
    }
    if (taskDirty) {
      await saveTaskDiary();
    }
  };

  const selectWorkTaskSession = async (session: TaskSession): Promise<void> => {
    if (taskDirty) {
      const saved = await saveTaskDiary();
      if (!saved) {
        return;
      }
    }
    setSelectedTaskSessionSlotId(session.scheduleSlotId);
    if (selectedDate !== session.date) {
      setSelectedDate(session.date);
    }
  };

  return (
    <section className="module-card">
      <div className="courses-layout">
        <aside className="courses-list-panel">
          {mode === "attendance" ? (
            <>
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
                  {calendarWeekdayLabels.map((item) => (
                    <span key={item} className="attendance-calendar-weekday">
                      {item}
                    </span>
                  ))}
                  {calendarCells.map((cell) => {
                    const iso = toIsoDate(cell.date);
                    const isToday = iso === today;
                    const isSelected = selectedDate === iso;
                    return (
                      <button
                        key={iso}
                        type="button"
                        className={`attendance-calendar-day ${cell.inMonth ? "" : "outside"} ${
                          isSelected ? "selected" : ""
                        } ${isToday ? "today" : ""}`}
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
                </div>
              </section>
              <div className="attendance-day-nav">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Día anterior"
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
                  aria-label="Día siguiente"
                  onClick={() => {
                    runWithContextGuard(() => setSelectedDate((current) => shiftIsoDate(current, 1)));
                  }}
                >
                  {">"}
                </button>
              </div>
              <div className="courses-list-header">
                <strong>Clases del día</strong>
              </div>
              <div className="courses-list section-tabs" role="tablist" aria-label="Clases del día">
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
                      {taskTitleByClassSlot.get(`${slot.classId}:${slot.slotId}`) ?? "Sin unidad / Sin tarea"}
                    </small>
                    <small>
                      {slot.className} · {slot.startTime} - {slot.endTime}
                    </small>
                  </button>
                ))}
                {subjectSlotsForDate.length === 0 ? (
                  <p className="hint">No hay clases programadas para este día.</p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="context-sidebar-tabs">
                <div className="context-sidebar-group">
                  <strong>Curso</strong>
                  {classGroups.length > 0 ? (
                    <div className="courses-list section-tabs context-sidebar-list" role="tablist" aria-label="Curso">
                      {classGroups.map((classGroup) => (
                        <button
                          key={classGroup.id}
                          type="button"
                          role="tab"
                          aria-selected={selectedClassId === classGroup.id}
                          className={`section-tab ${selectedClassId === classGroup.id ? "active" : ""}`}
                          onClick={async () => {
                            await savePendingWorkChanges();
                            dispatch(setSelectedClass(classGroup.id));
                          }}
                        >
                          <span>{classGroup.name || "Curso sin nombre"}</span>
                          <small>{classGroup.schoolYear}</small>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="hint">No hay cursos creados.</p>
                  )}
                </div>

                {selectedClassId ? (
                  <>
                    <div className="context-sidebar-separator" aria-hidden="true" />
                    <div className="context-sidebar-group">
                      <strong>Asignatura</strong>
                      {workSubjects.length > 0 ? (
                        <div className="courses-list section-tabs context-sidebar-list" role="tablist" aria-label="Asignatura">
                          {workSubjects.map((subject) => (
                            <button
                              key={subject.id}
                              type="button"
                              role="tab"
                              aria-selected={selectedSubjectId === subject.id}
                              className={`section-tab ${selectedSubjectId === subject.id ? "active" : ""}`}
                              onClick={async () => {
                                await savePendingWorkChanges();
                                dispatch(setSelectedSubject(subject.id));
                              }}
                            >
                              <span>{subject.name || "Asignatura sin nombre"}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="hint">No hay asignaturas asociadas a este curso.</p>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
              {selectedSubjectId ? (
                <div className="context-sidebar-tabs">
                  <div className="context-sidebar-separator" aria-hidden="true" />
                  <div className="context-sidebar-group">
                    <strong>Unidades</strong>
                    {workUnits.length > 0 ? (
                      <div className="courses-list section-tabs context-sidebar-list" role="tablist" aria-label="Unidades">
                        {workUnits.map((unit) => (
                          <button
                            key={unit.id}
                            type="button"
                            role="tab"
                            aria-selected={selectedWorkUnitId === unit.id}
                            className={`section-tab ${selectedWorkUnitId === unit.id ? "active" : ""}`}
                            onClick={async () => {
                              await savePendingWorkChanges();
                              setSelectedWorkUnitId(unit.id);
                            }}
                          >
                            <span>{unit.name || "Unidad sin nombre"}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="hint">No hay unidades creadas para esta asignatura.</p>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="courses-list-header">
                <strong>Tareas</strong>
              </div>
              <div className="courses-list section-tabs" role="tablist" aria-label="Listado de tareas">
                {workTaskOptions.map(({ task, unitName, sessionCount }) => (
                  <div key={task.id} className="courses-list-row">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selectedTaskId === task.id}
                      className={`section-tab ${selectedTaskId === task.id ? "active" : ""}`}
                      onClick={() => {
                        runWithContextGuard(() => setSelectedTaskId(task.id));
                      }}
                    >
                      <span>{task.title || "Tarea sin título"}</span>
                      <small>{unitName}</small>
                      <small>{sessionCount} sesiones</small>
                    </button>
                  </div>
                ))}
                {workTaskOptions.length === 0 ? (
                  <p className="hint">
                    {selectedWorkUnitId ? "No hay tareas en esta unidad." : "Selecciona una unidad."}
                  </p>
                ) : null}
              </div>
            </>
          )}
        </aside>

        <section className="course-detail-panel">
          {mode === "attendance" ? (
            selectedSubjectSlot ? (
            <>
              <div className="course-detail-header compact-hour-header">
                <div>
                  <h4>{selectedSubjectSlot.subjectName}</h4>
                  <p>
                    {selectedSubjectSlot.className}{" · "}
                    {selectedSubjectSlot.dayName} · {selectedSubjectSlot.startTime} - {selectedSubjectSlot.endTime}
                  </p>
                </div>
              </div>

              {isSavingAttendance ? (
                <p className="hint" role="status" aria-live="polite">
                  Guardando asistencia...
                </p>
              ) : null}
              {attendanceNotice ? (
                <p className="hint" role="status" aria-live="polite">
                  {attendanceNotice}
                </p>
              ) : null}
              <section className="detail-section diary-work-section">
                <h5>Trabajo realizado en esta hora</h5>
                <div className="diary-task-picker">
                  <label className="diary-inline-select">
                    <span>Unidad:</span>
                    <select
                      className="input"
                      value={selectedUnitToAssignId}
                      disabled={unitsForSelectedSubject.length === 0}
                      onChange={(event) => setSelectedUnitToAssignId(event.target.value)}
                    >
                      <option value="" />
                      {unitsForSelectedSubject.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                            {unit.name || "Unidad sin título"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="diary-inline-select">
                    <span>Tarea:</span>
                    <select
                      className="input"
                      value={selectedTaskToAssignId}
                      disabled={availableTasksToAssign.length === 0}
                      onChange={(event) => {
                        const taskId = event.target.value;
                        setSelectedTaskToAssignId(taskId);
                        if (!taskId) {
                          return;
                        }
                        runWithContextGuard(() => {
                          void assignTaskToSelectedClass(taskId);
                        });
                      }}
                    >
                      <option value="" />
                      {availableTasksToAssign.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title || "Tarea sin título"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {availableTasksToAssign.length === 0 ? (
                  <p className="hint">
                    {unitsForSelectedSubject.length === 0
                      ? "No hay unidades para esta asignatura."
                      : taskForSelectedSlot
                      ? "No hay otras tareas disponibles para esta asignatura y hora."
                      : "No hay tareas disponibles para esta asignatura y hora."}
                  </p>
                ) : null}
                {taskForSelectedSlot ? (
                  <div className="detail-field full">
                    <label htmlFor="attendance-task-general-comment">Comentario general de la tarea en esta hora</label>
                    <textarea
                      id="attendance-task-general-comment"
                      className="input observation-textarea"
                      rows={4}
                      value={taskGeneralCommentDraft}
                      placeholder="Comentario general para esta tarea y esta hora"
                      disabled={!selectedTaskSessionForDay}
                      onChange={(event) => {
                        setTaskGeneralCommentDraft(event.target.value);
                        setTaskNotice("");
                        markTaskDirty();
                      }}
                    />
                  </div>
                ) : null}
              </section>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Alumno</th>
                      <th>Estado</th>
                      <th>Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const entry = attendanceByStudent.get(student.id);
                      const status = entry?.status ?? "present";

                      return (
                        <tr key={student.id}>
                          <td>{formatName(student)}</td>
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
                          <td>
                            <textarea
                              className="attendance-note-input observation-textarea"
                              rows={2}
                              value={
                                draftNoteByStudent.has(student.id)
                                  ? (draftNoteByStudent.get(student.id) ?? "")
                                  : (entry?.note ?? "")
                              }
                              placeholder="Observaciones"
                              onChange={(event) => setDraftNote(student.id, event.target.value)}
                            />
                          </td>
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
            <p>Selecciona una clase del día para pasar lista.</p>
          )
          ) : (
            <>
              {!selectedClassId || !selectedSubjectId ? (
                <p className="hint">Selecciona curso y asignatura para revisar el trabajo.</p>
              ) : null}

              {selectedClassId && selectedSubjectId && selectedTaskForDay ? (
                <>
                  {isSavingTask ? (
                    <p className="hint" role="status" aria-live="polite">
                      Guardando registro de tarea...
                    </p>
                  ) : null}
                  {taskNotice ? (
                    <p className="hint" role="status" aria-live="polite">
                      {taskNotice}
                    </p>
                  ) : null}

                  <section className="detail-section">
                    <h5>Horas de la tarea</h5>
                    {workTaskSessions.length > 0 ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Hora</th>
                              <th>Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {workTaskSessions.map((session) => (
                              <tr key={session.id}>
                                <td>{session.date}</td>
                                <td>{slotTimeLabelById.get(session.scheduleSlotId) ?? session.scheduleSlotId}</td>
                                <td>
                                  <button
                                    type="button"
                                    className={`btn secondary ${selectedTaskSessionForDay?.id === session.id ? "active" : ""}`}
                                    onClick={() => void selectWorkTaskSession(session)}
                                    aria-pressed={selectedTaskSessionForDay?.id === session.id}
                                  >
                                    {selectedTaskSessionForDay?.id === session.id ? "Seleccionada" : "Seleccionar"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="hint">No hay horas registradas para esta tarea.</p>
                    )}
                  </section>

                  {taskHasDirectGrade ? (
                    <section className="detail-section">
                      <h5>Nota directa</h5>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Alumno</th>
                              <th>Comentario</th>
                              <th>Nota</th>
                            </tr>
                          </thead>
                          <tbody>
                            {taskStudents.map((student) => (
                              <tr key={student.id}>
                                <td>{formatName(student)}</td>
                                <td>{renderStudentCommentInput(student)}</td>
                                <td>{renderDirectGradeInput(student)}</td>
                              </tr>
                            ))}
                            {taskStudents.length === 0 ? (
                              <tr>
                                <td colSpan={3}>No hay alumnos asociados a esta tarea.</td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ) : !selectedRubricTemplate && !selectedChecklistTemplate ? (
                    <section className="detail-section">
                      <h5>Comentarios por alumno</h5>
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
                                <td>{formatName(student)}</td>
                                <td>{renderStudentCommentInput(student)}</td>
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
                  ) : null}

                  {selectedRubricTemplate ? (
                    <section className="detail-section">
                      <h5>Rúbrica</h5>
                      {false ? (
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
                            markTaskDirty();
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
                      ) : null}
                      {selectedRubricTemplate ? (
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Alumno</th>
                                <th>Comentario</th>
                                {(selectedRubricTemplate.criteria ?? []).map((criterion) => (
                                  <th key={criterion.id}>{criterion.name}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {taskStudents.map((student) => (
                                <tr key={student.id}>
                                  <td>{formatName(student)}</td>
                                  <td>{renderStudentCommentInput(student)}</td>
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
                                          markTaskDirty();
                                        }}
                                      >
                                        <option value="">-</option>
                                        {(criterion.levels ?? []).map((level) => (
                                          <option key={level.id} value={level.id}>
                                            {level.name} · {level.score} puntos
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

                  {selectedChecklistTemplate ? (
                    <section className="detail-section">
                      <h5>Lista de cotejo</h5>
                      {false ? (
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
                            markTaskDirty();
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
                      ) : null}
                      {selectedChecklistTemplate ? (
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Alumno</th>
                                <th>Comentario</th>
                                {(selectedChecklistTemplate.items ?? []).map((item) => (
                                  <th key={item.id}>{item.text}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {taskStudents.map((student) => (
                                <tr key={student.id}>
                                  <td>{formatName(student)}</td>
                                  <td>{renderStudentCommentInput(student)}</td>
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
                                          markTaskDirty();
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

                  {!taskHasAssignedInstrument ? (
                    <p className="hint">
                      Esta tarea no tiene rúbrica ni lista de cotejo asignada. Asigna el instrumento en Tareas.
                    </p>
                  ) : null}

                  {false && !taskHasAssignedInstrument ? (
                    <p className="hint">
            Esta tarea no tiene rúbrica ni lista de cotejo asignada. Asigna el instrumento en Tareas.
                    </p>
                  ) : null}

                </>
              ) : (
                <p>Selecciona una tarea para registrar comentarios y evaluación.</p>
              )}
            </>
          )}

        </section>
      </div>
    </section>
  );
}
