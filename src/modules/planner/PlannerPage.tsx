import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import type { WeekStartsOn } from "../../app/store";
import { db } from "../../shared/db/database";
import type {
  ScheduleDay,
  Subject,
  Task,
  TaskSession,
  TaskSubjectLink,
  UnitBlock
} from "../../shared/db/types";
import { IconButton } from "../../shared/ui/IconButton";
import { Modal } from "../../shared/ui/Modal";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";

type TaskSessionDraft = {
  date: string;
  scheduleSlotId: string;
};

type SlotOption = {
  slotId: string;
  label: string;
  occupied: boolean;
  assignedToCurrentTask: boolean;
};

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

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoDayOfWeek(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map((item) => Number(item));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return 0;
  }
  const date = new Date(year, month - 1, day);
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function monthStart(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, delta: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + delta, 1);
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

function uniqueSessionKey(item: TaskSessionDraft): string {
  return `${item.date}::${item.scheduleSlotId}`;
}

function compareSessionDraft(a: TaskSessionDraft, b: TaskSessionDraft): number {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) {
    return byDate;
  }
  return a.scheduleSlotId.localeCompare(b.scheduleSlotId);
}

function normalizeTaskSessions(rows: TaskSession[]): TaskSessionDraft[] {
  return rows
    .map((item) => ({
      date: item.date,
      scheduleSlotId: item.scheduleSlotId
    }))
    .sort(compareSessionDraft);
}

const today = toIsoDate(new Date());

export function TasksPage() {
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const selectedSubjectId = useAppSelector((state) => state.app.selectedSubjectId);
  const weekStartsOn = useAppSelector((state) => state.app.weekStartsOn);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<UnitBlock[]>([]);
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskSubjectLinks, setTaskSubjectLinks] = useState<TaskSubjectLink[]>([]);
  const [taskSessions, setTaskSessions] = useState<TaskSession[]>([]);

  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [taskSearch, setTaskSearch] = useState("");

  const [detailSessions, setDetailSessions] = useState<TaskSessionDraft[]>([]);
  const [taskNotice, setTaskNotice] = useState("");
  const [taskDirty, setTaskDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const [sessionDate, setSessionDate] = useState(today);
  const [sessionCalendarMonth, setSessionCalendarMonth] = useState(() => monthStart(new Date()));

  const loadAll = async (): Promise<void> => {
    const [
      subjectsData,
      subjectCourseLinksData,
      unitsData,
      scheduleDaysData,
      linksData,
      taskSessionsData
    ] = await Promise.all([
      db.subjects.orderBy("name").toArray(),
      selectedClassId
        ? db.subjectCourseLinks.where("classId").equals(selectedClassId).toArray()
        : Promise.resolve([]),
      db.unitBlocks.orderBy("[subjectId+position]").toArray(),
      db.scheduleDays.orderBy("dayOfWeek").toArray(),
      selectedSubjectId
        ? db.taskSubjectLinks.where("subjectId").equals(selectedSubjectId).toArray()
        : Promise.resolve([]),
      selectedClassId && selectedSubjectId
        ? db.taskSessions
            .where("[subjectId+classId]")
            .equals([selectedSubjectId, selectedClassId])
            .toArray()
        : Promise.resolve([])
    ]);

    const linkedSubjectIds = new Set(subjectCourseLinksData.map((item) => item.subjectId));
    const filteredSubjects = subjectsData.filter((item) => linkedSubjectIds.has(item.id));
    setSubjects(filteredSubjects);
    setUnits(unitsData);
    setScheduleDays(scheduleDaysData);
    setTaskSubjectLinks(linksData);

    // Cargar tareas por IDs únicos extraídos de los vínculos
    const uniqueTaskIds = [...new Set(linksData.map((l) => l.taskId))];
    const taskRows = uniqueTaskIds.length > 0 ? await db.tasks.bulkGet(uniqueTaskIds) : [];
    const tasksData = taskRows.filter((t): t is Task => t !== undefined);
    setTasks(tasksData);
    setTaskSessions(taskSessionsData);
  };

  useEffect(() => {
    void loadAll();
  }, [selectedClassId, selectedSubjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nombre de unidad vinculada por taskId (usando la primera coincidencia)
  const unitNameByTaskId = useMemo(() => {
    const map = new Map<string, string>();
    for (const link of taskSubjectLinks) {
      if (link.unitId && !map.has(link.taskId)) {
        const unit = units.find((u) => u.id === link.unitId);
        if (unit) map.set(link.taskId, unit.name);
      }
    }
    return map;
  }, [taskSubjectLinks, units]);

  const latestSessionDateByTask = useMemo(() => {
    const map = new Map<string, string>();
    for (const session of taskSessions) {
      const current = map.get(session.taskId) ?? "";
      if (session.date > current) {
        map.set(session.taskId, session.date);
      }
    }
    return map;
  }, [taskSessions]);

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        const dateA = latestSessionDateByTask.get(a.id) ?? "";
        const dateB = latestSessionDateByTask.get(b.id) ?? "";
        const byDate = dateB.localeCompare(dateA);
        if (byDate !== 0) {
          return byDate;
        }
        return a.title.localeCompare(b.title);
      }),
    [latestSessionDateByTask, tasks]
  );

  const filteredTasks = useMemo(() => {
    const term = taskSearch.trim().toLowerCase();
    if (!term) return sortedTasks;
    return sortedTasks.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term)
    );
  }, [sortedTasks, taskSearch]);

  useEffect(() => {
    if (sortedTasks.length === 0) {
      setSelectedTaskId("");
      return;
    }
    if (!sortedTasks.some((item) => item.id === selectedTaskId)) {
      setSelectedTaskId(sortedTasks[0].id);
    }
  }, [selectedTaskId, sortedTasks]);

  const selectedTask = useMemo(
    () => sortedTasks.find((item) => item.id === selectedTaskId) ?? null,
    [selectedTaskId, sortedTasks]
  );

  const plannedSessionCount = Math.max(1, Math.round(selectedTask?.sessionCount ?? 1));

  const selectedSubject = useMemo(
    () => subjects.find((item) => item.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjects]
  );

  const taskCountById = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of taskSessions) {
      map.set(item.taskId, (map.get(item.taskId) ?? 0) + 1);
    }
    return map;
  }, [taskSessions]);

  const slotLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const day of scheduleDays) {
      for (const block of day.blocks) {
        if (block.isBreak) continue;
        map.set(block.id, `${day.dayName} ${block.startTime} - ${block.endTime}`);
      }
    }
    return map;
  }, [scheduleDays]);

  const selectedSubjectSlotIds = useMemo(
    () => new Set(selectedSubject?.scheduleSlotIds ?? []),
    [selectedSubject]
  );

  const scheduleByDayForSelectedSubject = useMemo(() => {
    const map = new Map<number, ScheduleDay>();
    for (const day of scheduleDays) {
      if (!day.enabled) continue;
      const blocks = day.blocks.filter((block) => !block.isBreak && selectedSubjectSlotIds.has(block.id));
      if (blocks.length === 0) continue;
      map.set(day.dayOfWeek, { ...day, blocks });
    }
    return map;
  }, [scheduleDays, selectedSubjectSlotIds]);

  const classDayOfWeekSet = useMemo(
    () => new Set(scheduleByDayForSelectedSubject.keys()),
    [scheduleByDayForSelectedSubject]
  );

  // Sesiones ocupadas por otras tareas (sessions ya filtradas por subject+class)
  const occupiedSessionKeySet = useMemo(() => {
    const set = new Set<string>();
    for (const session of taskSessions) {
      if (selectedTask && session.taskId === selectedTask.id) continue;
      set.add(`${session.date}::${session.scheduleSlotId}`);
    }
    return set;
  }, [selectedTask, taskSessions]);

  const detailSessionKeySet = useMemo(
    () => new Set(detailSessions.map(uniqueSessionKey)),
    [detailSessions]
  );

  const detailSessionDateSet = useMemo(
    () => new Set(detailSessions.map((item) => item.date)),
    [detailSessions]
  );

  const occupiedCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const key of occupiedSessionKeySet) {
      const parts = key.split("::");
      const date = parts[0] ?? "";
      if (!date) continue;
      map.set(date, (map.get(date) ?? 0) + 1);
    }
    return map;
  }, [occupiedSessionKeySet]);

  const availableSlotsForSessionDate = useMemo((): SlotOption[] => {
    if (!selectedSubject) return [];
    const dayOfWeek = isoDayOfWeek(sessionDate);
    if (dayOfWeek === 0) return [];
    const scheduleDay = scheduleByDayForSelectedSubject.get(dayOfWeek);
    if (!scheduleDay) return [];
    return scheduleDay.blocks.map((block) => ({
      slotId: block.id,
      label: `${scheduleDay.dayName} ${block.startTime} - ${block.endTime}`,
      occupied: occupiedSessionKeySet.has(`${sessionDate}::${block.id}`),
      assignedToCurrentTask: detailSessionKeySet.has(`${sessionDate}::${block.id}`)
    }));
  }, [detailSessionKeySet, occupiedSessionKeySet, scheduleByDayForSelectedSubject, selectedSubject, sessionDate]);

  useEffect(() => {
    const [year, month] = sessionDate.split("-").map((item) => Number(item));
    if (!Number.isInteger(year) || !Number.isInteger(month)) return;
    setSessionCalendarMonth(new Date(year, month - 1, 1));
  }, [sessionDate]);

  useEffect(() => {
    if (classDayOfWeekSet.size === 0) return;
    if (classDayOfWeekSet.has(isoDayOfWeek(sessionDate))) return;
    const [year, month, day] = sessionDate.split("-").map((item) => Number(item));
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return;
    const base = new Date(year, month - 1, day);
    for (let offset = 1; offset <= 21; offset += 1) {
      const candidate = new Date(base);
      candidate.setDate(base.getDate() + offset);
      const candidateIso = toIsoDate(candidate);
      if (classDayOfWeekSet.has(isoDayOfWeek(candidateIso))) {
        setSessionDate(candidateIso);
        return;
      }
    }
  }, [classDayOfWeekSet, sessionDate]);

  const availableSessionSlots = useMemo(
    () => availableSlotsForSessionDate.filter((item) => !item.occupied && !item.assignedToCurrentTask),
    [availableSlotsForSessionDate]
  );

  const selectedDateOccupationSummary = useMemo(() => {
    const day = scheduleByDayForSelectedSubject.get(isoDayOfWeek(sessionDate));
    if (!day) return { total: 0, occupied: 0 };
    let occupied = 0;
    for (const block of day.blocks) {
      if (occupiedSessionKeySet.has(`${sessionDate}::${block.id}`)) {
        occupied += 1;
      }
    }
    return { total: day.blocks.length, occupied };
  }, [occupiedSessionKeySet, scheduleByDayForSelectedSubject, sessionDate]);

  const sessionCalendarCells = useMemo(
    () => monthGrid(sessionCalendarMonth, weekStartsOn),
    [sessionCalendarMonth, weekStartsOn]
  );
  const calendarWeekdayLabels = useMemo(() => weekdayLabels(weekStartsOn), [weekStartsOn]);

  useEffect(() => {
    if (!selectedTask) {
      setDetailSessions([]);
      setTaskNotice("");
      setTaskDirty(false);
      return;
    }
    setDetailSessions(
      normalizeTaskSessions(taskSessions.filter((item) => item.taskId === selectedTask.id))
    );
    setTaskNotice("");
    setTaskDirty(false);
  }, [selectedTask, taskSessions]);

  const ensureNoPendingChanges = (): boolean => {
    if (!taskDirty) return true;
    setShowUnsavedModal(true);
    return false;
  };

  useUnsavedChangesGuard(taskDirty);

  const persistTask = async (): Promise<boolean> => {
    if (!selectedTask || !taskDirty || !selectedSubjectId || !selectedClassId) return true;

    const selectedSlotIds = new Set(selectedSubject?.scheduleSlotIds ?? []);
    const normalizedSessions: TaskSessionDraft[] = [];
    const seenSessionKeys = new Set<string>();
    for (const item of detailSessions) {
      const dayOfWeek = isoDayOfWeek(item.date);
      const day = scheduleDays.find((row) => row.enabled && row.dayOfWeek === dayOfWeek);
      const slotValidForDay = day?.blocks.some((block) => block.id === item.scheduleSlotId) ?? false;
      if (!selectedSlotIds.has(item.scheduleSlotId) || !slotValidForDay) continue;
      const key = uniqueSessionKey(item);
      if (seenSessionKeys.has(key)) continue;
      seenSessionKeys.add(key);
      normalizedSessions.push(item);
    }
    normalizedSessions.sort(compareSessionDraft);

    if (normalizedSessions.length === 0) {
      setTaskNotice("Asigna al menos una sesión de horario a la tarea.");
      return false;
    }

    await db.transaction("rw", db.taskSessions, async () => {
      await db.taskSessions
        .where("[taskId+classId]")
        .equals([selectedTask.id, selectedClassId])
        .delete();
      await db.taskSessions.bulkAdd(
        normalizedSessions.map((item) => ({
          id: crypto.randomUUID(),
          taskId: selectedTask.id,
          subjectId: selectedSubjectId,
          classId: selectedClassId,
          date: item.date,
          scheduleSlotId: item.scheduleSlotId
        }))
      );
    });

    setTaskNotice("Sesiones guardadas.");
    setTaskDirty(false);
    await loadAll();
    return true;
  };

  const addSessionToTask = (slotId: string): void => {
    if (!sessionDate || !slotId) return;
    if (detailSessions.length >= plannedSessionCount) {
      setTaskNotice(`La tarea ya tiene ${plannedSessionCount} sesiones asignadas.`);
      return;
    }
    const nextItem: TaskSessionDraft = { date: sessionDate, scheduleSlotId: slotId };
    const key = uniqueSessionKey(nextItem);
    if (occupiedSessionKeySet.has(key)) {
      setTaskNotice("Ese bloque ya está ocupado por otra tarea.");
      return;
    }
    if (detailSessionKeySet.has(key)) return;
    setDetailSessions((current) => [...current, nextItem].sort(compareSessionDraft));
    setTaskNotice("");
    setTaskDirty(true);
  };

  return (
    <>
      <section className="module-card">
        <div className="courses-layout">
          <aside className="courses-list-panel">
            <div className="courses-list-header">
              <strong>Tareas</strong>
            </div>
            <input
              type="search"
              className="input list-search"
              placeholder="Buscar tarea..."
              value={taskSearch}
              onChange={(event) => setTaskSearch(event.target.value)}
            />
            <div className="courses-list section-tabs" role="tablist" aria-label="Listado de tareas">
              {filteredTasks.map((task) => (
                <div key={task.id} className="courses-list-row">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedTaskId === task.id}
                    className={`section-tab ${selectedTaskId === task.id ? "active" : ""}`}
                    onClick={() => {
                      if (!ensureNoPendingChanges()) return;
                      setSelectedTaskId(task.id);
                    }}
                  >
                    <span>{task.title || "Tarea sin título"}</span>
                    <small>{unitNameByTaskId.get(task.id) ?? "Sin unidad"}</small>
                    <small>{taskCountById.get(task.id) ?? 0} sesiones</small>
                  </button>
                </div>
              ))}
              {filteredTasks.length === 0 ? (
                <p className="hint">
                  {taskSearch.trim()
                    ? "Sin resultados para la búsqueda."
                    : "No hay tareas vinculadas a esta asignatura. Ve a Configuración → Tareas para crearlas."}
                </p>
              ) : null}
            </div>
          </aside>

          <section className="course-detail-panel">
            {selectedTask ? (
              <>
                <div className="course-detail-header">
                  <div>
                    <h4>{selectedTask.title || "Tarea sin título"}</h4>
                    {unitNameByTaskId.get(selectedTask.id) ? (
                      <p className="hint flush">
                        Unidad: {unitNameByTaskId.get(selectedTask.id)}
                      </p>
                    ) : null}
                  </div>
                  <div className="actions-cell">
                    <IconButton
                      icon="save"
                      label="Guardar sesiones"
                      className={taskDirty ? "save-attention" : ""}
                      disabled={!taskDirty}
                      onClick={async () => {
                        await persistTask();
                      }}
                    />
                  </div>
                </div>

                {selectedTask.description ? (
                  <section className="detail-section">
                    <p className="hint">{selectedTask.description}</p>
                  </section>
                ) : null}

                <section className="detail-section">
                  <h5>Sesiones de horario</h5>
                  <p className="hint">
                    Sesiones asignadas: {detailSessions.length} de {plannedSessionCount}.
                  </p>
                  <section className="attendance-calendar task-session-calendar">
                    <div className="attendance-calendar-header">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Mes anterior"
                        onClick={() => setSessionCalendarMonth((current) => addMonths(current, -1))}
                      >
                        {"<"}
                      </button>
                      <strong>
                        {MONTH_LABELS[sessionCalendarMonth.getMonth()]}{" "}
                        {sessionCalendarMonth.getFullYear()}
                      </strong>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Mes siguiente"
                        onClick={() => setSessionCalendarMonth((current) => addMonths(current, 1))}
                      >
                        {">"}
                      </button>
                    </div>
                    <div
                      className="attendance-calendar-grid"
                      role="grid"
                      aria-label="Calendario de sesiones"
                    >
                      {calendarWeekdayLabels.map((item) => (
                        <span key={item} className="attendance-calendar-weekday">
                          {item}
                        </span>
                      ))}
                      {sessionCalendarCells.map((cell) => {
                        const iso = toIsoDate(cell.date);
                        const dayOfWeek = isoDayOfWeek(iso);
                        const daySchedule = scheduleByDayForSelectedSubject.get(dayOfWeek);
                        const totalSlots = daySchedule?.blocks.length ?? 0;
                        const occupiedSlots = occupiedCountByDate.get(iso) ?? 0;
                        const isClassDay = totalSlots > 0;
                        const isFullyOccupied = isClassDay && occupiedSlots >= totalSlots;
                        const isAssignedToCurrentTask =
                          isClassDay && detailSessionDateSet.has(iso);
                        const isSelected = isClassDay && sessionDate === iso;
                        const isToday = isClassDay && iso === today;
                        const isDisabled = !cell.inMonth || !isClassDay;
                        return (
                          <button
                            key={iso}
                            type="button"
                            disabled={isDisabled}
                            className={`attendance-calendar-day ${cell.inMonth ? "" : "outside"} ${
                              isFullyOccupied
                                ? "missing"
                                : isAssignedToCurrentTask
                                  ? "done"
                                  : ""
                            } ${isSelected ? "selected" : ""} ${isToday ? "today" : ""} ${
                              isClassDay ? "" : "task-calendar-no-class"
                            }`}
                            onClick={() => {
                              if (isDisabled) return;
                              setSessionDate(iso);
                            }}
                          >
                            {isDisabled ? "" : cell.date.getDate()}
                          </button>
                        );
                      })}
                    </div>
                    <div className="attendance-calendar-legend">
                      <span className="attendance-dot today">Hoy</span>
                      <span className="attendance-dot done">Día asignado a esta tarea</span>
                      <span className="attendance-dot missing">Día con horas ocupadas</span>
                    </div>
                  </section>

                  <div className="inline-form">
                    <span className="pill">{sessionDate}</span>
                  </div>
                  <div
                    className="task-session-slots section-tabs"
                    aria-label="Sesiones disponibles"
                  >
                    {availableSessionSlots.map((slot) => (
                      <button
                        key={slot.slotId}
                        type="button"
                        className="section-tab"
                        disabled={detailSessions.length >= plannedSessionCount}
                        onClick={() => addSessionToTask(slot.slotId)}
                      >
                        <span>{slot.label}</span>
                      </button>
                    ))}
                    {availableSessionSlots.length === 0 ? (
                      <p className="hint">No hay sesiones disponibles para este día.</p>
                    ) : null}
                  </div>
                  {selectedDateOccupationSummary.total > 0 ? (
                    <p className="hint">
                      Ocupadas por otras tareas: {selectedDateOccupationSummary.occupied} de{" "}
                      {selectedDateOccupationSummary.total} horas del día.
                    </p>
                  ) : (
                    <p className="hint">
                      Ese día no tiene horario para la asignatura seleccionada.
                    </p>
                  )}

                  {taskNotice ? <p className="hint">{taskNotice}</p> : null}

                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Bloque</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailSessions.map((item, index) => (
                          <tr key={`${item.date}:${item.scheduleSlotId}:${index}`}>
                            <td>{item.date}</td>
                            <td>{slotLabelById.get(item.scheduleSlotId) ?? item.scheduleSlotId}</td>
                            <td className="actions-cell">
                              <IconButton
                                icon="remove"
                                label="Quitar sesión"
                                onClick={() => {
                                  setDetailSessions((current) =>
                                    current.filter((_, currentIndex) => currentIndex !== index)
                                  );
                                  setTaskNotice("");
                                  setTaskDirty(true);
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                        {detailSessions.length === 0 ? (
                          <tr>
                            <td colSpan={3}>No hay sesiones asignadas.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              <p>Selecciona una tarea para programar sus sesiones.</p>
            )}
          </section>
        </div>
      </section>

      <Modal
        open={showUnsavedModal}
        title="Cambios sin guardar"
        onClose={() => setShowUnsavedModal(false)}
      >
        <p>Tienes cambios sin guardar. Pulsa Guardar sesiones antes de continuar.</p>
        <div className="inline-form">
          <button
            type="button"
            className="btn"
            onClick={() => setShowUnsavedModal(false)}
          >
            Entendido
          </button>
        </div>
      </Modal>
    </>
  );
}
