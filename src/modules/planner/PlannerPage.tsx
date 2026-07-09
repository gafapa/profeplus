import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
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
import {
  SESSION_STATUSES,
  normalizeSessionPlanDraft,
  sessionPlanDraftFromSession,
  sessionStatusLabel,
  type SessionPlanDraft
} from "../../shared/planner/sessionPlan";
import { addDays, buildVisiblePlannerWeekDates, formatWeekRange, startOfWeek, toIsoDate } from "../../shared/planner/week";
import { buildPrintablePlannerReport, type PrintablePlannerSession } from "../../shared/planner/printablePlanner";
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
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);

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

  useEffect(() => {
    let active = true;
    const run = async (): Promise<void> => {
      setIsBusy(true);
      try {
        await loadPlannerData();
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

  const scheduleBlockById = useMemo(() => {
    const map = new Map<string, ScheduleBlock>();
    for (const day of scheduleDays) {
      for (const block of day.blocks) {
        map.set(block.id, block);
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
      const key = taskSubjectKey(session.taskId, session.subjectId);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [taskSessions]);

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
            statusLabel: sessionStatusLabel(session.status ?? "planned"),
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

  const removeSession = async (session: TaskSession): Promise<void> => {
    setIsBusy(true);
    try {
      const counts = await countSessionData(session);
      if (sessionDataTotal(counts) > 0) {
        setNotice("No se puede quitar una sesión que ya tiene comentarios o evaluación.");
        return;
      }
      await db.taskSessions.delete(session.id);
      setSelectedCell(null);
      await refreshAfterAction("Sesión eliminada.");
    } finally {
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
    const occupiedClassSlot = sessionsByClassSlotKey.get(
      classSlotKey(target.classGroup.id, target.date, target.block.id)
    );
    if (occupiedClassSlot && occupiedClassSlot.id !== session.id) {
      setNotice("El bloque destino ya tiene una tarea programada.");
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
        date: target.date,
        scheduleSlotId: target.block.id
      });
      await refreshAfterAction("Sesión movida.");
    } finally {
      setDraggedSessionId("");
      setIsBusy(false);
    }
  };

  const openCellModal = (cell: PlannerCell): void => {
    setSelectedCell(cell);
    setNotice("");
  };

  const exportPrintableWeek = (): void => {
    if (!selectedClass) {
      setNotice("Selecciona un curso para exportar el planner.");
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
        unplannedCount: unplannedTasks.length,
        sessions: printablePlannerSessions
      })
    );
    downloadHtml(`planner-semanal-${toIsoDate(weekStart)}.html`, html);
    setNotice("Planner semanal exportado.");
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
            <strong>Tareas por planificar</strong>
            <div className="planner-backlog-list">
              {unplannedTasks.slice(0, 12).map((item) => (
                <article key={`${item.task.id}:${item.subject.id}`} className="planner-mini-card">
                  <span>{item.task.title || "Tarea sin título"}</span>
                  <small>{item.subject.name} · {item.unitName}</small>
                  <small>{item.planned}/{item.expected} sesiones</small>
                </article>
              ))}
              {unplannedTasks.length === 0 ? (
                <p className="hint">No hay tareas pendientes de planificación para el contexto actual.</p>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="course-detail-panel planner-panel">
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
                <strong>Pendientes</strong>
                <div>{unplannedTasks.length}</div>
              </article>
            </div>
            {notice ? <p className="hint" role="status" aria-live="polite">{notice}</p> : null}
          </section>

          {!selectedClassId ? (
            <p className="empty-state">Selecciona un curso para abrir el planificador semanal.</p>
          ) : subjectsForClass.length === 0 ? (
            <p className="empty-state">El curso seleccionado no tiene asignaturas asociadas.</p>
          ) : weekDates.length === 0 ? (
            <p className="empty-state">No hay días activos en el horario para mostrar en el planner.</p>
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
                        const statusLabel = session ? sessionStatusLabel(session.status ?? "planned") : "";
                        return (
                          <article
                            key={cell.key}
                            className={`planner-slot-card ${session ? "filled" : ""} ${
                              draggedSession && !session && cell.subject.id === draggedSession.subjectId
                                ? "drop-ready"
                                : ""
                            }`}
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
                              <button type="button" className="planner-empty-slot" onClick={() => openCellModal(cell)}>
                                Programar tarea
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
        onClose={() => setSelectedCell(null)}
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
              <button type="button" className="btn secondary" onClick={() => setSelectedCell(null)}>
                Cancelar
              </button>
              {selectedCell.session ? (
                <button
                  type="button"
                  className="btn secondary management-danger-btn"
                  onClick={() => {
                    if (selectedCell.session) {
                      void removeSession(selectedCell.session);
                    }
                  }}
                >
                  Quitar
                </button>
              ) : null}
              <button type="button" className="btn secondary" disabled={!selectedTaskId} onClick={() => void assignTaskToCell()}>
                Guardar
              </button>
              <NavLink className="btn secondary" to="/journal/attendance">
                Asistencia
              </NavLink>
              <NavLink className="btn secondary" to="/journal/work">
                Trabajo
              </NavLink>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
