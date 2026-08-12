import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAppSelector } from "../../app/hooks";
import {
  MAX_LAYOUT_DIMENSION,
  MIN_LAYOUT_DIMENSION,
  assignStudentToSeat,
  clampLayoutDimension,
  createDefaultClassroomLayout,
  generateStudentGroups,
  pickNextStudent,
  randomSeatAssignments,
  sanitizeSeatAssignments
} from "../../shared/classroom/layout";
import { db } from "../../shared/db/database";
import type { ClassroomLayout, Student } from "../../shared/db/types";
import { useStudentDisplay } from "../../shared/hooks/useStudentDisplay";
import { ContextSidebarTabs } from "../../shared/ui/ContextSidebarTabs";
import { toLocalIsoDate } from "../../shared/utils/date";

type ClassroomData = {
  students: Student[];
  layout: ClassroomLayout | null;
  absentStudentIds: Set<string>;
};

const EMPTY_DATA: ClassroomData = {
  students: [],
  layout: null,
  absentStudentIds: new Set()
};

function seatLabel(seat: number, columns: number): string {
  return `Fila ${Math.floor(seat / columns) + 1}, puesto ${(seat % columns) + 1}`;
}

export function ClassroomPage() {
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const { compareFn, formatName } = useStudentDisplay();
  const [data, setData] = useState<ClassroomData>(EMPTY_DATA);
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [excludeAbsent, setExcludeAbsent] = useState(true);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [pickedStudent, setPickedStudent] = useState<Student | null>(null);
  const [groupCount, setGroupCount] = useState(4);
  const [groups, setGroups] = useState<Student[][]>([]);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      if (!selectedClassId) {
        if (active) {
          setData(EMPTY_DATA);
          setIsLoading(false);
        }
        return;
      }
      setIsLoading(true);
      const today = toLocalIsoDate();
      const [students, savedLayout, attendance] = await Promise.all([
        db.students.where("classId").equals(selectedClassId).toArray(),
        db.classroomLayouts.where("classId").equals(selectedClassId).first(),
        db.attendanceEntries.where("[classId+date]").equals([selectedClassId, today]).toArray()
      ]);
      students.sort(compareFn);
      const layout = savedLayout ?? createDefaultClassroomLayout(selectedClassId, students);
      const capacity = layout.rows * layout.columns;
      const normalizedLayout = {
        ...layout,
        assignments: sanitizeSeatAssignments(layout.assignments, new Set(students.map((student) => student.id)), capacity)
      };
      if (!savedLayout) await db.classroomLayouts.put(normalizedLayout);
      if (!active) return;
      setData({
        students,
        layout: normalizedLayout,
        absentStudentIds: new Set(attendance.filter((entry) => entry.status === "absent").map((entry) => entry.studentId))
      });
      setPickedIds(new Set());
      setPickedStudent(null);
      setGroups([]);
      setGroupCount(Math.min(4, Math.max(1, students.length)));
      setIsLoading(false);
    };
    void load().catch((error: unknown) => {
      if (!active) return;
      setNotice(`No se pudo cargar el aula: ${error instanceof Error ? error.message : "Error desconocido"}.`);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [compareFn, selectedClassId]);

  const eligibleStudents = useMemo(
    () => data.students.filter((student) => !excludeAbsent || !data.absentStudentIds.has(student.id)),
    [data.absentStudentIds, data.students, excludeAbsent]
  );
  const studentBySeat = useMemo(() => {
    const bySeat = new Map<number, Student>();
    if (!data.layout) return bySeat;
    const studentById = new Map(data.students.map((student) => [student.id, student]));
    for (const [studentId, seat] of Object.entries(data.layout.assignments)) {
      const student = studentById.get(studentId);
      if (student) bySeat.set(seat, student);
    }
    return bySeat;
  }, [data.layout, data.students]);

  const saveLayout = async (layout: ClassroomLayout, message: string): Promise<void> => {
    const updated = { ...layout, updatedAt: new Date().toISOString() };
    try {
      await db.classroomLayouts.put(updated);
      setData((current) => ({ ...current, layout: updated }));
      setNotice(message);
    } catch (error) {
      setNotice(`No se pudo guardar el plano: ${error instanceof Error ? error.message : "Error desconocido"}.`);
    }
  };

  const updateDimension = async (field: "rows" | "columns", value: number): Promise<void> => {
    if (!data.layout) return;
    const dimension = clampLayoutDimension(value);
    const next = { ...data.layout, [field]: dimension };
    const capacity = next.rows * next.columns;
    next.assignments = sanitizeSeatAssignments(next.assignments, new Set(data.students.map((student) => student.id)), capacity);
    await saveLayout(next, "Dimensiones del aula actualizadas.");
  };

  const assignSeat = async (studentId: string, seat: number): Promise<void> => {
    if (!data.layout) return;
    const currentStudent = studentBySeat.get(seat);
    const assignments = studentId
      ? assignStudentToSeat(data.layout.assignments, studentId, seat)
      : currentStudent
        ? assignStudentToSeat(data.layout.assignments, currentStudent.id, null)
        : data.layout.assignments;
    await saveLayout({ ...data.layout, assignments }, studentId ? "Asiento actualizado." : "Asiento liberado.");
  };

  const randomizeSeats = async (): Promise<void> => {
    if (!data.layout || data.students.length === 0) return;
    await saveLayout(
      { ...data.layout, assignments: randomSeatAssignments(data.students.map((student) => student.id), data.layout.rows * data.layout.columns) },
      "Alumnado distribuido aleatoriamente."
    );
  };

  const orderSeats = async (): Promise<void> => {
    if (!data.layout) return;
    const capacity = data.layout.rows * data.layout.columns;
    await saveLayout(
      { ...data.layout, assignments: Object.fromEntries(data.students.slice(0, capacity).map((student, index) => [student.id, index])) },
      "Alumnado colocado según el orden configurado."
    );
  };

  const pickStudent = (): void => {
    const result = pickNextStudent(eligibleStudents, pickedIds);
    setPickedIds(result.nextPickedIds);
    setPickedStudent(result.student);
    setNotice(result.student ? `Selección: ${formatName(result.student)}.` : "No hay alumnado disponible para seleccionar.");
  };

  const createGroups = (): void => {
    const nextGroups = generateStudentGroups(eligibleStudents, groupCount);
    setGroups(nextGroups);
    setNotice(nextGroups.length > 0 ? `${nextGroups.length} grupos equilibrados generados.` : "No hay alumnado disponible para agrupar.");
  };

  const layout = data.layout;
  const capacity = layout ? layout.rows * layout.columns : 0;

  return (
    <article className="classroom-page">
      <header className="classroom-header">
        <div>
          <span className="agenda-eyebrow">Herramientas de aula</span>
          <h1>Plano y grupos</h1>
          <p>Organiza los asientos, realiza selecciones sin repeticiones y crea grupos equilibrados.</p>
        </div>
      </header>

      <div className="courses-layout classroom-layout-shell">
        <aside className="courses-list-panel classroom-sidebar" aria-label="Controles del aula">
          <ContextSidebarTabs includeSubjects={false} />
          <section className="classroom-control-section" aria-labelledby="layout-controls-heading">
            <h2 id="layout-controls-heading">Distribución</h2>
            <div className="classroom-dimension-controls">
              <label className="detail-field">
                <span>Filas</span>
                <input
                  className="input"
                  type="number"
                  min={MIN_LAYOUT_DIMENSION}
                  max={MAX_LAYOUT_DIMENSION}
                  value={layout?.rows ?? MIN_LAYOUT_DIMENSION}
                  disabled={!layout}
                  onChange={(event) => void updateDimension("rows", Number(event.target.value))}
                />
              </label>
              <label className="detail-field">
                <span>Columnas</span>
                <input
                  className="input"
                  type="number"
                  min={MIN_LAYOUT_DIMENSION}
                  max={MAX_LAYOUT_DIMENSION}
                  value={layout?.columns ?? MIN_LAYOUT_DIMENSION}
                  disabled={!layout}
                  onChange={(event) => void updateDimension("columns", Number(event.target.value))}
                />
              </label>
            </div>
            <button type="button" className="btn secondary" disabled={!layout || data.students.length === 0} onClick={() => void orderSeats()}>
              Orden configurado
            </button>
            <button type="button" className="btn secondary" disabled={!layout || data.students.length === 0} onClick={() => void randomizeSeats()}>
              Distribuir al azar
            </button>
          </section>

          <section className="classroom-control-section" aria-labelledby="participation-heading">
            <h2 id="participation-heading">Participación</h2>
            <label className="chip-toggle classroom-absence-toggle">
              <input type="checkbox" checked={excludeAbsent} onChange={(event) => setExcludeAbsent(event.target.checked)} />
              Excluir ausentes de hoy ({data.absentStudentIds.size})
            </label>
            <button type="button" className="btn primary" disabled={eligibleStudents.length === 0} onClick={pickStudent}>
              Elegir alumno
            </button>
            {pickedStudent ? (
              <div className="classroom-picked-student" role="status" aria-live="polite">
                <span>Selección actual</span>
                <strong>{formatName(pickedStudent)}</strong>
                <small>{pickedIds.size} de {eligibleStudents.length} antes de reiniciar la ronda</small>
              </div>
            ) : null}
          </section>

          <section className="classroom-control-section" aria-labelledby="groups-heading">
            <h2 id="groups-heading">Grupos rápidos</h2>
            <label className="detail-field">
              <span>Número de grupos</span>
              <input
                className="input"
                type="number"
                min={1}
                max={Math.max(1, eligibleStudents.length)}
                value={groupCount}
                onChange={(event) => setGroupCount(Math.min(Math.max(1, eligibleStudents.length), Math.max(1, Math.round(Number(event.target.value)) || 1)))}
              />
            </label>
            <button type="button" className="btn secondary" disabled={eligibleStudents.length === 0} onClick={createGroups}>
              Generar grupos
            </button>
          </section>
        </aside>

        <section className="course-detail-panel classroom-main" aria-labelledby="classroom-map-heading">
          <p className="classroom-notice" role="status" aria-live="polite">{notice}</p>
          {isLoading ? (
            <p className="empty-state" role="status">Cargando aula…</p>
          ) : !selectedClassId ? (
            <p className="empty-state">Selecciona o crea un curso para preparar su aula.</p>
          ) : data.students.length === 0 ? (
            <p className="empty-state">Añade alumnado al curso para crear el plano de aula.</p>
          ) : layout ? (
            <>
              <div className="course-detail-header">
                <div>
                  <h2 id="classroom-map-heading">Plano de aula</h2>
                  <p className="hint">Cada selector permite mover, intercambiar o quitar a un alumno sin usar arrastre.</p>
                </div>
                <span className={`pill ${capacity < data.students.length ? "warning" : ""}`}>
                  {data.students.length} alumnos · {capacity} puestos
                </span>
              </div>
              {capacity < data.students.length ? (
                <p className="notice compact" role="alert">Amplía las filas o columnas para colocar a todo el alumnado.</p>
              ) : null}
              <div className="classroom-front" aria-hidden="true">Pizarra / frente del aula</div>
              <ol
                className="classroom-seat-grid"
                style={{ "--classroom-columns": layout.columns } as CSSProperties}
                aria-label="Puestos del aula"
              >
                {Array.from({ length: capacity }, (_, seat) => {
                  const student = studentBySeat.get(seat);
                  const name = student ? formatName(student) : "Puesto vacío";
                  return (
                    <li key={seat} className={`classroom-seat ${student ? "occupied" : "empty"}`}>
                      <span className="classroom-seat-number">{seatLabel(seat, layout.columns)}</span>
                      <div className="classroom-seat-student">
                        {student?.photoDataUrl ? <img src={student.photoDataUrl} alt="" /> : <span aria-hidden="true">{student ? name.charAt(0) : "—"}</span>}
                        <strong>{name}</strong>
                        {student && data.absentStudentIds.has(student.id) ? <small>Ausente hoy</small> : null}
                      </div>
                      <label>
                        <span className="sr-only">Alumno en {seatLabel(seat, layout.columns)}</span>
                        <select className="input" value={student?.id ?? ""} onChange={(event) => void assignSeat(event.target.value, seat)}>
                          <option value="">Dejar vacío</option>
                          {data.students.map((option) => (
                            <option key={option.id} value={option.id}>{formatName(option)}</option>
                          ))}
                        </select>
                      </label>
                    </li>
                  );
                })}
              </ol>

              {groups.length > 0 ? (
                <section className="classroom-groups" aria-labelledby="generated-groups-heading">
                  <div className="course-detail-header">
                    <h2 id="generated-groups-heading">Grupos generados</h2>
                    <button type="button" className="btn secondary" onClick={createGroups}>Volver a mezclar</button>
                  </div>
                  <div className="classroom-group-grid">
                    {groups.map((group, index) => (
                      <article key={index} className="classroom-group-card">
                        <h3>Grupo {index + 1}</h3>
                        <ul>{group.map((student) => <li key={student.id}>{formatName(student)}</li>)}</ul>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </article>
  );
}
