import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { db } from "../../shared/db/database";
import type {
  AttendanceEntry,
  ClassGroup,
  DailyClassRecord,
  ScheduleDay,
  Student,
  Subject,
  SubjectCourseLink,
  SubjectStudentLink,
  Task,
  TaskDailyEvaluationSetting,
  TaskSession,
  TaskStudentComment
} from "../../shared/db/types";
import {
  normalizeAttendanceDetails,
  normalizeAttendanceNote,
  resolveAttendanceNoteForSave,
  type AttendanceDetailsDraft
} from "../../shared/attendance/attendance";
import { matchesTaskScope } from "../../shared/gradebook/calculations";
import { useStudentDisplay } from "../../shared/hooks/useStudentDisplay";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";
import { Modal } from "../../shared/ui/Modal";
import { useUnsavedChangesDialog } from "../../shared/ui/UnsavedChangesDialog";
import { buildTodaySlots, type TodaySlot } from "./todaySlots";

const STATUS_LABELS: Record<AttendanceEntry["status"], string> = {
  present: "Presente",
  late: "Retraso",
  absent: "Ausente"
};

const STATUS_SHORT_LABELS: Record<AttendanceEntry["status"], string> = {
  present: "P",
  late: "R",
  absent: "A"
};

const SESSION_STATUS_LABELS: Record<NonNullable<TaskSession["status"]>, string> = {
  planned: "Planificada",
  done: "Hecha",
  moved: "Movida",
  cancelled: "Cancelada"
};

const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long"
});

type ExceptionalSessionDraft = {
  classId: string;
  subjectId: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
};

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftIsoDate(value: string, deltaDays: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + deltaDays);
  return toIsoDate(date);
}

function formatDateLabel(value: string): string {
  return DATE_LABEL_FORMATTER.format(new Date(`${value}T12:00:00`));
}

function toMinutes(value: string): number {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : 0;
}

function closestSlotKey(slots: TodaySlot[], date: string): string {
  if (slots.length === 0) return "";
  if (date !== toIsoDate(new Date())) return slots[0].key;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const activeSlot = slots.find((slot) => toMinutes(slot.startTime) <= nowMinutes && nowMinutes <= toMinutes(slot.endTime));
  if (activeSlot) return activeSlot.key;
  const upcomingSlot = slots.find((slot) => toMinutes(slot.startTime) >= nowMinutes);
  if (upcomingSlot) return upcomingSlot.key;

  return slots.reduce((best, slot) => {
    const bestDistance = Math.abs(toMinutes(best.startTime) - nowMinutes);
    const currentDistance = Math.abs(toMinutes(slot.startTime) - nowMinutes);
    return currentDistance < bestDistance ? slot : best;
  }, slots[0]).key;
}

export function TodayPage() {
  const { formatName, compareFn } = useStudentDisplay();
  const unsavedChangesDialog = useUnsavedChangesDialog();
  const [searchParams] = useSearchParams();
  const requestedDate = searchParams.get("date") ?? "";
  const [selectedDate, setSelectedDate] = useState(() =>
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : toIsoDate(new Date())
  );
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const deepLinkAppliedRef = useRef(false);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectCourseLinks, setSubjectCourseLinks] = useState<SubjectCourseLink[]>([]);
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [subjectStudentLinks, setSubjectStudentLinks] = useState<SubjectStudentLink[]>([]);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);
  const [dailyClassRecords, setDailyClassRecords] = useState<DailyClassRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskSessions, setTaskSessions] = useState<TaskSession[]>([]);
  const [taskDailySettings, setTaskDailySettings] = useState<TaskDailyEvaluationSetting[]>([]);
  const [taskStudentComments, setTaskStudentComments] = useState<TaskStudentComment[]>([]);
  const [statusDraft, setStatusDraft] = useState<Map<string, AttendanceEntry["status"]>>(new Map());
  const [noteDraft, setNoteDraft] = useState<Map<string, string>>(new Map());
  const [attendanceDetailsDraft, setAttendanceDetailsDraft] = useState<Map<string, AttendanceDetailsDraft>>(new Map());
  const [generalCommentDraft, setGeneralCommentDraft] = useState("");
  const [studentCommentDraft, setStudentCommentDraft] = useState<Map<string, string>>(new Map());
  const [editingNoteStudentId, setEditingNoteStudentId] = useState("");
  const [editingWorkStudentId, setEditingWorkStudentId] = useState("");
  const [notice, setNotice] = useState("");
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [isSavingWork, setIsSavingWork] = useState(false);
  const [exceptionalSessionMode, setExceptionalSessionMode] = useState<"adHoc" | "rescheduled" | null>(null);
  const [exceptionalSessionDraft, setExceptionalSessionDraft] = useState<ExceptionalSessionDraft>({
    classId: "",
    subjectId: "",
    date: toIsoDate(new Date()),
    startTime: "09:00",
    endTime: "09:50",
    title: ""
  });

  const loadMetadata = async (): Promise<void> => {
    const [
      classGroupsData,
      subjectsData,
      subjectCourseLinksData,
      scheduleDaysData,
      studentsData,
      subjectStudentLinksData,
      tasksData,
      taskSessionsData,
      taskDailySettingsData,
      taskStudentCommentsData,
      dailyClassRecordsData
    ] = await Promise.all([
      db.classGroups.orderBy("name").toArray(),
      db.subjects.orderBy("name").toArray(),
      db.subjectCourseLinks.toArray(),
      db.scheduleDays.orderBy("dayOfWeek").toArray(),
      db.students.toArray(),
      db.subjectStudentLinks.toArray(),
      db.tasks.toArray(),
      db.taskSessions.toArray(),
      db.taskDailyEvaluationSettings.toArray(),
      db.taskStudentComments.toArray(),
      db.dailyClassRecords.toArray()
    ]);

    setClassGroups(classGroupsData);
    setSubjects(subjectsData);
    setSubjectCourseLinks(subjectCourseLinksData);
    setScheduleDays(scheduleDaysData);
    setAllStudents(studentsData.sort(compareFn));
    setSubjectStudentLinks(subjectStudentLinksData);
    setTasks(tasksData.sort((a, b) => a.title.localeCompare(b.title)));
    setTaskSessions(taskSessionsData);
    setTaskDailySettings(taskDailySettingsData);
    setTaskStudentComments(taskStudentCommentsData);
    setDailyClassRecords(dailyClassRecordsData);
  };

  useEffect(() => {
    void loadMetadata();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const todaySlots = useMemo(
    () =>
      buildTodaySlots({
        selectedDate,
        classGroups,
        subjects,
        subjectCourseLinks,
        scheduleDays,
        taskSessions,
        dailyClassRecords
      }),
    [classGroups, dailyClassRecords, scheduleDays, selectedDate, subjectCourseLinks, subjects, taskSessions]
  );

  useEffect(() => {
    if (todaySlots.length === 0) {
      setSelectedSlotKey("");
      return;
    }
    if (!deepLinkAppliedRef.current) {
      const requestedClassId = searchParams.get("classId") ?? "";
      const requestedSubjectId = searchParams.get("subjectId") ?? "";
      const requestedSlotId = searchParams.get("slotId") ?? "";
      const requestedSlot = todaySlots.find(
        (slot) =>
          (!requestedClassId || slot.classId === requestedClassId) &&
          (!requestedSubjectId || slot.subjectId === requestedSubjectId) &&
          (!requestedSlotId || slot.slotId === requestedSlotId)
      );
      deepLinkAppliedRef.current = true;
      if (requestedSlot) {
        setSelectedSlotKey(requestedSlot.key);
        return;
      }
    }
    if (!todaySlots.some((slot) => slot.key === selectedSlotKey)) {
      setSelectedSlotKey(closestSlotKey(todaySlots, selectedDate));
    }
  }, [searchParams, selectedDate, selectedSlotKey, todaySlots]);

  const selectedSlot = useMemo(
    () => todaySlots.find((slot) => slot.key === selectedSlotKey) ?? null,
    [selectedSlotKey, todaySlots]
  );

  const students = useMemo(() => {
    if (!selectedSlot) return [];
    const linkedStudentIds = new Set(
      subjectStudentLinks
        .filter((link) => link.subjectId === selectedSlot.subjectId)
        .map((link) => link.studentId)
    );
    return allStudents
      .filter((student) => student.classId === selectedSlot.classId && linkedStudentIds.has(student.id))
      .sort(compareFn);
  }, [allStudents, compareFn, selectedSlot, subjectStudentLinks]);

  const selectedSession = useMemo(() => {
    if (!selectedSlot) return null;
    return (
      taskSessions.find(
        (session) =>
          session.classId === selectedSlot.classId &&
          session.subjectId === selectedSlot.subjectId &&
          session.date === selectedDate &&
          session.scheduleSlotId === selectedSlot.slotId &&
          session.status !== "cancelled"
      ) ?? null
    );
  }, [selectedDate, selectedSlot, taskSessions]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedSession?.taskId) ?? null,
    [selectedSession?.taskId, tasks]
  );
  const editingNoteStudent = useMemo(
    () => students.find((student) => student.id === editingNoteStudentId) ?? null,
    [editingNoteStudentId, students]
  );
  const editingWorkStudent = useMemo(
    () => students.find((student) => student.id === editingWorkStudentId) ?? null,
    [editingWorkStudentId, students]
  );

  const attendanceByStudent = useMemo(
    () => new Map(attendanceEntries.map((entry) => [entry.studentId, entry])),
    [attendanceEntries]
  );

  const baseStatusByStudent = useMemo(() => {
    const map = new Map<string, AttendanceEntry["status"]>();
    for (const student of students) {
      map.set(student.id, attendanceByStudent.get(student.id)?.status ?? "present");
    }
    return map;
  }, [attendanceByStudent, students]);

  const attendanceSummary = useMemo(() => {
    const summary = { present: 0, late: 0, absent: 0 };
    for (const student of students) {
      const status = statusDraft.get(student.id) ?? baseStatusByStudent.get(student.id) ?? "present";
      summary[status] += 1;
    }
    return summary;
  }, [baseStatusByStudent, statusDraft, students]);

  const scopedTaskSetting = useMemo(() => {
    if (!selectedSlot || !selectedTask || !selectedSession) return null;
    return (
      taskDailySettings.find(
        (setting) =>
          setting.taskId === selectedTask.id &&
          setting.date === selectedSession.date &&
          setting.scheduleSlotId === selectedSession.scheduleSlotId &&
          matchesTaskScope(setting, selectedSlot.classId, selectedSlot.subjectId)
      ) ?? null
    );
  }, [selectedSession, selectedSlot, selectedTask, taskDailySettings]);

  const scopedStudentComments = useMemo(() => {
    const comments = new Map<string, string>();
    if (!selectedSlot || !selectedTask || !selectedSession) return comments;
    for (const comment of taskStudentComments) {
      if (
        comment.taskId === selectedTask.id &&
        comment.date === selectedSession.date &&
        comment.scheduleSlotId === selectedSession.scheduleSlotId &&
        matchesTaskScope(comment, selectedSlot.classId, selectedSlot.subjectId)
      ) {
        comments.set(comment.studentId, comment.comment);
      }
    }
    return comments;
  }, [selectedSession, selectedSlot, selectedTask, taskStudentComments]);

  const scopedDailyClassRecord = useMemo(() => {
    if (!selectedSlot || selectedSession) return null;
    return (
      dailyClassRecords.find(
        (record) =>
          record.classId === selectedSlot.classId &&
          record.subjectId === selectedSlot.subjectId &&
          record.date === selectedDate &&
          record.scheduleSlotId === selectedSlot.slotId
      ) ?? null
    );
  }, [dailyClassRecords, selectedDate, selectedSession, selectedSlot]);

  useEffect(() => {
    const loadAttendance = async (): Promise<void> => {
      if (!selectedSlot) {
        setAttendanceEntries([]);
        return;
      }
      const rows = await db.attendanceEntries
        .where("[classId+date+scheduleSlotId]")
        .equals([selectedSlot.classId, selectedDate, selectedSlot.slotId])
        .toArray();
      setAttendanceEntries(rows);
      setStatusDraft(new Map());
      setNoteDraft(new Map());
      setAttendanceDetailsDraft(new Map());
      setNotice("");
    };

    void loadAttendance();
  }, [selectedDate, selectedSlot]);

  useEffect(() => {
    if (!selectedSlot) {
      setGeneralCommentDraft("");
      setStudentCommentDraft(new Map());
      return;
    }
    if (selectedTask && selectedSession) {
      setGeneralCommentDraft(scopedTaskSetting?.generalComment ?? "");
      setStudentCommentDraft(new Map(scopedStudentComments));
      return;
    }
    setGeneralCommentDraft(scopedDailyClassRecord?.generalComment ?? "");
    setStudentCommentDraft(new Map(Object.entries(scopedDailyClassRecord?.studentComments ?? {})));
  }, [scopedDailyClassRecord, scopedStudentComments, scopedTaskSetting, selectedSession, selectedSlot, selectedTask]);

  const setStudentStatus = (studentId: string, status: AttendanceEntry["status"]): void => {
    const baseStatus = baseStatusByStudent.get(studentId) ?? "present";
    setStatusDraft((current) => {
      const next = new Map(current);
      if (status === baseStatus) {
        next.delete(studentId);
      } else {
        next.set(studentId, status);
      }
      return next;
    });
  };

  const setStudentNote = (studentId: string, note: string): void => {
    const existingNote = normalizeAttendanceNote(attendanceByStudent.get(studentId)?.note) ?? "";
    const normalizedNote = normalizeAttendanceNote(note) ?? "";
    setNoteDraft((current) => {
      const next = new Map(current);
      if (normalizedNote === existingNote) {
        next.delete(studentId);
      } else {
        next.set(studentId, note);
      }
      return next;
    });
  };

  const setStudentAttendanceDetails = (
    studentId: string,
    patch: Partial<AttendanceDetailsDraft>
  ): void => {
    const existing = attendanceByStudent.get(studentId);
    setAttendanceDetailsDraft((current) => {
      const next = new Map(current);
      const currentDraft = next.get(studentId) ?? {
        absenceJustified: Boolean(existing?.absenceJustified),
        lateMinutes: existing?.lateMinutes ? String(existing.lateMinutes) : "",
        earlyDepartureMinutes: existing?.earlyDepartureMinutes
          ? String(existing.earlyDepartureMinutes)
          : ""
      };
      next.set(studentId, { ...currentDraft, ...patch });
      return next;
    });
  };

  const setStudentWorkComment = (studentId: string, comment: string): void => {
    setStudentCommentDraft((current) => {
      const next = new Map(current);
      if (comment.trim()) {
        next.set(studentId, comment);
      } else {
        next.delete(studentId);
      }
      return next;
    });
  };

  const saveClassSession = async (): Promise<boolean> => {
    if (!selectedSlot || students.length === 0) return false;
    setIsSavingAttendance(true);
    setIsSavingWork(true);
    try {
      const now = new Date().toISOString();
      const attendanceRows: AttendanceEntry[] = students.map((student) => {
        const existing = attendanceByStudent.get(student.id);
        const status = statusDraft.get(student.id) ?? existing?.status ?? "present";
        const detailsDraft = attendanceDetailsDraft.get(student.id) ?? {
          absenceJustified: Boolean(existing?.absenceJustified),
          lateMinutes: existing?.lateMinutes ? String(existing.lateMinutes) : "",
          earlyDepartureMinutes: existing?.earlyDepartureMinutes
            ? String(existing.earlyDepartureMinutes)
            : ""
        };
        const attendanceDetails = normalizeAttendanceDetails(status, detailsDraft);
        return {
          id: existing?.id ?? `att-${selectedSlot.subjectId}-${student.id}-${selectedDate}-${selectedSlot.slotId}`,
          classId: selectedSlot.classId,
          subjectId: selectedSlot.subjectId,
          studentId: student.id,
          date: selectedDate,
          scheduleSlotId: selectedSlot.slotId,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          status,
          ...attendanceDetails,
          note: resolveAttendanceNoteForSave(student.id, noteDraft, existing?.note),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now
        };
      });
      const workComments = Object.fromEntries(
        students
          .map((student) => [student.id, (studentCommentDraft.get(student.id) ?? "").trim()] as const)
          .filter(([, comment]) => comment.length > 0)
      );

      await db.transaction(
        "rw",
        db.attendanceEntries,
        db.dailyClassRecords,
        db.taskDailyEvaluationSettings,
        db.taskStudentComments,
        db.taskSessions,
        async () => {
          await db.attendanceEntries.bulkPut(attendanceRows);
          if (selectedTask && selectedSession) {
            const settingIds = (await db.taskDailyEvaluationSettings
              .where("[taskId+classId+subjectId+date+scheduleSlotId]")
              .equals([selectedTask.id, selectedSlot.classId, selectedSlot.subjectId, selectedSession.date, selectedSession.scheduleSlotId])
              .primaryKeys()) as string[];
            await db.taskDailyEvaluationSettings.bulkDelete(settingIds);
            if (generalCommentDraft.trim()) {
              await db.taskDailyEvaluationSettings.put({
                id: `task-eval-${selectedTask.id}-${selectedSlot.subjectId}-${selectedSlot.classId}-${selectedSession.date}-${selectedSession.scheduleSlotId}`,
                taskId: selectedTask.id,
                subjectId: selectedSlot.subjectId,
                classId: selectedSlot.classId,
                date: selectedSession.date,
                scheduleSlotId: selectedSession.scheduleSlotId,
                generalComment: generalCommentDraft.trim()
              });
            }
            const commentIds = (await db.taskStudentComments
              .where("[taskId+classId+subjectId+date+scheduleSlotId]")
              .equals([selectedTask.id, selectedSlot.classId, selectedSlot.subjectId, selectedSession.date, selectedSession.scheduleSlotId])
              .primaryKeys()) as string[];
            await db.taskStudentComments.bulkDelete(commentIds);
            const comments = Object.entries(workComments).map(([studentId, comment]) => ({
              id: crypto.randomUUID(),
              taskId: selectedTask.id,
              subjectId: selectedSlot.subjectId,
              classId: selectedSlot.classId,
              date: selectedSession.date,
              scheduleSlotId: selectedSession.scheduleSlotId,
              studentId,
              comment
            }));
            if (comments.length > 0) await db.taskStudentComments.bulkAdd(comments);
            await db.taskSessions.put({ ...selectedSession, status: "done" });
          } else {
            const recordId = scopedDailyClassRecord?.id ?? `daily-${selectedSlot.classId}-${selectedSlot.subjectId}-${selectedDate}-${selectedSlot.slotId}`;
            if (
              generalCommentDraft.trim() ||
              Object.keys(workComments).length > 0 ||
              scopedDailyClassRecord?.sessionKind
            ) {
              await db.dailyClassRecords.put({
                ...scopedDailyClassRecord,
                id: recordId,
                classId: selectedSlot.classId,
                subjectId: selectedSlot.subjectId,
                date: selectedDate,
                scheduleSlotId: selectedSlot.slotId,
                generalComment: generalCommentDraft.trim(),
                studentComments: workComments,
                createdAt: scopedDailyClassRecord?.createdAt ?? now,
                updatedAt: now
              });
            } else if (scopedDailyClassRecord) {
              await db.dailyClassRecords.delete(scopedDailyClassRecord.id);
            }
          }
        }
      );

      const [savedAttendance, settings, savedComments, savedDailyRecords, savedSessions] = await Promise.all([
        db.attendanceEntries
          .where("[classId+date+scheduleSlotId]")
          .equals([selectedSlot.classId, selectedDate, selectedSlot.slotId])
          .toArray(),
        db.taskDailyEvaluationSettings.toArray(),
        db.taskStudentComments.toArray(),
        db.dailyClassRecords.toArray(),
        db.taskSessions.toArray()
      ]);
      setAttendanceEntries(savedAttendance);
      setTaskDailySettings(settings);
      setTaskStudentComments(savedComments);
      setDailyClassRecords(savedDailyRecords);
      setTaskSessions(savedSessions);
      setStatusDraft(new Map());
      setNoteDraft(new Map());
      setAttendanceDetailsDraft(new Map());
      setNotice("Clase guardada: asistencia y registro están al día.");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo completar el guardado";
      setNotice(`No se ha guardado la clase: ${message}.`);
      return false;
    } finally {
      setIsSavingAttendance(false);
      setIsSavingWork(false);
    }
  };

  const hasAttendanceChanges =
    statusDraft.size > 0 || noteDraft.size > 0 || attendanceDetailsDraft.size > 0;
  const savedWorkComments = useMemo(
    () =>
      selectedTask && selectedSession
        ? scopedStudentComments
        : new Map(Object.entries(scopedDailyClassRecord?.studentComments ?? {})),
    [scopedDailyClassRecord, scopedStudentComments, selectedSession, selectedTask]
  );
  const hasStudentCommentChanges = useMemo(() => {
    if (studentCommentDraft.size !== savedWorkComments.size) return true;
    for (const [studentId, comment] of studentCommentDraft) {
      if (comment.trim() !== (savedWorkComments.get(studentId) ?? "")) {
        return true;
      }
    }
    return false;
  }, [savedWorkComments, studentCommentDraft]);
  const savedGeneralComment = selectedTask && selectedSession
    ? scopedTaskSetting?.generalComment ?? ""
    : scopedDailyClassRecord?.generalComment ?? "";
  const hasWorkChanges = (
    generalCommentDraft.trim() !== savedGeneralComment ||
    hasStudentCommentChanges
  );
  const hasUnsavedChanges = hasAttendanceChanges || hasWorkChanges;
  useUnsavedChangesGuard(hasUnsavedChanges, "Hay cambios de asistencia o registro sin guardar en esta clase.");

  const runWithContextGuard = async (action: () => void): Promise<void> => {
    if (!hasUnsavedChanges) {
      action();
      return;
    }
    const shouldDiscard = unsavedChangesDialog
      ? await unsavedChangesDialog.confirmLeave("Hay cambios sin guardar en esta clase. ¿Quieres descartarlos?")
      : window.confirm("Hay cambios sin guardar en esta clase. ¿Quieres descartarlos?");
    if (shouldDiscard) action();
  };
  const exceptionalSubjects = subjects.filter((subject) =>
    subjectCourseLinks.some(
      (link) =>
        link.classId === exceptionalSessionDraft.classId && link.subjectId === subject.id
    )
  );

  const openAdHocSessionModal = (): void => {
    const classId = selectedSlot?.classId ?? classGroups[0]?.id ?? "";
    const subjectId =
      selectedSlot?.subjectId ??
      subjectCourseLinks.find((link) => link.classId === classId)?.subjectId ??
      "";
    setExceptionalSessionDraft({
      classId,
      subjectId,
      date: selectedDate,
      startTime: selectedSlot?.startTime ?? "09:00",
      endTime: selectedSlot?.endTime ?? "09:50",
      title: ""
    });
    setExceptionalSessionMode("adHoc");
  };

  const openRescheduleSessionModal = (): void => {
    if (!selectedSlot) return;
    setExceptionalSessionDraft({
      classId: selectedSlot.classId,
      subjectId: selectedSlot.subjectId,
      date: shiftIsoDate(selectedDate, 1),
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      title: selectedSlot.title ?? selectedTask?.title ?? "Clase reprogramada"
    });
    setExceptionalSessionMode("rescheduled");
  };

  const createExceptionalSession = async (): Promise<void> => {
    if (
      !exceptionalSessionMode ||
      !exceptionalSessionDraft.classId ||
      !exceptionalSessionDraft.subjectId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(exceptionalSessionDraft.date) ||
      exceptionalSessionDraft.endTime <= exceptionalSessionDraft.startTime
    ) {
      setNotice("Revisa el grupo, la asignatura, la fecha y las horas de la sesión.");
      return;
    }
    const now = new Date().toISOString();
    const recordId = crypto.randomUUID();
    const scheduleSlotId = `exception-${recordId}`;
    const record: DailyClassRecord = {
      id: recordId,
      classId: exceptionalSessionDraft.classId,
      subjectId: exceptionalSessionDraft.subjectId,
      date: exceptionalSessionDraft.date,
      scheduleSlotId,
      sessionKind: exceptionalSessionMode,
      sessionTitle:
        exceptionalSessionDraft.title.trim() ||
        (exceptionalSessionMode === "adHoc" ? "Sesión puntual" : "Clase reprogramada"),
      startTime: exceptionalSessionDraft.startTime,
      endTime: exceptionalSessionDraft.endTime,
      originalDate:
        exceptionalSessionMode === "rescheduled" ? selectedDate : undefined,
      originalScheduleSlotId:
        exceptionalSessionMode === "rescheduled" ? selectedSlot?.slotId : undefined,
      generalComment: "",
      studentComments: {},
      createdAt: now,
      updatedAt: now
    };

    await db.transaction("rw", db.dailyClassRecords, db.taskSessions, async () => {
      await db.dailyClassRecords.add(record);
      if (exceptionalSessionMode === "rescheduled" && selectedSession) {
        await db.taskSessions.put({
          ...selectedSession,
          date: record.date,
          scheduleSlotId: record.scheduleSlotId,
          status: "moved"
        });
      }
    });
    const [savedRecords, savedSessions] = await Promise.all([
      db.dailyClassRecords.toArray(),
      db.taskSessions.toArray()
    ]);
    setDailyClassRecords(savedRecords);
    setTaskSessions(savedSessions);
    setExceptionalSessionMode(null);
    setSelectedDate(record.date);
    setSelectedSlotKey(
      `${record.classId}:${record.subjectId}:${record.scheduleSlotId}`
    );
    setNotice(
      exceptionalSessionMode === "adHoc"
        ? "Sesión puntual creada."
        : "Esta clase se ha reprogramado solo para la fecha elegida."
    );
  };

  const planDetails = [
    { label: "Objetivos", value: selectedSession?.objectives },
    { label: "Competencias", value: selectedSession?.competencies },
    { label: "Materiales", value: selectedSession?.materials },
    { label: "Deberes", value: selectedSession?.homework },
    { label: "Notas", value: selectedSession?.teacherNotes }
  ].filter((item): item is { label: string; value: string } => Boolean(item.value?.trim()));
  const studentWorkCommentCount = Array.from(studentCommentDraft.values()).filter((comment) => comment.trim()).length;
  const generalRecordLength = generalCommentDraft.trim().length;
  const sessionStatus = selectedSession?.status ?? "planned";
  const editingNoteValue = editingNoteStudent
    ? noteDraft.get(editingNoteStudent.id) ?? attendanceByStudent.get(editingNoteStudent.id)?.note ?? ""
    : "";
  const editingAttendanceEntry = editingNoteStudent
    ? attendanceByStudent.get(editingNoteStudent.id)
    : undefined;
  const editingAttendanceStatus = editingNoteStudent
    ? statusDraft.get(editingNoteStudent.id) ?? editingAttendanceEntry?.status ?? "present"
    : "present";
  const editingAttendanceDetails = editingNoteStudent
    ? attendanceDetailsDraft.get(editingNoteStudent.id) ?? {
        absenceJustified: Boolean(editingAttendanceEntry?.absenceJustified),
        lateMinutes: editingAttendanceEntry?.lateMinutes
          ? String(editingAttendanceEntry.lateMinutes)
          : "",
        earlyDepartureMinutes: editingAttendanceEntry?.earlyDepartureMinutes
          ? String(editingAttendanceEntry.earlyDepartureMinutes)
          : ""
      }
    : { absenceJustified: false, lateMinutes: "", earlyDepartureMinutes: "" };
  const editingWorkValue = editingWorkStudent ? studentCommentDraft.get(editingWorkStudent.id) ?? "" : "";
  const selectedSessionLabel = selectedSlot ? `${selectedSlot.className} · ${selectedSlot.subjectName}` : "";
  const todayDate = toIsoDate(new Date());
  const selectedDateLabel = formatDateLabel(selectedDate);
  const attendanceHistoryLink = selectedSlot
    ? `/journal/attendance?month=${selectedDate.slice(0, 7)}&classId=${encodeURIComponent(selectedSlot.classId)}&subjectId=${encodeURIComponent(selectedSlot.subjectId)}`
    : "/journal/attendance";
  const evaluationLink = selectedSlot && selectedTask && selectedSession
    ? `/journal/work?classId=${encodeURIComponent(selectedSlot.classId)}&subjectId=${encodeURIComponent(selectedSlot.subjectId)}&taskId=${encodeURIComponent(selectedTask.id)}&date=${selectedDate}&slotId=${encodeURIComponent(selectedSession.scheduleSlotId)}`
    : "/journal/work";
  const plannerLink = selectedSlot
    ? `/planner?date=${selectedDate}&classId=${encodeURIComponent(selectedSlot.classId)}&subjectId=${encodeURIComponent(selectedSlot.subjectId)}&slotId=${encodeURIComponent(selectedSlot.slotId)}`
    : "/planner";
  const isClassSessionSaved =
    students.length > 0 &&
    attendanceEntries.length === students.length &&
    !hasUnsavedChanges &&
    (!selectedSession || selectedSession.status === "done");

  return (
    <section className="module-card today-page" aria-labelledby="today-title">
      <header className="today-header">
        <div>
          <h1 id="today-title">Hoy</h1>
          <p>Agenda, asistencia y registro rápido.</p>
        </div>
        <div className="today-header-controls">
          <div className="today-date-navigation" role="group" aria-label="Navegación por fecha">
            <button
              type="button"
              className="icon-btn today-date-step"
              aria-label="Día anterior"
              onClick={() => void runWithContextGuard(() => setSelectedDate((current) => shiftIsoDate(current, -1)))}
            >
              {"<"}
            </button>
            <label className="today-date-picker">
              <span aria-live="polite">{selectedDateLabel}</span>
              <input
                className="input"
                type="date"
                aria-label="Seleccionar fecha"
                value={selectedDate}
                onChange={(event) => void runWithContextGuard(() => setSelectedDate(event.target.value))}
              />
            </label>
            <button
              type="button"
              className="icon-btn today-date-step"
              aria-label="Día siguiente"
              onClick={() => void runWithContextGuard(() => setSelectedDate((current) => shiftIsoDate(current, 1)))}
            >
              {">"}
            </button>
            <button
              type="button"
              className="btn secondary today-date-today"
              disabled={selectedDate === todayDate}
              onClick={() => void runWithContextGuard(() => setSelectedDate(todayDate))}
            >
              Hoy
            </button>
          </div>
        </div>
      </header>

      <div className="today-layout">
        <aside className="courses-list-panel today-slot-rail" aria-label="Clases del día">
          <div className="courses-list-header">
            <strong>Clases del día</strong>
            <span className="inline-form tight">
              <span className="pill">{todaySlots.length}</span>
              <button
                type="button"
                className="btn secondary compact-link"
                disabled={classGroups.length === 0 || subjectCourseLinks.length === 0}
                onClick={() => void runWithContextGuard(openAdHocSessionModal)}
              >
                Añadir puntual
              </button>
            </span>
          </div>
          {todaySlots.length > 0 ? (
            <div className="courses-list section-tabs today-slot-list" role="group" aria-label="Clases del día">
              {todaySlots.map((slot) => (
                <button
                  key={slot.key}
                  type="button"
                  className={`section-tab ${slot.key === selectedSlotKey ? "active" : ""}`}
                  aria-pressed={slot.key === selectedSlotKey}
                  onClick={() => void runWithContextGuard(() => setSelectedSlotKey(slot.key))}
                >
                  <span>{slot.subjectName}</span>
                  <small>{slot.className}</small>
                  <small>{slot.startTime} - {slot.endTime}</small>
                  {slot.kind !== "recurring" ? (
                    <small>{slot.kind === "adHoc" ? "Sesión puntual" : "Reprogramada"}</small>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="hint">No hay clases programadas para este día.</p>
          )}
        </aside>

        <div className="today-main">
          {selectedSlot ? (
            <>
              <section className="today-session-card" aria-label="Resumen de la clase seleccionada">
                <div>
                  <span className="eyebrow">{selectedSlot.startTime} - {selectedSlot.endTime}</span>
                  <h2>{selectedSlot.className} · {selectedSlot.subjectName}</h2>
                  <p>{selectedTask?.title ?? selectedSlot.title ?? "Sin sesión planificada"}</p>
                </div>
                <div className="today-session-actions">
                  <NavLink className="btn secondary" to={attendanceHistoryLink}>Ver asistencia</NavLink>
                  {selectedTask && selectedSession ? (
                    <NavLink className="btn secondary" to={evaluationLink}>Evaluar tarea</NavLink>
                  ) : null}
                  <NavLink className="btn secondary" to={plannerLink}>Abrir Planificador</NavLink>
                  {selectedSlot.kind === "recurring" ? (
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => void runWithContextGuard(openRescheduleSessionModal)}
                    >
                      Reprogramar este día
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="today-grid">
                <div className="today-panel work-panel">
                  <div className="today-panel-heading">
                    <div>
                      <h2>Plan y registro</h2>
                      <p>{selectedTask ? "Plan previsto y registro real de la sesión" : "Sin tarea planificada"}</p>
                    </div>
                    {selectedTask && selectedSession ? (
                      <NavLink className="btn secondary compact-link" to={plannerLink}>Editar plan</NavLink>
                    ) : null}
                  </div>

                  <div className="today-plan-register">
                    <div className="today-plan-overview">
                      <div className="today-plan-title">
                        {selectedTask && selectedSession ? (
                          <span className={`today-plan-status ${sessionStatus}`}>{SESSION_STATUS_LABELS[sessionStatus]}</span>
                        ) : (
                          <span className="today-plan-status free">Registro libre</span>
                        )}
                        <strong>{selectedTask?.title ?? "Clase sin planificación previa"}</strong>
                      </div>
                      <div className="today-plan-metrics" aria-label="Resumen del plan y registro">
                        <span>{planDetails.length} detalles de plan</span>
                        <span>{generalRecordLength > 0 ? "Registro iniciado" : "Registro vacío"}</span>
                        <span>{studentWorkCommentCount}/{students.length} con comentario</span>
                      </div>
                    </div>

                    <div className="today-plan-detail-grid" aria-label="Detalle planificado">
                      {planDetails.length > 0 ? (
                        planDetails.map((detail) => (
                          <div key={detail.label} className="today-plan-detail">
                            <span>{detail.label}</span>
                            <p>{detail.value}</p>
                          </div>
                        ))
                      ) : (
                        <div className="today-plan-detail muted">
                          <span>{selectedSession ? "Plan" : "Sin plan previo"}</span>
                          <p>{selectedSession
                            ? "La sesión está asignada, pero aún no tiene objetivos, materiales, deberes ni notas."
                            : "Puedes registrar lo realizado ahora y planificar otras sesiones cuando lo necesites."}</p>
                        </div>
                      )}
                    </div>

                    <label className="today-record-field">
                      <span>
                        Registro real
                        {hasWorkChanges ? <em>Sin guardar</em> : <em>Al día</em>}
                      </span>
                      <textarea
                        className="input textarea"
                        aria-label="Registro real de la sesión"
                        value={generalCommentDraft}
                        onChange={(event) => setGeneralCommentDraft(event.target.value)}
                        placeholder="Qué se ha hecho realmente, ajustes, deberes o incidencias generales."
                      />
                      <small>{generalRecordLength} caracteres · se guarda con la clase</small>
                    </label>
                    {!selectedSession ? (
                      <div className="today-free-record-actions">
                        <span>Este registro no necesita una tarea del Planificador.</span>
                        <NavLink className="btn secondary compact-link" to={plannerLink}>Planificar esta clase</NavLink>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="today-panel students-panel">
                  <div className="today-panel-heading">
                    <div>
                      <h2>Alumnos en clase</h2>
                      <p>{students.length} alumnos · asistencia y trabajo</p>
                    </div>
                    <div className="today-attendance-summary" aria-label="Resumen de asistencia">
                      <span>{attendanceSummary.present} presentes</span>
                      <span>{attendanceSummary.late} retrasos</span>
                      <span>{attendanceSummary.absent} ausentes</span>
                    </div>
                  </div>
                  <div className="today-status-legend" aria-label="Leyenda de asistencia">
                    <span><strong>P</strong> Presente</span>
                    <span><strong>R</strong> Retraso</span>
                    <span><strong>A</strong> Ausente</span>
                  </div>

                  <div className="today-student-list">
                    {students.length > 0 ? (
                      <div className="today-student-row today-student-row-header with-work" aria-hidden="true">
                        <span>Alumno</span>
                        <span>Asistencia</span>
                        <span>Observación</span>
                        <span>Trabajo</span>
                      </div>
                    ) : null}
                    {students.map((student) => {
                      const currentStatus = statusDraft.get(student.id) ?? baseStatusByStudent.get(student.id) ?? "present";
                      const currentNote = noteDraft.get(student.id) ?? attendanceByStudent.get(student.id)?.note ?? "";
                      const currentWorkComment = studentCommentDraft.get(student.id) ?? "";
                      const currentEntry = attendanceByStudent.get(student.id);
                      const currentDetails = attendanceDetailsDraft.get(student.id) ?? {
                        absenceJustified: Boolean(currentEntry?.absenceJustified),
                        lateMinutes: currentEntry?.lateMinutes ? String(currentEntry.lateMinutes) : "",
                        earlyDepartureMinutes: currentEntry?.earlyDepartureMinutes
                          ? String(currentEntry.earlyDepartureMinutes)
                          : ""
                      };
                      const hasAttendanceDetail =
                        (currentStatus === "absent" && currentDetails.absenceJustified) ||
                        (currentStatus === "late" && Boolean(currentDetails.lateMinutes)) ||
                        Boolean(currentDetails.earlyDepartureMinutes);
                      return (
                        <div key={student.id} className="today-student-row with-work">
                          <strong>{formatName(student)}</strong>
                          <div className="today-status-control" aria-label={`Asistencia de ${formatName(student)}`}>
                            {(Object.keys(STATUS_LABELS) as AttendanceEntry["status"][]).map((status) => (
                              <button
                                key={status}
                                type="button"
                                className={`today-status-option ${status} ${currentStatus === status ? "active" : ""}`}
                                aria-label={`${STATUS_LABELS[status]} para ${formatName(student)}`}
                                aria-pressed={currentStatus === status}
                                onClick={() => setStudentStatus(student.id, status)}
                              >
                                <span aria-hidden="true">{STATUS_SHORT_LABELS[status]}</span>
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            className={`today-note-button ${currentNote.trim() || hasAttendanceDetail ? "filled" : ""}`}
                            aria-label={`Editar observación de asistencia de ${formatName(student)}`}
                            onClick={() => setEditingNoteStudentId(student.id)}
                          >
                            <span>
                              {currentStatus === "absent" && currentDetails.absenceJustified
                                ? "Justificada"
                                : currentStatus === "late" && currentDetails.lateMinutes
                                  ? `${currentDetails.lateMinutes} min`
                                  : currentDetails.earlyDepartureMinutes
                                    ? `Sale ${currentDetails.earlyDepartureMinutes} min`
                                    : currentNote.trim()
                                      ? "Con obs."
                                      : "Obs."}
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`today-note-button work ${currentWorkComment.trim() ? "filled" : ""}`}
                            aria-label={`Editar comentario de trabajo de ${formatName(student)}`}
                            onClick={() => setEditingWorkStudentId(student.id)}
                          >
                            <span>{currentWorkComment.trim() ? "Con trabajo" : "Trabajo"}</span>
                          </button>
                        </div>
                      );
                    })}
                    {students.length === 0 ? <p className="empty-state">No hay alumnos vinculados a esta asignatura.</p> : null}
                  </div>

                  <div className="today-panel-actions">
                    <button
                      className="btn primary today-close-session"
                      type="button"
                      disabled={students.length === 0 || isClassSessionSaved || isSavingAttendance || isSavingWork}
                      onClick={() => void saveClassSession()}
                    >
                      {isSavingAttendance || isSavingWork
                        ? "Guardando clase..."
                        : isClassSessionSaved
                          ? "Clase guardada"
                          : attendanceEntries.length === 0
                            ? "Confirmar y cerrar clase"
                            : "Guardar cambios de la clase"}
                    </button>
                    <span className="today-save-scope">Incluye asistencia, observaciones y trabajo.</span>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <p className="empty-state">Selecciona una fecha con clases para empezar.</p>
          )}
        </div>
      </div>

      <div className="today-status-line" role="status" aria-live="polite">
        {notice}
      </div>

      <Modal
        open={Boolean(exceptionalSessionMode)}
        title={
          exceptionalSessionMode === "rescheduled"
            ? "Reprogramar solo esta clase"
            : "Añadir sesión puntual"
        }
        subtitle={
          exceptionalSessionMode === "rescheduled"
            ? "La fecha semanal seguirá intacta para el resto del curso."
            : "Útil para sustituciones, apoyos o clases no previstas."
        }
        onClose={() => setExceptionalSessionMode(null)}
      >
        <div className="detail-grid">
          <label className="detail-field">
            <span>Grupo</span>
            <select
              className="input"
              disabled={exceptionalSessionMode === "rescheduled"}
              value={exceptionalSessionDraft.classId}
              onChange={(event) => {
                const classId = event.target.value;
                const subjectId =
                  subjectCourseLinks.find((link) => link.classId === classId)?.subjectId ?? "";
                setExceptionalSessionDraft((current) => ({
                  ...current,
                  classId,
                  subjectId
                }));
              }}
            >
              <option value="">Selecciona un grupo</option>
              {classGroups.map((classGroup) => (
                <option key={classGroup.id} value={classGroup.id}>
                  {classGroup.name}
                </option>
              ))}
            </select>
          </label>
          <label className="detail-field">
            <span>Asignatura</span>
            <select
              className="input"
              disabled={exceptionalSessionMode === "rescheduled"}
              value={exceptionalSessionDraft.subjectId}
              onChange={(event) =>
                setExceptionalSessionDraft((current) => ({
                  ...current,
                  subjectId: event.target.value
                }))
              }
            >
              <option value="">Selecciona una asignatura</option>
              {exceptionalSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className="detail-field">
            <span>Fecha</span>
            <input
              className="input"
              type="date"
              value={exceptionalSessionDraft.date}
              onChange={(event) =>
                setExceptionalSessionDraft((current) => ({
                  ...current,
                  date: event.target.value
                }))
              }
            />
          </label>
          <label className="detail-field">
            <span>Descripción</span>
            <input
              className="input"
              value={exceptionalSessionDraft.title}
              placeholder="Ej. Sustitución de Ciencias"
              onChange={(event) =>
                setExceptionalSessionDraft((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
            />
          </label>
          <label className="detail-field">
            <span>Inicio</span>
            <input
              className="input"
              type="time"
              value={exceptionalSessionDraft.startTime}
              onChange={(event) =>
                setExceptionalSessionDraft((current) => ({
                  ...current,
                  startTime: event.target.value
                }))
              }
            />
          </label>
          <label className="detail-field">
            <span>Fin</span>
            <input
              className="input"
              type="time"
              min={exceptionalSessionDraft.startTime}
              value={exceptionalSessionDraft.endTime}
              onChange={(event) =>
                setExceptionalSessionDraft((current) => ({
                  ...current,
                  endTime: event.target.value
                }))
              }
            />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={() => setExceptionalSessionMode(null)}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={
              !exceptionalSessionDraft.classId ||
              !exceptionalSessionDraft.subjectId ||
              !exceptionalSessionDraft.date ||
              exceptionalSessionDraft.endTime <= exceptionalSessionDraft.startTime
            }
            onClick={() => void createExceptionalSession()}
          >
            {exceptionalSessionMode === "rescheduled"
              ? "Confirmar reprogramación"
              : "Crear sesión"}
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(editingNoteStudent)}
        title={editingNoteStudent ? `Observación · ${formatName(editingNoteStudent)}` : "Observación"}
        subtitle={selectedSessionLabel}
        onClose={() => setEditingNoteStudentId("")}
      >
        {editingNoteStudent ? (
          <div className="today-note-modal">
            <div className="today-note-modal-summary">
              <span className="today-note-kind attendance">Asistencia</span>
              <span>{editingNoteValue.trim() ? "Con observación" : "Sin observación"}</span>
            </div>
            {editingAttendanceStatus === "absent" ? (
              <label className="chip-toggle">
                <input
                  type="checkbox"
                  checked={editingAttendanceDetails.absenceJustified}
                  onChange={(event) =>
                    setStudentAttendanceDetails(editingNoteStudent.id, {
                      absenceJustified: event.target.checked
                    })
                  }
                />
                <span>Ausencia justificada</span>
              </label>
            ) : null}
            {editingAttendanceStatus === "late" ? (
              <label className="field">
                <span>Minutos de retraso</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={720}
                  inputMode="numeric"
                  value={editingAttendanceDetails.lateMinutes}
                  onChange={(event) =>
                    setStudentAttendanceDetails(editingNoteStudent.id, {
                      lateMinutes: event.target.value
                    })
                  }
                />
              </label>
            ) : null}
            {editingAttendanceStatus !== "absent" ? (
              <label className="field">
                <span>Salida anticipada (minutos)</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={720}
                  inputMode="numeric"
                  placeholder="Dejar vacío si no salió antes"
                  value={editingAttendanceDetails.earlyDepartureMinutes}
                  onChange={(event) =>
                    setStudentAttendanceDetails(editingNoteStudent.id, {
                      earlyDepartureMinutes: event.target.value
                    })
                  }
                />
              </label>
            ) : null}
            <label className="field">
              <span>Observación de asistencia</span>
              <textarea
                className="input textarea"
                value={editingNoteValue}
                onChange={(event) => setStudentNote(editingNoteStudent.id, event.target.value)}
                placeholder="Retraso justificado, sale antes, comentario breve..."
              />
            </label>
            <div className="today-note-modal-meta">
              <span>{editingNoteValue.trim().length} caracteres</span>
              <span>Quedará pendiente hasta guardar la clase.</span>
            </div>
            <div className="today-modal-actions">
              <button type="button" className="btn secondary" onClick={() => setStudentNote(editingNoteStudent.id, "")}>
                Limpiar
              </button>
              <button type="button" className="btn primary" onClick={() => setEditingNoteStudentId("")}>
                Aplicar al borrador
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(editingWorkStudent)}
        title={editingWorkStudent ? `Trabajo · ${formatName(editingWorkStudent)}` : "Trabajo"}
        subtitle={selectedTask ? `${selectedSessionLabel} · ${selectedTask.title}` : selectedSessionLabel}
        onClose={() => setEditingWorkStudentId("")}
      >
        {editingWorkStudent ? (
          <div className="today-note-modal">
            <div className="today-note-modal-summary">
              <span className="today-note-kind work">Trabajo</span>
              <span>{editingWorkValue.trim() ? "Con comentario" : "Sin comentario"}</span>
            </div>
            <label className="field">
              <span>Comentario de trabajo en clase</span>
              <textarea
                className="input textarea"
                value={editingWorkValue}
                onChange={(event) => setStudentWorkComment(editingWorkStudent.id, event.target.value)}
                placeholder="No termina, participa bien, necesita apoyo, entrega pendiente..."
              />
            </label>
            <div className="today-note-modal-meta">
              <span>{editingWorkValue.trim().length} caracteres</span>
              <span>Quedará pendiente hasta guardar la clase.</span>
            </div>
            <div className="today-modal-actions">
              <button type="button" className="btn secondary" onClick={() => setStudentWorkComment(editingWorkStudent.id, "")}>
                Limpiar
              </button>
              <button type="button" className="btn primary" onClick={() => setEditingWorkStudentId("")}>
                Aplicar al borrador
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
