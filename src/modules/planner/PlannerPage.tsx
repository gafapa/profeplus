import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setSelectedClass, setSelectedSubject } from "../../app/store";
import { db } from "../../shared/db/database";
import type {
  ClassGroup,
  ScheduleBlock,
  ScheduleDay,
  Subject,
  SubjectCourseLink,
  Task,
  TaskSession,
  TaskSubjectLink,
  UnitBlock
} from "../../shared/db/types";
import { ContextSidebarTabs } from "../../shared/ui/ContextSidebarTabs";
import { Modal } from "../../shared/ui/Modal";
import { useUnsavedChangesDialog } from "../../shared/ui/UnsavedChangesDialog";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";
import {
  SESSION_STATUSES,
  normalizeSessionPlanDraft,
  sessionPlanDraftFromSession,
  sessionStatusLabel,
  type SessionPlanDraft
} from "../../shared/planner/sessionPlan";
import { addDays, buildVisiblePlannerWeekDates, formatWeekRange, isoDayOfWeek, startOfWeek, toIsoDate } from "../../shared/planner/week";
import { buildPrintablePlannerReport, type PrintablePlannerSession } from "../../shared/planner/printablePlanner";
import { canQuickAssignTask, completesTaskWithNextSession, countsAsPlannedSession } from "../../shared/planner/quickAssignment";
import { availableRescheduleBlocks } from "../../shared/planner/reschedule";
import { buildPrintableReportHtml } from "../../shared/reports/printableReports";

type PlannerCell = {
  key: string;
  date: string;
  dayName: string;
  block: ScheduleBlock;
  subject: Subject;
  classGroup: ClassGroup;
  session?: TaskSession;
};

type SessionDataCounts = {
  comments: number;
  dailySettings: number;
  rubricAssessments: number;
  checklistAssessments: number;
};

type PlannerUndoAction = {
  kind: "create" | "remove" | "move";
  session: TaskSession;
};

function cellKey(classId: string, subjectId: string, date: string, slotId: string): string {
  return `${classId}:${subjectId}:${date}:${slotId}`;
}

function classSlotKey(classId: string, date: string, slotId: string): string {
  return `${classId}:${date}:${slotId}`;
}

function taskSubjectKey(taskId: string, subjectId: string): string {
  return `${taskId}:${subjectId}`;
}

function formatBlockTime(block: ScheduleBlock): string {
  return `${block.startTime} - ${block.endTime}`;
}

function downloadHtml(filename: string, html: string): void {
  const blob = new Blob(["\uFEFF" + html], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sessionDataTotal(counts: SessionDataCounts): number {
  return counts.comments + counts.dailySettings + counts.rubricAssessments + counts.checklistAssessments;
}

export function PlannerPage() {
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const unsavedChangesDialog = useUnsavedChangesDialog();
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const selectedSubjectId = useAppSelector((state) => state.app.selectedSubjectId);
  const weekStartsOn = useAppSelector((state) => state.app.weekStartsOn);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectCourseLinks, setSubjectCourseLinks] = useState<SubjectCourseLink[]>([]);
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskSubjectLinks, setTaskSubjectLinks] = useState<TaskSubjectLink[]>([]);
  const [taskSessions, setTaskSessions] = useState<TaskSession[]>([]);
  const [units, setUnits] = useState<UnitBlock[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), weekStartsOn));
  const [selectedCell, setSelectedCell] = useState<PlannerCell | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [sessionPlanDraft, setSessionPlanDraft] = useState<SessionPlanDraft>(() => sessionPlanDraftFromSession());
  const [draggedSessionId, setDraggedSessionId] = useState("");
  const [quickTaskKey, setQuickTaskKey] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [undoAction, setUndoAction] = useState<PlannerUndoAction | null>(null);
  const [sessionPendingRemoval, setSessionPendingRemoval] = useState<TaskSession | null>(null);
  const [sessionPendingReschedule, setSessionPendingReschedule] = useState<TaskSession | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlotId, setRescheduleSlotId] = useState("");
  const contextLinkAppliedRef = useRef(false);
  const contextParametersAppliedRef = useRef(false);

  useEffect(() => {
    if (contextParametersAppliedRef.current) return;
    const requestedClassId = searchParams.get("classId") ?? "";
    const requestedSubjectId = searchParams.get("subjectId") ?? "";
    const requestedDate = searchParams.get("date") ?? "";
    if (requestedClassId) dispatch(setSelectedClass(requestedClassId));
    if (requestedSubjectId) dispatch(setSelectedSubject(requestedSubjectId));
    if (/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      setWeekStart(startOfWeek(new Date(`${requestedDate}T12:00:00`), weekStartsOn));
    }
    contextParametersAppliedRef.current = true;
  }, [dispatch, searchParams, weekStartsOn]);

  const loadPlannerData = async (): Promise<void> => {
    const [
      classGroupsData,
      subjectsData,
      subjectCourseLinksData,
      scheduleDaysData,
      tasksData,
      taskSubjectLinksData,
      taskSessionsData,
      unitsData
    ] = await Promise.all([
      db.classGroups.orderBy("name").toArray(),
      db.subjects.orderBy("name").toArray(),
      db.subjectCourseLinks.toArray(),
      db.scheduleDays.orderBy("dayOfWeek").toArray(),
      db.tasks.toArray(),
      db.taskSubjectLinks.toArray(),
      selectedClassId ? db.taskSessions.where("classId").equals(selectedClassId).toArray() : Promise.resolve([]),
      db.unitBlocks.orderBy("[subjectId+position]").toArray()
    ]);

    setClassGroups(classGroupsData);
    setSubjects(subjectsData);
    setSubjectCourseLinks(subjectCourseLinksData);
    setScheduleDays(scheduleDaysData);
    setTasks(tasksData.sort((a, b) => a.title.localeCompare(b.title)));
    setTaskSubjectLinks(taskSubjectLinksData);
    setTaskSessions(taskSessionsData);
    setUnits(unitsData);
  };
  const loadPlannerDataForEffect = useEffectEvent(loadPlannerData);

  useEffect(() => {
    let active = true;
    const run = async (): Promise<void> => {
      setIsBusy(true);
      try {
        await loadPlannerDataForEffect();
      } finally {
        if (active) setIsBusy(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [selectedClassId]);

  useEffect(() => {
    setWeekStart((current) => startOfWeek(current, weekStartsOn));
  }, [weekStartsOn]);

  const weekDates = useMemo(() => buildVisiblePlannerWeekDates(weekStart, scheduleDays), [scheduleDays, weekStart]);

  const selectedClass = useMemo(
    () => classGroups.find((classGroup) => classGroup.id === selectedClassId) ?? null,
    [classGroups, selectedClassId]
  );

  const subjectsForClass = useMemo(() => {
    if (!selectedClassId) return [];
    const linkedSubjectIds = new Set(
      subjectCourseLinks.filter((link) => link.classId === selectedClassId).map((link) => link.subjectId)
    );
    return subjects.filter((subject) => linkedSubjectIds.has(subject.id));
  }, [selectedClassId, subjectCourseLinks, subjects]);

  const visibleSubjects = useMemo(() => {
    if (!selectedSubjectId) return subjectsForClass;
    return subjectsForClass.filter((subject) => subject.id === selectedSubjectId);
  }, [selectedSubjectId, subjectsForClass]);

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const rescheduleBlocks = useMemo(
    () =>
      availableRescheduleBlocks(
        rescheduleDate,
        sessionPendingReschedule ? subjectById.get(sessionPendingReschedule.subjectId) : undefined,
        scheduleDays
      ),
    [rescheduleDate, scheduleDays, sessionPendingReschedule, subjectById]
  );

  useEffect(() => {
    if (!sessionPendingReschedule) return;
    if (rescheduleBlocks.some((block) => block.id === rescheduleSlotId)) return;
    setRescheduleSlotId(rescheduleBlocks[0]?.id ?? "");
  }, [rescheduleBlocks, rescheduleSlotId, sessionPendingReschedule]);

  const scheduleBlockById = useMemo(() => {
    const map = new Map<string, ScheduleBlock>();
    for (const day of scheduleDays) {
      for (const block of day.blocks) {
        map.set(block.id, block);
      }
    }
    return map;
  }, [scheduleDays]);

  const scheduleDayBySlotId = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of scheduleDays) {
      if (!day.enabled) continue;
      for (const block of day.blocks) {
        if (!block.isBreak) map.set(block.id, day.dayOfWeek);
      }
    }
    return map;
  }, [scheduleDays]);

  const unitNameByTaskSubject = useMemo(() => {
    const map = new Map<string, string>();
    for (const link of taskSubjectLinks) {
      const unit = link.unitId ? unitById.get(link.unitId) : null;
      if (unit) {
        map.set(taskSubjectKey(link.taskId, link.subjectId), unit.name);
      }
    }
    return map;
  }, [taskSubjectLinks, unitById]);

  const taskLinksBySubject = useMemo(() => {
    const map = new Map<string, TaskSubjectLink[]>();
    for (const link of taskSubjectLinks) {
      const rows = map.get(link.subjectId) ?? [];
      rows.push(link);
      map.set(link.subjectId, rows);
    }
    return map;
  }, [taskSubjectLinks]);

  const taskSessionCountByTaskSubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of taskSessions) {
      const subject = subjectById.get(session.subjectId);
      if (
        !countsAsPlannedSession(
          session.status,
          isoDayOfWeek(session.date),
          scheduleDayBySlotId.get(session.scheduleSlotId),
          Boolean(subject?.scheduleSlotIds?.includes(session.scheduleSlotId))
        )
      ) {
        continue;
      }
      const key = taskSubjectKey(session.taskId, session.subjectId);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [scheduleDayBySlotId, subjectById, taskSessions]);

  const sessionsByCellKey = useMemo(() => {
    const map = new Map<string, TaskSession>();
    for (const session of taskSessions) {
      map.set(cellKey(session.classId, session.subjectId, session.date, session.scheduleSlotId), session);
    }
    return map;
  }, [taskSessions]);

  const sessionsByClassSlotKey = useMemo(() => {
    const map = new Map<string, TaskSession>();
    for (const session of taskSessions) {
      map.set(classSlotKey(session.classId, session.date, session.scheduleSlotId), session);
    }
    return map;
  }, [taskSessions]);

  const draggedSession = useMemo(
    () => taskSessions.find((session) => session.id === draggedSessionId) ?? null,
    [draggedSessionId, taskSessions]
  );

  const plannerCellsByDate = useMemo(() => {
    const map = new Map<string, PlannerCell[]>();
    if (!selectedClass) return map;

    for (const day of weekDates) {
      const scheduleDay = scheduleDays.find((item) => item.enabled && item.dayOfWeek === day.dayOfWeek);
      if (!scheduleDay) {
        map.set(day.iso, []);
        continue;
      }

      const cells: PlannerCell[] = [];
      for (const block of scheduleDay.blocks) {
        if (block.isBreak) continue;
        for (const subject of visibleSubjects) {
          if (!(subject.scheduleSlotIds ?? []).includes(block.id)) continue;
          const key = cellKey(selectedClass.id, subject.id, day.iso, block.id);
          cells.push({
            key,
            date: day.iso,
            dayName: scheduleDay.dayName,
            block,
            subject,
            classGroup: selectedClass,
            session: sessionsByCellKey.get(key)
          });
        }
      }

      cells.sort(
        (a, b) =>
          a.block.startTime.localeCompare(b.block.startTime) ||
          a.subject.name.localeCompare(b.subject.name)
      );
      map.set(day.iso, cells);
    }

    return map;
  }, [scheduleDays, selectedClass, sessionsByCellKey, visibleSubjects, weekDates]);

  useEffect(() => {
    if (contextLinkAppliedRef.current) return;
    const requestedDate = searchParams.get("date") ?? "";
    const requestedClassId = searchParams.get("classId") ?? "";
    const requestedSubjectId = searchParams.get("subjectId") ?? "";
    const requestedSlotId = searchParams.get("slotId") ?? "";
    if (!requestedDate || !requestedClassId || !requestedSubjectId || !requestedSlotId) {
      contextLinkAppliedRef.current = true;
      return;
    }
    if (selectedClassId !== requestedClassId || selectedSubjectId !== requestedSubjectId) return;
    const requestedCell = (plannerCellsByDate.get(requestedDate) ?? []).find(
      (cell) => cell.subject.id === requestedSubjectId && cell.block.id === requestedSlotId
    );
    if (!requestedCell) return;
    setSelectedCell(requestedCell);
    contextLinkAppliedRef.current = true;
  }, [plannerCellsByDate, searchParams, selectedClassId, selectedSubjectId]);

  const weekSessions = useMemo(
    () =>
      taskSessions.filter((session) => {
        if (!selectedClassId || session.classId !== selectedClassId) return false;
        if (selectedSubjectId && session.subjectId !== selectedSubjectId) return false;
        return weekDates.some((day) => day.iso === session.date);
      }),
    [selectedClassId, selectedSubjectId, taskSessions, weekDates]
  );

  const printablePlannerSessions = useMemo<PrintablePlannerSession[]>(
    () =>
      weekSessions.flatMap((session) => {
        const task = taskById.get(session.taskId);
        const subject = subjectById.get(session.subjectId);
        const block = scheduleBlockById.get(session.scheduleSlotId);
        const day = weekDates.find((item) => item.iso === session.date);
        if (!task || !subject || !block || !day || !selectedClass) {
          return [];
        }
        return [
          {
            date: session.date,
            dayName: day.label,
            time: formatBlockTime(block),
            className: selectedClass.name,
            subjectName: subject.name,
            taskTitle: task.title || "Tarea sin título",
            unitName: unitNameByTaskSubject.get(taskSubjectKey(session.taskId, session.subjectId)),
            statusLabel: sessionStatusLabel(session.status),
            objectives: session.objectives,
            competencies: session.competencies,
            materials: session.materials,
            homework: session.homework,
            teacherNotes: session.teacherNotes
          }
        ];
      }),
    [scheduleBlockById, selectedClass, subjectById, taskById, unitNameByTaskSubject, weekDates, weekSessions]
  );

  const unplannedTasks = useMemo(() => {
    const rows: Array<{ task: Task; subject: Subject; unitName: string; planned: number; expected: number }> = [];
    for (const subject of visibleSubjects) {
      for (const link of taskLinksBySubject.get(subject.id) ?? []) {
        const task = taskById.get(link.taskId);
        if (!task) continue;
        const planned = taskSessionCountByTaskSubject.get(taskSubjectKey(task.id, subject.id)) ?? 0;
        const expected = Math.max(1, Math.round(task.sessionCount ?? 1));
        if (planned >= expected) continue;
        rows.push({
          task,
          subject,
          unitName: link.unitId ? unitById.get(link.unitId)?.name ?? "Unidad sin nombre" : "Sin unidad",
          planned,
          expected
        });
      }
    }
    return rows.sort((a, b) => a.subject.name.localeCompare(b.subject.name) || a.task.title.localeCompare(b.task.title));
  }, [taskById, taskLinksBySubject, taskSessionCountByTaskSubject, unitById, visibleSubjects]);

  const pendingSessionCount = useMemo(
    () => unplannedTasks.reduce((total, item) => total + Math.max(0, item.expected - item.planned), 0),
    [unplannedTasks]
  );

  const selectedQuickTask = useMemo(
    () =>
      unplannedTasks.find((item) => taskSubjectKey(item.task.id, item.subject.id) === quickTaskKey) ?? null,
    [quickTaskKey, unplannedTasks]
  );

  useEffect(() => {
    if (quickTaskKey && !selectedQuickTask && !isBusy) {
      setQuickTaskKey("");
    }
  }, [isBusy, quickTaskKey, selectedQuickTask]);

  const selectableTasksForCell = useMemo(() => {
    if (!selectedCell) return [];
    return (taskLinksBySubject.get(selectedCell.subject.id) ?? [])
      .map((link) => {
        const task = taskById.get(link.taskId);
        if (!task) return null;
        const planned = taskSessionCountByTaskSubject.get(taskSubjectKey(task.id, selectedCell.subject.id)) ?? 0;
        const expected = Math.max(1, Math.round(task.sessionCount ?? 1));
        return {
          task,
          unitName: link.unitId ? unitById.get(link.unitId)?.name ?? "Unidad sin nombre" : "Sin unidad",
          planned,
          expected
        };
      })
      .filter((row): row is { task: Task; unitName: string; planned: number; expected: number } => Boolean(row))
      .sort((a, b) => a.unitName.localeCompare(b.unitName) || a.task.title.localeCompare(b.task.title));
  }, [selectedCell, taskById, taskLinksBySubject, taskSessionCountByTaskSubject, unitById]);

  useEffect(() => {
    if (!selectedCell) {
      setSelectedTaskId("");
      return;
    }
    if (selectedCell.session) {
      setSelectedTaskId(selectedCell.session.taskId);
      setSessionPlanDraft(sessionPlanDraftFromSession(selectedCell.session));
      return;
    }
    setSelectedTaskId(selectableTasksForCell[0]?.task.id ?? "");
    setSessionPlanDraft(sessionPlanDraftFromSession());
  }, [selectedCell, selectableTasksForCell]);

  const plannerDraftDirty = useMemo(() => {
    if (!selectedCell) return false;
    const originalTaskId = selectedCell.session?.taskId ?? selectableTasksForCell[0]?.task.id ?? "";
    const originalDraft = sessionPlanDraftFromSession(selectedCell.session);
    return selectedTaskId !== originalTaskId || JSON.stringify(sessionPlanDraft) !== JSON.stringify(originalDraft);
  }, [selectableTasksForCell, selectedCell, selectedTaskId, sessionPlanDraft]);
  useUnsavedChangesGuard(plannerDraftDirty, "Hay cambios sin guardar en la sesión del Planificador.");

  const closePlannerModal = async (): Promise<void> => {
    if (!plannerDraftDirty) {
      setSelectedCell(null);
      return;
    }
    const shouldDiscard = unsavedChangesDialog
      ? await unsavedChangesDialog.confirmLeave("Hay cambios sin guardar en esta sesión. ¿Quieres descartarlos?")
      : window.confirm("Hay cambios sin guardar en esta sesión. ¿Quieres descartarlos?");
    if (shouldDiscard) setSelectedCell(null);
  };

  const countSessionData = async (session: TaskSession): Promise<SessionDataCounts> => {
    const [comments, dailySettings, rubricAssessments, checklistAssessments] = await Promise.all([
      db.taskStudentComments
        .where("[taskId+classId+subjectId+date+scheduleSlotId]")
        .equals([session.taskId, session.classId, session.subjectId, session.date, session.scheduleSlotId])
        .count(),
      db.taskDailyEvaluationSettings
        .where("[taskId+classId+subjectId+date+scheduleSlotId]")
        .equals([session.taskId, session.classId, session.subjectId, session.date, session.scheduleSlotId])
        .count(),
      db.taskRubricAssessments
        .where("[taskId+classId+subjectId+date+scheduleSlotId]")
        .equals([session.taskId, session.classId, session.subjectId, session.date, session.scheduleSlotId])
        .count(),
      db.taskChecklistAssessments
        .where("[taskId+classId+subjectId+date+scheduleSlotId]")
        .equals([session.taskId, session.classId, session.subjectId, session.date, session.scheduleSlotId])
        .count()
    ]);
    return { comments, dailySettings, rubricAssessments, checklistAssessments };
  };

  const refreshAfterAction = async (message: string): Promise<void> => {
    await loadPlannerData();
    setNotice(message);
  };

  const assignTaskToCell = async (): Promise<void> => {
    if (!selectedCell || !selectedTaskId) return;
    const task = taskById.get(selectedTaskId);
    if (!task) return;

    setIsBusy(true);
    try {
      const planFields = normalizeSessionPlanDraft(sessionPlanDraft);
      const occupiedClassSlot = sessionsByClassSlotKey.get(
        classSlotKey(selectedCell.classGroup.id, selectedCell.date, selectedCell.block.id)
      );
      if (occupiedClassSlot && occupiedClassSlot.id !== selectedCell.session?.id) {
        setNotice("Ese bloque ya tiene una tarea programada para el curso.");
        return;
      }

      if (selectedCell.session && selectedCell.session.taskId !== selectedTaskId) {
        const counts = await countSessionData(selectedCell.session);
        if (sessionDataTotal(counts) > 0) {
          setNotice("No se puede cambiar una sesión que ya tiene comentarios o evaluación.");
          return;
        }
        await db.taskSessions.delete(selectedCell.session.id);
      }

      if (!selectedCell.session || selectedCell.session.taskId !== selectedTaskId) {
        await db.taskSessions.add({
          id: crypto.randomUUID(),
          taskId: selectedTaskId,
          subjectId: selectedCell.subject.id,
          classId: selectedCell.classGroup.id,
          date: selectedCell.date,
          scheduleSlotId: selectedCell.block.id,
          ...planFields
        });
      } else {
        await db.taskSessions.put({
          ...selectedCell.session,
          ...planFields
        });
      }

      setSelectedCell(null);
      await refreshAfterAction("Sesión guardada.");
    } finally {
      setIsBusy(false);
    }
  };

  const assignQuickTaskToCell = async (cell: PlannerCell): Promise<void> => {
    if (!selectedQuickTask || selectedQuickTask.subject.id !== cell.subject.id || cell.session) return;
    const occupiedClassSlot = sessionsByClassSlotKey.get(
      classSlotKey(cell.classGroup.id, cell.date, cell.block.id)
    );
    if (occupiedClassSlot) {
      setNotice("Ese bloque ya tiene una tarea programada para el curso.");
      return;
    }

    setIsBusy(true);
    try {
      const createdSession: TaskSession = {
        id: crypto.randomUUID(),
        taskId: selectedQuickTask.task.id,
        subjectId: cell.subject.id,
        classId: cell.classGroup.id,
        date: cell.date,
        scheduleSlotId: cell.block.id,
        status: "planned"
      };
      await db.taskSessions.add(createdSession);
      setUndoAction({ kind: "create", session: createdSession });
      const completesTask = completesTaskWithNextSession(selectedQuickTask.planned, selectedQuickTask.expected);
      if (completesTask) setQuickTaskKey("");
      await refreshAfterAction(`Sesión asignada al ${cell.date}.`);
    } finally {
      setIsBusy(false);
    }
  };

  const removeSession = async (session: TaskSession): Promise<void> => {
    setIsBusy(true);
    try {
      const counts = await countSessionData(session);
      if (sessionDataTotal(counts) > 0) {
        setNotice("No se puede quitar una sesión que ya tiene comentarios o evaluación.");
        return;
      }
      await db.taskSessions.delete(session.id);
      setUndoAction({ kind: "remove", session });
      setSelectedCell(null);
      setSessionPendingRemoval(null);
      await refreshAfterAction("Sesión eliminada.");
    } finally {
      setIsBusy(false);
    }
  };

  const moveSessionToTarget = async (
    sessionId: string,
    targetDate: string,
    targetSlotId: string
  ): Promise<void> => {
    const session = taskSessions.find((item) => item.id === sessionId);
    if (!session) return;
    const subject = subjectById.get(session.subjectId);
    const validTarget = availableRescheduleBlocks(targetDate, subject, scheduleDays).some(
      (block) => block.id === targetSlotId
    );
    if (!validTarget) {
      setNotice("Selecciona una fecha y una franja activa de la misma asignatura.");
      return;
    }
    const occupiedClassSlot = sessionsByClassSlotKey.get(classSlotKey(session.classId, targetDate, targetSlotId));
    if (occupiedClassSlot && occupiedClassSlot.id !== session.id) {
      setNotice("El bloque destino ya tiene una tarea programada.");
      return;
    }
    if (session.date === targetDate && session.scheduleSlotId === targetSlotId) {
      setSessionPendingReschedule(null);
      setNotice("La sesión ya está en esa fecha y franja.");
      return;
    }

    setIsBusy(true);
    try {
      const counts = await countSessionData(session);
      if (sessionDataTotal(counts) > 0) {
        setNotice("No se puede mover una sesión que ya tiene comentarios o evaluación.");
        return;
      }
      await db.taskSessions.put({
        ...session,
        date: targetDate,
        scheduleSlotId: targetSlotId,
        status: "moved"
      });
      setUndoAction({ kind: "move", session });
      setSelectedCell(null);
      setSessionPendingReschedule(null);
      setWeekStart(startOfWeek(new Date(`${targetDate}T12:00:00`), weekStartsOn));
      await refreshAfterAction("Sesión reprogramada.");
    } finally {
      setDraggedSessionId("");
      setIsBusy(false);
    }
  };

  const moveSessionToCell = async (sessionId: string, target: PlannerCell): Promise<void> => {
    const session = taskSessions.find((item) => item.id === sessionId);
    if (!session) return;
    if (session.subjectId !== target.subject.id) {
      setNotice("Solo se puede mover a otro bloque de la misma asignatura.");
      return;
    }
    await moveSessionToTarget(sessionId, target.date, target.block.id);
  };

  const openRescheduleModal = (session: TaskSession): void => {
    setSessionPendingReschedule(session);
    setRescheduleDate(session.date);
    setRescheduleSlotId(session.scheduleSlotId);
    setSelectedCell(null);
    setNotice("");
  };

  const undoLastPlannerAction = async (): Promise<void> => {
    if (!undoAction) return;
    setIsBusy(true);
    try {
      if (undoAction.kind === "create") {
        await db.taskSessions.delete(undoAction.session.id);
      } else {
        await db.taskSessions.put(undoAction.session);
      }
      setUndoAction(null);
      await refreshAfterAction("Última acción deshecha.");
    } finally {
      setIsBusy(false);
    }
  };

  const openCellModal = (cell: PlannerCell): void => {
    setSelectedCell(cell);
    setNotice("");
  };

  const exportPrintableWeek = (): void => {
    if (!selectedClass) {
      setNotice("Selecciona un curso para exportar el planificador.");
      return;
    }
    const selectedSubject = selectedSubjectId ? subjectById.get(selectedSubjectId) : null;
    const visibleSlotsCount = weekDates.reduce((sum, day) => sum + (plannerCellsByDate.get(day.iso)?.length ?? 0), 0);
    const html = buildPrintableReportHtml(
      buildPrintablePlannerReport({
        className: selectedClass.name,
        subjectName: selectedSubject?.name,
        weekRange: formatWeekRange(weekStart),
        generatedAt: new Date().toLocaleString("es-ES"),
        visibleSlotsCount,
        unplannedCount: pendingSessionCount,
        sessions: printablePlannerSessions
      })
    );
    downloadHtml(`planificador-semanal-${toIsoDate(weekStart)}.html`, html);
    setNotice("Planificador semanal exportado.");
  };

  return (
    <section className="module-card">
      {isBusy ? (
        <div className="management-progress" role="status" aria-label="Procesando planificador">
          <div className="management-progress-bar" />
        </div>
      ) : null}

      <div className="planner-shell">
        <aside className="courses-list-panel planner-sidebar">
          <ContextSidebarTabs />
          <div className="context-sidebar-separator" aria-hidden="true" />
          <div className="planner-week-controls">
            <strong>Semana</strong>
            <span className="pill">{formatWeekRange(weekStart)}</span>
            <div className="inline-form">
              <button type="button" className="btn secondary" onClick={() => setWeekStart((current) => addDays(current, -7))}>
                Anterior
              </button>
              <button type="button" className="btn secondary" onClick={() => setWeekStart(startOfWeek(new Date(), weekStartsOn))}>
                Hoy
              </button>
              <button type="button" className="btn secondary" onClick={() => setWeekStart((current) => addDays(current, 7))}>
                Siguiente
              </button>
              <button type="button" className="btn secondary" disabled={!selectedClassId} onClick={exportPrintableWeek}>
                Imprimir
              </button>
            </div>
          </div>

          <div className="planner-backlog">
            <strong>Sesiones por planificar</strong>
            {selectedQuickTask ? (
              <div className="planner-quick-selection" role="status" aria-live="polite">
                <div>
                  <span>Seleccionada</span>
                  <strong>{selectedQuickTask.task.title || "Tarea sin título"}</strong>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Cancelar asignación rápida"
                  onClick={() => setQuickTaskKey("")}
                >
                  X
                </button>
              </div>
            ) : null}
            <div className="planner-backlog-list">
              {unplannedTasks.map((item) => (
                <button
                  key={`${item.task.id}:${item.subject.id}`}
                  type="button"
                  className={`planner-mini-card ${quickTaskKey === taskSubjectKey(item.task.id, item.subject.id) ? "active" : ""}`}
                  aria-pressed={quickTaskKey === taskSubjectKey(item.task.id, item.subject.id)}
                  onClick={() => {
                    const key = taskSubjectKey(item.task.id, item.subject.id);
                    setQuickTaskKey((current) => current === key ? "" : key);
                    setNotice("");
                  }}
                >
                  <span>{item.task.title || "Tarea sin título"}</span>
                  <small>{item.subject.name} · {item.unitName}</small>
                  <small>{Math.max(0, item.expected - item.planned)} pendientes · {item.planned}/{item.expected} planificadas</small>
                </button>
              ))}
              {unplannedTasks.length === 0 ? (
                <p className="hint">No hay sesiones pendientes de planificación para el contexto actual.</p>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="course-detail-panel planner-panel">
          <header className="workflow-page-header">
            <div>
              <h1>Planificador semanal</h1>
              <p>{formatWeekRange(weekStart)}</p>
            </div>
          </header>
          <section className="detail-section flush">
            <div className="metric-grid compact">
              <article className="metric-item">
                <strong>Clases visibles</strong>
                <div>{weekDates.reduce((sum, day) => sum + (plannerCellsByDate.get(day.iso)?.length ?? 0), 0)}</div>
              </article>
              <article className="metric-item">
                <strong>Sesiones programadas</strong>
                <div>{weekSessions.length}</div>
              </article>
              <article className="metric-item">
                <strong>Sesiones pendientes</strong>
                <div>{pendingSessionCount}</div>
              </article>
            </div>
            {notice ? (
              <div className="planner-notice" role="status" aria-live="polite">
                <span>{notice}</span>
                {undoAction ? (
                  <button type="button" className="btn secondary compact-link" disabled={isBusy} onClick={() => void undoLastPlannerAction()}>
                    Deshacer
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          {!selectedClassId ? (
            <p className="empty-state">Selecciona un curso para abrir el planificador semanal.</p>
          ) : subjectsForClass.length === 0 ? (
            <p className="empty-state">El curso seleccionado no tiene asignaturas asociadas.</p>
          ) : weekDates.length === 0 ? (
            <p className="empty-state">No hay días activos en el horario para mostrar en el planificador.</p>
          ) : (
            <div className="planner-week-grid" aria-label="Planificador semanal">
              {weekDates.map((day) => {
                const cells = plannerCellsByDate.get(day.iso) ?? [];
                return (
                  <section key={day.iso} className="planner-day-column">
                    <header className="planner-day-header">
                      <strong>{day.label}</strong>
                      <span>{day.iso}</span>
                    </header>
                    <div className="planner-day-slots">
                      {cells.map((cell) => {
                        const session = cell.session;
                        const task = session ? taskById.get(session.taskId) : null;
                        const unitName = session
                          ? unitNameByTaskSubject.get(taskSubjectKey(session.taskId, cell.subject.id))
                          : "";
                        const planned = session
                          ? taskSessionCountByTaskSubject.get(taskSubjectKey(session.taskId, cell.subject.id)) ?? 0
                          : 0;
                        const expected = Math.max(1, Math.round(task?.sessionCount ?? 1));
                        const statusLabel = session ? sessionStatusLabel(session.status) : "";
                        const isQuickTarget = canQuickAssignTask(
                          selectedQuickTask?.subject.id,
                          cell.subject.id,
                          Boolean(session)
                        );
                        return (
                          <article
                            key={cell.key}
                            className={`planner-slot-card ${session ? "filled" : ""} ${
                              draggedSession && !session && cell.subject.id === draggedSession.subjectId
                                ? "drop-ready"
                                : ""
                            } ${isQuickTarget ? "quick-ready" : ""}`}
                            onDragOver={(event) => {
                              if (!draggedSessionId || session) return;
                              event.preventDefault();
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              if (!draggedSessionId || session) return;
                              void moveSessionToCell(draggedSessionId, cell);
                            }}
                          >
                            <div className="planner-slot-meta">
                              <span>{formatBlockTime(cell.block)}</span>
                              <strong>{cell.subject.name}</strong>
                            </div>
                            {session && task ? (
                              <button
                                type="button"
                                className="planner-session-card"
                                draggable
                                onDragStart={() => setDraggedSessionId(session.id)}
                                onDragEnd={() => setDraggedSessionId("")}
                                onClick={() => openCellModal(cell)}
                              >
                                <span>{task.title || "Tarea sin título"}</span>
                                <small>{unitName || "Sin unidad"}</small>
                                <small>{planned}/{expected} sesiones · {statusLabel}</small>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="planner-empty-slot"
                                disabled={isBusy}
                                aria-label={
                                  isQuickTarget
                                    ? `Asignar ${selectedQuickTask?.task.title || "tarea"} al ${cell.date}, ${formatBlockTime(cell.block)}`
                                    : `Programar tarea el ${cell.date}, ${formatBlockTime(cell.block)}`
                                }
                                onClick={() => {
                                  if (isQuickTarget) {
                                    void assignQuickTaskToCell(cell);
                                  } else {
                                    openCellModal(cell);
                                  }
                                }}
                              >
                                {isQuickTarget ? "Asignar seleccionada" : "Programar tarea"}
                              </button>
                            )}
                          </article>
                        );
                      })}
                      {cells.length === 0 ? (
                        <p className="planner-no-class">Sin clases</p>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Modal
        open={Boolean(selectedCell)}
        title={selectedCell?.session ? "Editar sesión" : "Programar sesión"}
        onClose={() => void closePlannerModal()}
      >
        {selectedCell ? (
          <div className="planner-session-modal">
            <p className="hint">
              {selectedCell.dayName} {selectedCell.date} · {formatBlockTime(selectedCell.block)} · {selectedCell.subject.name}
            </p>
            <label className="detail-field full">
              <span>Tarea</span>
              <select className="input" value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)}>
                {selectableTasksForCell.map((item) => (
                  <option key={item.task.id} value={item.task.id}>
                    {item.task.title || "Tarea sin título"} · {item.unitName} · {item.planned}/{item.expected}
                  </option>
                ))}
              </select>
            </label>
            {selectableTasksForCell.length === 0 ? (
              <p className="empty-state">No hay tareas vinculadas a esta asignatura.</p>
            ) : null}
            <div className="detail-grid">
              <label className="detail-field">
                <span>Estado</span>
                <select
                  className="input"
                  value={sessionPlanDraft.status}
                  onChange={(event) =>
                    setSessionPlanDraft((current) => ({
                      ...current,
                      status: event.target.value as SessionPlanDraft["status"]
                    }))
                  }
                >
                  {SESSION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {sessionStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="detail-field full">
                <span>Objetivos</span>
                <textarea
                  className="input"
                  value={sessionPlanDraft.objectives}
                  placeholder="Qué se espera conseguir en esta sesión"
                  onChange={(event) => setSessionPlanDraft((current) => ({ ...current, objectives: event.target.value }))}
                />
              </label>
              <label className="detail-field full">
                <span>Competencias / saberes</span>
                <textarea
                  className="input"
                  value={sessionPlanDraft.competencies}
                  placeholder="Competencias, saberes o criterios trabajados"
                  onChange={(event) => setSessionPlanDraft((current) => ({ ...current, competencies: event.target.value }))}
                />
              </label>
              <label className="detail-field full">
                <span>Materiales</span>
                <input
                  className="input"
                  value={sessionPlanDraft.materials}
                  placeholder="Libro, ficha, enlace, laboratorio..."
                  onChange={(event) => setSessionPlanDraft((current) => ({ ...current, materials: event.target.value }))}
                />
              </label>
              <label className="detail-field full">
                <span>Deberes</span>
                <input
                  className="input"
                  value={sessionPlanDraft.homework}
                  placeholder="Trabajo para casa o continuidad"
                  onChange={(event) => setSessionPlanDraft((current) => ({ ...current, homework: event.target.value }))}
                />
              </label>
              <label className="detail-field full">
                <span>Notas docentes</span>
                <textarea
                  className="input"
                  value={sessionPlanDraft.teacherNotes}
                  placeholder="Ajustes, observaciones o cambios para próximas sesiones"
                  onChange={(event) => setSessionPlanDraft((current) => ({ ...current, teacherNotes: event.target.value }))}
                />
              </label>
            </div>
            <div className="inline-form">
              <button type="button" className="btn secondary" onClick={() => void closePlannerModal()}>
                Cancelar
              </button>
              {selectedCell.session ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    if (selectedCell.session) openRescheduleModal(selectedCell.session);
                  }}
                >
                  Reprogramar
                </button>
              ) : null}
              {selectedCell.session ? (
                <button
                  type="button"
                  className="btn secondary management-danger-btn"
                  onClick={() => setSessionPendingRemoval(selectedCell.session ?? null)}
                >
                  Quitar
                </button>
              ) : null}
              <button type="button" className="btn primary" disabled={!selectedTaskId} onClick={() => void assignTaskToCell()}>
                {selectedCell.session ? "Guardar sesión" : "Programar sesión"}
              </button>
              {selectedCell.session ? (
                <>
                  <NavLink
                    className="btn secondary"
                    to={`/today?date=${selectedCell.date}&classId=${encodeURIComponent(selectedCell.classGroup.id)}&subjectId=${encodeURIComponent(selectedCell.subject.id)}&slotId=${encodeURIComponent(selectedCell.block.id)}`}
                  >
                    Abrir clase en Hoy
                  </NavLink>
                  <NavLink
                    className="btn secondary"
                    to={`/journal/work?classId=${encodeURIComponent(selectedCell.classGroup.id)}&subjectId=${encodeURIComponent(selectedCell.subject.id)}&taskId=${encodeURIComponent(selectedCell.session.taskId)}&date=${selectedCell.date}&slotId=${encodeURIComponent(selectedCell.block.id)}`}
                  >
                    Evaluar tarea
                  </NavLink>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        open={sessionPendingReschedule !== null}
        title="Reprogramar sesión"
        subtitle={sessionPendingReschedule ? taskById.get(sessionPendingReschedule.taskId)?.title : undefined}
        onClose={() => {
          if (!isBusy) setSessionPendingReschedule(null);
        }}
      >
        {sessionPendingReschedule ? (
          <div className="planner-reschedule-modal">
            <p className="hint">
              Elige una fecha lectiva y una franja asignada a la misma asignatura.
            </p>
            <div className="detail-grid">
              <label className="detail-field">
                <span>Fecha</span>
                <input
                  className="input"
                  type="date"
                  value={rescheduleDate}
                  onChange={(event) => setRescheduleDate(event.target.value)}
                />
              </label>
              <label className="detail-field">
                <span>Franja</span>
                <select
                  className="input"
                  value={rescheduleSlotId}
                  disabled={rescheduleBlocks.length === 0}
                  onChange={(event) => setRescheduleSlotId(event.target.value)}
                >
                  {rescheduleBlocks.map((block) => (
                    <option key={block.id} value={block.id}>{formatBlockTime(block)}</option>
                  ))}
                </select>
              </label>
            </div>
            {rescheduleDate && rescheduleBlocks.length === 0 ? (
              <p className="notice compact" role="status">
                Ese día no tiene una clase activa para esta asignatura.
              </p>
            ) : null}
            {notice ? <p className="notice compact" role="status" aria-live="polite">{notice}</p> : null}
            <div className="inline-form">
              <button type="button" className="btn secondary" disabled={isBusy} onClick={() => setSessionPendingReschedule(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={isBusy || !rescheduleDate || !rescheduleSlotId}
                onClick={() => void moveSessionToTarget(sessionPendingReschedule.id, rescheduleDate, rescheduleSlotId)}
              >
                {isBusy ? "Reprogramando..." : "Reprogramar sesión"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        open={sessionPendingRemoval !== null}
        title="Quitar sesión del Planificador"
        onClose={() => {
          if (!isBusy) setSessionPendingRemoval(null);
        }}
      >
        <p>La sesión dejará de estar programada. Podrás recuperar inmediatamente la acción con Deshacer.</p>
        <div className="inline-form">
          <button type="button" className="btn secondary" disabled={isBusy} onClick={() => setSessionPendingRemoval(null)}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn secondary management-danger-btn"
            disabled={isBusy}
            onClick={() => {
              if (sessionPendingRemoval) void removeSession(sessionPendingRemoval);
            }}
          >
            Quitar sesión
          </button>
        </div>
      </Modal>
    </section>
  );
}
