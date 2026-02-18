import { useEffect, useMemo, useState } from "react";
import { db } from "../../shared/db/database";
import type { ClassGroup, LessonPlan } from "../../shared/db/types";
import { IconButton } from "../../shared/ui/IconButton";

const DAY_NAMES = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mondayOfWeek(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map((item) => Number(item));
  const date = new Date(year, month - 1, day);
  const jsDay = date.getDay();
  const offset = jsDay === 0 ? -6 : 1 - jsDay;
  date.setDate(date.getDate() + offset);
  return date;
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map((item) => Number(item));
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

type PlannerDraft = {
  classId: string;
  unit: string;
  objective: string;
  activity: string;
  resources: string;
  homework: string;
};

const emptyDraft: PlannerDraft = {
  classId: "",
  unit: "",
  objective: "",
  activity: "",
  resources: "",
  homework: ""
};

export function PlannerPage() {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedClassId, setSelectedClassId] = useState("");
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [draft, setDraft] = useState<PlannerDraft>(emptyDraft);

  const load = async () => {
    const [classRows, planRows] = await Promise.all([
      db.classGroups.orderBy("name").toArray(),
      db.lessonPlans.orderBy("date").toArray()
    ]);
    setClasses(classRows);
    setPlans(planRows);
    if (classRows.length > 0 && !selectedClassId) {
      setSelectedClassId(classRows[0].id);
      setDraft((current) => ({ ...current, classId: classRows[0].id }));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!draft.classId && selectedClassId) {
      setDraft((current) => ({ ...current, classId: selectedClassId }));
    }
  }, [draft.classId, selectedClassId]);

  const weekDates = useMemo(() => {
    const monday = mondayOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return toIsoDate(date);
    });
  }, [selectedDate]);

  const filteredPlans = useMemo(
    () => (selectedClassId ? plans.filter((item) => item.classId === selectedClassId) : plans),
    [plans, selectedClassId]
  );

  const plansByDate = useMemo(() => {
    const map = new Map<string, LessonPlan[]>();
    for (const plan of filteredPlans) {
      const arr = map.get(plan.date) ?? [];
      arr.push(plan);
      map.set(plan.date, arr);
    }
    for (const [date, arr] of map.entries()) {
      map.set(
        date,
        [...arr].sort((a, b) => a.unit.localeCompare(b.unit))
      );
    }
    return map;
  }, [filteredPlans]);

  const dayPlans = plansByDate.get(selectedDate) ?? [];

  const createPlan = async (): Promise<void> => {
    if (!draft.classId || draft.unit.trim().length < 2 || draft.activity.trim().length < 2) {
      return;
    }
    await db.lessonPlans.add({
      id: crypto.randomUUID(),
      classId: draft.classId,
      date: selectedDate,
      unit: draft.unit.trim(),
      objective: draft.objective.trim(),
      activity: draft.activity.trim(),
      resources: draft.resources.trim() || undefined,
      homework: draft.homework.trim() || undefined,
      status: "planned"
    });
    setDraft((current) => ({ ...emptyDraft, classId: current.classId }));
    await load();
  };

  const togglePlanStatus = async (planId: string): Promise<void> => {
    const plan = plans.find((item) => item.id === planId);
    if (!plan) {
      return;
    }
    await db.lessonPlans.put({
      ...plan,
      status: plan.status === "taught" ? "planned" : "taught"
    });
    await load();
  };

  const deletePlan = async (planId: string): Promise<void> => {
    await db.lessonPlans.delete(planId);
    await load();
  };

  return (
    <section className="module-card">
      <h2>Planner docente</h2>

      <div className="planner-toolbar">
        <div className="inline-form">
          <button
            type="button"
            className="icon-btn"
            aria-label="Dia anterior"
            onClick={() => setSelectedDate((current) => addDays(current, -1))}
          >
            {"<"}
          </button>
          <input
            className="input"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label="Dia siguiente"
            onClick={() => setSelectedDate((current) => addDays(current, 1))}
          >
            {">"}
          </button>
        </div>
        <div className="inline-form">
          <button
            type="button"
            className={`btn secondary ${viewMode === "day" ? "planner-view-active" : ""}`}
            onClick={() => setViewMode("day")}
          >
            Dia
          </button>
          <button
            type="button"
            className={`btn secondary ${viewMode === "week" ? "planner-view-active" : ""}`}
            onClick={() => setViewMode("week")}
          >
            Semana
          </button>
        </div>
      </div>

      <div className="courses-layout">
        <aside className="courses-list-panel">
          <div className="courses-list-header">
            <strong>Clases</strong>
          </div>
          <div className="courses-list section-tabs" role="tablist" aria-label="Clases">
            {classes.map((group) => (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={selectedClassId === group.id}
                className={`section-tab ${selectedClassId === group.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedClassId(group.id);
                  setDraft((current) => ({ ...current, classId: group.id }));
                }}
              >
                <span>{group.name}</span>
                <small>{plans.filter((item) => item.classId === group.id).length} sesiones</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="course-detail-panel">
          <section className="detail-section">
            <h5>Nueva sesion</h5>
            <div className="detail-grid">
              <div className="detail-field">
                <label>Clase</label>
                <select
                  className="input"
                  value={draft.classId}
                  onChange={(event) => setDraft((current) => ({ ...current, classId: event.target.value }))}
                >
                  {classes.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="detail-field">
                <label>Unidad</label>
                <input
                  className="input"
                  value={draft.unit}
                  onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))}
                />
              </div>
              <div className="detail-field full">
                <label>Objetivo</label>
                <input
                  className="input"
                  value={draft.objective}
                  onChange={(event) => setDraft((current) => ({ ...current, objective: event.target.value }))}
                />
              </div>
              <div className="detail-field full">
                <label>Actividad</label>
                <textarea
                  className="input"
                  value={draft.activity}
                  onChange={(event) => setDraft((current) => ({ ...current, activity: event.target.value }))}
                />
              </div>
              <div className="detail-field">
                <label>Recursos</label>
                <input
                  className="input"
                  placeholder="PDF, enlace, material"
                  value={draft.resources}
                  onChange={(event) => setDraft((current) => ({ ...current, resources: event.target.value }))}
                />
              </div>
              <div className="detail-field">
                <label>Tarea</label>
                <input
                  className="input"
                  placeholder="Deberes o siguiente paso"
                  value={draft.homework}
                  onChange={(event) => setDraft((current) => ({ ...current, homework: event.target.value }))}
                />
              </div>
            </div>
            <div className="actions-cell" style={{ marginTop: 8 }}>
              <IconButton icon="save" label="Guardar sesion" onClick={async () => void createPlan()} />
            </div>
          </section>

          {viewMode === "day" ? (
            <section className="detail-section">
              <h5>Plan del dia</h5>
              <div className="planner-list">
                {dayPlans.map((plan) => (
                  <article key={plan.id} className="planner-card">
                    <div className="planner-card-header">
                      <strong>{plan.unit}</strong>
                      <span className={`planner-status ${plan.status === "taught" ? "done" : ""}`}>
                        {plan.status === "taught" ? "Impartida" : "Planificada"}
                      </span>
                    </div>
                    <p>{plan.activity}</p>
                    {plan.objective ? <small>Objetivo: {plan.objective}</small> : null}
                    {plan.resources ? <small>Recursos: {plan.resources}</small> : null}
                    {plan.homework ? <small>Tarea: {plan.homework}</small> : null}
                    <div className="actions-cell">
                      <IconButton
                        icon="edit"
                        label="Cambiar estado"
                        onClick={async () => void togglePlanStatus(plan.id)}
                      />
                      <IconButton icon="delete" label="Eliminar sesion" onClick={async () => void deletePlan(plan.id)} />
                    </div>
                  </article>
                ))}
                {dayPlans.length === 0 ? <p className="hint">No hay sesiones para este dia.</p> : null}
              </div>
            </section>
          ) : (
            <section className="detail-section">
              <h5>Vista semanal</h5>
              <div className="planner-week-grid">
                {weekDates.map((date, index) => (
                  <article key={date} className="planner-week-day">
                    <strong>{DAY_NAMES[index]}</strong>
                    <small>{date}</small>
                    <span className="pill">{(plansByDate.get(date) ?? []).length}</span>
                  </article>
                ))}
              </div>
            </section>
          )}
        </section>
      </div>
    </section>
  );
}
