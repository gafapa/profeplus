import { useEffect, useMemo, useState } from "react";
import {
  assignAssessmentToAcademicPeriod,
  assignTaskConfigToAcademicPeriod,
  closeAcademicPeriod,
  createAcademicPeriod,
  reopenAcademicPeriod,
  rolloverSchoolYear,
  updateManualAssessmentDate
} from "../../shared/academic/periods";
import { db } from "../../shared/db/database";
import type {
  AcademicPeriod,
  Assessment,
  GradebookPeriodSnapshot,
  Subject,
  Task,
  TaskGradebookConfig
} from "../../shared/db/types";
import { useManagement } from "./ManagementContext";

type PeriodAssignmentRow =
  | { kind: "assessment"; id: string; title: string; subjectId: string; academicPeriodId?: string }
  | { kind: "task"; id: string; title: string; subjectId: string; academicPeriodId?: string };

function suggestNextSchoolYear(currentSchoolYear: string): string {
  const match = currentSchoolYear.match(/^(\d{4})-(\d{4})$/);
  if (!match) {
    const year = new Date().getFullYear();
    return `${year + 1}-${year + 2}`;
  }
  return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`;
}

export function ManagementAcademicPeriodsPage() {
  const { courses, refreshAll } = useManagement();
  const [selectedClassId, setSelectedClassId] = useState("");
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [taskConfigs, setTaskConfigs] = useState<TaskGradebookConfig[]>([]);
  const [snapshots, setSnapshots] = useState<GradebookPeriodSnapshot[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [periodName, setPeriodName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [rolloverMode, setRolloverMode] = useState<"new" | "existing">("new");
  const [targetClassId, setTargetClassId] = useState("");
  const [targetName, setTargetName] = useState("");
  const [targetSchoolYear, setTargetSchoolYear] = useState("");
  const [rolloverConfirmed, setRolloverConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const selectedClass = courses.find((course) => course.id === selectedClassId) ?? null;
  const periodById = useMemo(() => new Map(periods.map((period) => [period.id, period])), [periods]);
  const subjectNameById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject.name])),
    [subjects]
  );
  const taskNameById = useMemo(() => new Map(tasks.map((task) => [task.id, task.title])), [tasks]);
  const snapshotsByPeriodId = useMemo(() => {
    const map = new Map<string, GradebookPeriodSnapshot[]>();
    for (const snapshot of snapshots) {
      if (!map.has(snapshot.academicPeriodId)) {
        map.set(snapshot.academicPeriodId, []);
      }
      map.get(snapshot.academicPeriodId)?.push(snapshot);
    }
    return map;
  }, [snapshots]);
  const assignmentRows = useMemo<PeriodAssignmentRow[]>(
    () => [
      ...assessments.map((assessment) => ({
        kind: "assessment" as const,
        id: assessment.id,
        title: assessment.title,
        subjectId: assessment.subjectId,
        academicPeriodId: assessment.academicPeriodId
      })),
      ...taskConfigs.map((config) => ({
        kind: "task" as const,
        id: config.id,
        title: taskNameById.get(config.taskId) ?? "Tarea sin título",
        subjectId: config.subjectId,
        academicPeriodId: config.academicPeriodId
      }))
    ].sort((a, b) => {
      const bySubject = (subjectNameById.get(a.subjectId) ?? "").localeCompare(
        subjectNameById.get(b.subjectId) ?? ""
      );
      return bySubject || a.title.localeCompare(b.title);
    }),
    [assessments, subjectNameById, taskConfigs, taskNameById]
  );

  const loadData = async (classId: string): Promise<void> => {
    if (!classId) {
      setPeriods([]);
      setAssessments([]);
      setTaskConfigs([]);
      setSnapshots([]);
      return;
    }
    const [periodRows, assessmentRows, configRows, snapshotRows, allSubjects, allTasks] =
      await Promise.all([
        db.academicPeriods.where("classId").equals(classId).sortBy("position"),
        db.assessments.where("classId").equals(classId).toArray(),
        db.taskGradebookConfigs.where("classId").equals(classId).toArray(),
        db.gradebookPeriodSnapshots.where("classId").equals(classId).reverse().sortBy("createdAt"),
        db.subjects.orderBy("name").toArray(),
        db.tasks.toArray()
      ]);
    setPeriods(periodRows);
    setAssessments(assessmentRows);
    setTaskConfigs(configRows);
    setSnapshots(snapshotRows);
    setSubjects(allSubjects);
    setTasks(allTasks);
  };

  useEffect(() => {
    if (!courses.length) {
      setSelectedClassId("");
      return;
    }
    if (!courses.some((course) => course.id === selectedClassId)) {
      setSelectedClassId(courses[0].id);
    }
  }, [courses, selectedClassId]);

  useEffect(() => {
    void loadData(selectedClassId).catch((error: unknown) => {
      setNotice(error instanceof Error ? error.message : "No se pudieron cargar los periodos.");
    });
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClass) return;
    setTargetName(selectedClass.name);
    setTargetSchoolYear(suggestNextSchoolYear(selectedClass.schoolYear));
    setTargetClassId("");
    setRolloverConfirmed(false);
  }, [selectedClass]);

  const runAction = async (action: () => Promise<void>, successMessage: string): Promise<void> => {
    setIsBusy(true);
    setNotice("");
    try {
      await action();
      await loadData(selectedClassId);
      setNotice(successMessage);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo completar la operación.");
    } finally {
      setIsBusy(false);
    }
  };

  const createPeriod = async (): Promise<void> => {
    if (!selectedClassId) return;
    await runAction(async () => {
      await createAcademicPeriod(selectedClassId, {
        name: periodName,
        startDate: periodStart,
        endDate: periodEnd
      });
      setPeriodName("");
      setPeriodStart("");
      setPeriodEnd("");
    }, "Periodo académico creado.");
  };

  const changeAssignment = async (row: PeriodAssignmentRow, academicPeriodId: string): Promise<void> => {
    await runAction(async () => {
      if (row.kind === "assessment") {
        await assignAssessmentToAcademicPeriod(row.id, academicPeriodId || undefined);
      } else {
        await assignTaskConfigToAcademicPeriod(row.id, academicPeriodId || undefined);
      }
    }, "Asignación de periodo actualizada.");
  };

  const closePeriod = async (period: AcademicPeriod): Promise<void> => {
    if (!window.confirm(`Se creará una instantánea inmutable de "${period.name}". ¿Cerrar el periodo?`)) {
      return;
    }
    await runAction(async () => {
      await closeAcademicPeriod(period.id);
    }, "Periodo cerrado e instantánea guardada.");
  };

  const reopenPeriod = async (period: AcademicPeriod): Promise<void> => {
    if (!window.confirm(`La instantánea anterior se conservará. ¿Reabrir "${period.name}"?`)) {
      return;
    }
    await runAction(async () => {
      await reopenAcademicPeriod(period.id);
    }, "Periodo reabierto. El próximo cierre creará una nueva versión.");
  };

  const runRollover = async (): Promise<void> => {
    if (!selectedClass || !rolloverConfirmed) return;
    await runAction(async () => {
      const targetClass = await rolloverSchoolYear({
        sourceClassId: selectedClass.id,
        targetClassId: rolloverMode === "existing" ? targetClassId : undefined,
        targetName,
        targetSchoolYear
      });
      await refreshAll();
      setSelectedClassId(targetClass.id);
      setRolloverConfirmed(false);
    }, "Promoción completada. El curso histórico permanece sin cambios.");
  };

  return (
    <article className="management-card academic-periods-page">
      <h1 className="sr-only">Periodos académicos y cierre de curso</h1>
      <div className="courses-layout">
        <aside className="courses-list-panel">
          <div className="courses-list-header">
            <strong>Curso</strong>
          </div>
          <div className="courses-list section-tabs" role="group" aria-label="Curso para periodos académicos">
            {courses.map((course) => (
              <button
                key={course.id}
                type="button"
                className={`section-tab ${selectedClassId === course.id ? "active" : ""}`}
                aria-pressed={selectedClassId === course.id}
                onClick={() => setSelectedClassId(course.id)}
              >
                <span>{course.name}</span>
                <small>{course.schoolYear}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="course-detail-panel">
          <header className="workflow-page-header">
            <div>
              <h2>Periodos y cierre</h2>
              <p>{selectedClass ? `${selectedClass.name} · ${selectedClass.schoolYear}` : "Selecciona un curso"}</p>
            </div>
          </header>

          {notice ? <p className="notice" role="status" aria-live="polite">{notice}</p> : null}

          {selectedClass ? (
            <>
              <section className="detail-section">
                <div className="course-detail-header">
                  <div>
                    <h3>Periodos académicos</h3>
                    <p className="hint">Los periodos no pueden solaparse. Cerrar crea una instantánea versionada.</p>
                  </div>
                </div>
                <div className="detail-grid academic-period-create-grid">
                  <label className="detail-field">
                    <span>Nombre</span>
                    <input className="input" value={periodName} onChange={(event) => setPeriodName(event.target.value)} placeholder="1ª evaluación" />
                  </label>
                  <label className="detail-field">
                    <span>Desde</span>
                    <input className="input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
                  </label>
                  <label className="detail-field">
                    <span>Hasta</span>
                    <input className="input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
                  </label>
                  <button type="button" className="btn primary" disabled={isBusy || !periodName.trim() || !periodStart || !periodEnd} onClick={() => void createPeriod()}>
                    Crear periodo
                  </button>
                </div>
                <div className="academic-period-card-list">
                  {periods.map((period) => {
                    const periodSnapshots = snapshotsByPeriodId.get(period.id) ?? [];
                    return (
                      <article key={period.id} className="academic-period-card">
                        <div>
                          <strong>{period.name}</strong>
                          <span>{period.startDate} — {period.endDate}</span>
                          <small>
                            {period.status === "closed" ? "Cerrado" : "Abierto"} · {periodSnapshots.length} instantáneas
                            {period.currentSnapshotId ? ` · versión ${period.closureVersion}` : ""}
                          </small>
                        </div>
                        {period.status === "open" ? (
                          <button type="button" className="btn primary" disabled={isBusy} onClick={() => void closePeriod(period)}>
                            Cerrar
                          </button>
                        ) : (
                          <button type="button" className="btn secondary" disabled={isBusy} onClick={() => void reopenPeriod(period)}>
                            Reabrir
                          </button>
                        )}
                      </article>
                    );
                  })}
                  {periods.length === 0 ? <p className="empty-state">Aún no hay periodos definidos.</p> : null}
                </div>
              </section>

              <section className="detail-section">
                <h3>Asignación de elementos evaluables</h3>
                <p className="hint">Las asignaciones de un periodo cerrado quedan bloqueadas hasta reabrirlo.</p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Asignatura</th>
                        <th>Elemento</th>
                        <th>Periodo</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignmentRows.map((row) => {
                        const currentPeriod = row.academicPeriodId ? periodById.get(row.academicPeriodId) : null;
                        return (
                          <tr key={`${row.kind}:${row.id}`}>
                            <td>{row.kind === "assessment" ? "Prueba" : "Tarea"}</td>
                            <td>{subjectNameById.get(row.subjectId) ?? "Asignatura"}</td>
                            <td>{row.title}</td>
                            <td>
                              <select
                                className="input"
                                value={row.academicPeriodId ?? ""}
                                disabled={isBusy || currentPeriod?.status === "closed"}
                                aria-label={`Periodo de ${row.title}`}
                                onChange={(event) => void changeAssignment(row, event.target.value)}
                              >
                                <option value="">Sin periodo</option>
                                {periods.map((period) => (
                                  <option key={period.id} value={period.id} disabled={period.status === "closed" && period.id !== row.academicPeriodId}>
                                    {period.name} · {period.status === "closed" ? "cerrado" : "abierto"}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              {row.kind === "assessment" ? (
                                <input
                                  className="input"
                                  type="date"
                                  value={assessments.find((assessment) => assessment.id === row.id)?.assessmentDate ?? ""}
                                  disabled={isBusy || currentPeriod?.status === "closed"}
                                  min={currentPeriod?.startDate}
                                  max={currentPeriod?.endDate}
                                  aria-label={`Fecha de ${row.title}`}
                                  onChange={(event) => {
                                    const assessmentDate = event.target.value;
                                    if (!assessmentDate) return;
                                    void runAction(
                                      () => updateManualAssessmentDate(row.id, assessmentDate),
                                      "Fecha de prueba actualizada."
                                    );
                                  }}
                                />
                              ) : (
                                <span className="hint">Según sesiones</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {assignmentRows.length === 0 ? (
                        <tr><td colSpan={5}>No hay pruebas ni tareas configuradas en el cuaderno.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="detail-section">
                <h3>Promoción al siguiente curso</h3>
                <p className="hint">
                  Copia alumnado, asignaturas, unidades, tareas, instrumentos, periodos y estructura del cuaderno.
                  No copia notas, asistencia, sesiones, seguimientos ni instantáneas históricas.
                </p>
                <div className="inline-form">
                  <label>
                    <input type="radio" name="rollover-mode" checked={rolloverMode === "new"} onChange={() => setRolloverMode("new")} />
                    Crear curso
                  </label>
                  <label>
                    <input type="radio" name="rollover-mode" checked={rolloverMode === "existing"} onChange={() => setRolloverMode("existing")} />
                    Usar curso vacío
                  </label>
                </div>
                {rolloverMode === "new" ? (
                  <div className="detail-grid">
                    <label className="detail-field">
                      <span>Nombre del nuevo curso</span>
                      <input className="input" value={targetName} onChange={(event) => setTargetName(event.target.value)} />
                    </label>
                    <label className="detail-field">
                      <span>Curso escolar</span>
                      <input className="input" value={targetSchoolYear} onChange={(event) => setTargetSchoolYear(event.target.value)} />
                    </label>
                  </div>
                ) : (
                  <label className="detail-field">
                    <span>Curso de destino</span>
                    <select className="input" value={targetClassId} onChange={(event) => setTargetClassId(event.target.value)}>
                      <option value="">Selecciona un curso vacío</option>
                      {courses.filter((course) => course.id !== selectedClassId).map((course) => (
                        <option key={course.id} value={course.id}>{course.name} · {course.schoolYear}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="academic-rollover-confirmation">
                  <input
                    type="checkbox"
                    checked={rolloverConfirmed}
                    onChange={(event) => setRolloverConfirmed(event.target.checked)}
                  />
                  Confirmo que quiero crear una copia estructural sin modificar el curso histórico.
                </label>
                <button
                  type="button"
                  className="btn primary"
                  disabled={
                    isBusy ||
                    !rolloverConfirmed ||
                    (rolloverMode === "new" ? !targetName.trim() || !targetSchoolYear.trim() : !targetClassId)
                  }
                  onClick={() => void runRollover()}
                >
                  Promocionar curso
                </button>
              </section>
            </>
          ) : (
            <p className="empty-state">Crea un curso antes de definir periodos académicos.</p>
          )}
        </section>
      </div>
    </article>
  );
}
