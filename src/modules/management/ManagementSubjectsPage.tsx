import { useCallback, useEffect, useMemo, useState } from "react";
import { useManagement } from "./ManagementContext";
import { Modal } from "../../shared/ui/Modal";
import { useStudentDisplay } from "../../shared/hooks/useStudentDisplay";
import { IconButton } from "../../shared/ui/IconButton";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";

export function ManagementSubjectsPage() {
  const { formatName } = useStudentDisplay();
  const {
    subjects,
    courses,
    scheduleDays,
    subjectCourseLinks,
    createEmptySubject,
    updateSubject,
    deleteSubject,
    getEnrollmentRows,
    setStudentEnrollment,
    bulkAssignCourseStudentsToSubject,
    setNotice
  } = useManagement();

  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [detailName, setDetailName] = useState("");
  const [detailTeachingHours, setDetailTeachingHours] = useState("");
  const [detailCourseId, setDetailCourseId] = useState("");
  const [detailScheduleSlotIds, setDetailScheduleSlotIds] = useState<string[]>([]);
  const [subjectDirty, setSubjectDirty] = useState(false);
  useUnsavedChangesGuard(subjectDirty, "Hay cambios de la asignatura sin guardar.");

  const [isAddStudentsModalOpen, setIsAddStudentsModalOpen] = useState(false);
  const [addSearchTerm, setAddSearchTerm] = useState("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
    }
    const exists = subjects.some((subject) => subject.id === selectedSubjectId);
    if (!exists && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [selectedSubjectId, subjects]);

  const courseMap = useMemo(() => new Map(courses.map((item) => [item.id, item])), [courses]);
  const courseIdsBySubject = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const subject of subjects) {
      map.set(subject.id, []);
    }
    for (const link of subjectCourseLinks) {
      const arr = map.get(link.subjectId) ?? [];
      arr.push(link.classId);
      map.set(link.subjectId, arr);
    }
    return map;
  }, [subjectCourseLinks, subjects]);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjects]
  );
  const allScheduleSlotIds = useMemo(() => {
    const ids = new Set<string>();
    for (const day of scheduleDays) {
      for (const block of day.blocks) {
        if (block.isBreak) continue;
        ids.add(block.id);
      }
    }
    return ids;
  }, [scheduleDays]);
  const activeScheduleDays = useMemo(
    () => scheduleDays.filter((day) => day.enabled),
    [scheduleDays]
  );
  const occupiedSlotsByOtherSubjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const subject of subjects) {
      if (subject.id === selectedSubjectId) continue;
      for (const slotId of subject.scheduleSlotIds ?? []) {
        if (!map.has(slotId)) map.set(slotId, subject.name);
      }
    }
    return map;
  }, [selectedSubjectId, subjects]);
  const conflictingSelectedSlotIds = useMemo(
    () => detailScheduleSlotIds.filter((slotId) => occupiedSlotsByOtherSubjects.has(slotId)),
    [detailScheduleSlotIds, occupiedSlotsByOtherSubjects]
  );
  const orphanSelectedSlotIds = useMemo(
    () => detailScheduleSlotIds.filter((slotId) => !allScheduleSlotIds.has(slotId)),
    [allScheduleSlotIds, detailScheduleSlotIds]
  );

  useEffect(() => {
    if (!selectedSubject) {
      setDetailName("");
      setDetailTeachingHours("");
      setDetailCourseId("");
      setDetailScheduleSlotIds([]);
      setSubjectDirty(false);
      return;
    }
    setDetailName(selectedSubject.name);
    setDetailTeachingHours(selectedSubject.teachingHours ?? "");
    setDetailCourseId(courseIdsBySubject.get(selectedSubject.id)?.[0] ?? "");
    setDetailScheduleSlotIds(selectedSubject.scheduleSlotIds ?? []);
    setSubjectDirty(false);
  }, [courseIdsBySubject, selectedSubject]);

  // Debounced autosave. Context actions are intentionally omitted because their references are unstable.
  useEffect(() => {
    if (!subjectDirty || !selectedSubject) return;
    const name = detailName.trim();
    if (name.length < 2) return;
    const normalizedSlotIds = detailScheduleSlotIds.filter((id) => allScheduleSlotIds.has(id));
    const hasConflicts = normalizedSlotIds.some((id) => occupiedSlotsByOtherSubjects.has(id));
    if (hasConflicts) return;
    const id = selectedSubject.id;
    const hours = detailTeachingHours;
    const courseId = detailCourseId;
    const timer = setTimeout(() => {
      void updateSubject(id, name, hours, normalizedSlotIds, courseId).then((saved) => {
        if (saved) setSubjectDirty(false);
      });
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectDirty, detailName, detailTeachingHours, detailScheduleSlotIds, detailCourseId, selectedSubject?.id]);

  const saveIfDirty = useCallback(async (): Promise<boolean> => {
    if (!subjectDirty || !selectedSubject) return true;
    const name = detailName.trim();
    const normalizedSlotIds = detailScheduleSlotIds.filter((id) => allScheduleSlotIds.has(id));
    const hasConflicts = normalizedSlotIds.some((id) => occupiedSlotsByOtherSubjects.has(id));
    if (hasConflicts) return false;
    const saved = await updateSubject(selectedSubject.id, name, detailTeachingHours, normalizedSlotIds, detailCourseId);
    if (saved) setSubjectDirty(false);
    return saved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectDirty, detailName, detailTeachingHours, detailScheduleSlotIds, detailCourseId, selectedSubject?.id, allScheduleSlotIds, occupiedSlotsByOtherSubjects]);

  const rows = useMemo(() => getEnrollmentRows(selectedSubjectId), [getEnrollmentRows, selectedSubjectId]);
  const assignedRows = useMemo(() => rows.filter((row) => row.effectiveIncluded), [rows]);
  const candidateRows = useMemo(() => {
    const search = addSearchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.effectiveIncluded) return false;
      const byCourse = row.student.classId === detailCourseId;
      const bySearch = search.length === 0 ? true : formatName(row.student).toLowerCase().includes(search);
      return byCourse && bySearch;
    });
  }, [addSearchTerm, detailCourseId, formatName, rows]);

  useEffect(() => {
    if (!isAddStudentsModalOpen) {
      setSelectedCandidateIds([]);
      setAddSearchTerm("");
    }
  }, [isAddStudentsModalOpen]);

  const toggleSlot = (slotId: string, value: string[], setter: (next: string[]) => void) => {
    if (value.includes(slotId)) {
      setter(value.filter((item) => item !== slotId));
    } else {
      setter([...value, slotId]);
    }
  };

  const toggleCandidate = (studentId: string) => {
    if (selectedCandidateIds.includes(studentId)) {
      setSelectedCandidateIds(selectedCandidateIds.filter((id) => id !== studentId));
    } else {
      setSelectedCandidateIds([...selectedCandidateIds, studentId]);
    }
  };

  const cleanOrphanSlots = () => {
    if (orphanSelectedSlotIds.length === 0) return;
    setDetailScheduleSlotIds((current) => current.filter((slotId) => allScheduleSlotIds.has(slotId)));
    setSubjectDirty(true);
    setNotice(`Se han quitado ${orphanSelectedSlotIds.length} horas antiguas que no existen en el horario actual.`);
  };

  const reassignOrphanSlotsAutomatically = () => {
    const orphanCount = orphanSelectedSlotIds.length;
    if (orphanCount === 0) return;

    const baseSlotIds = detailScheduleSlotIds.filter((slotId) => allScheduleSlotIds.has(slotId));
    const nextSlotIds = [...baseSlotIds];
    const selectedSet = new Set(baseSlotIds);
    const candidateSlotIds = activeScheduleDays.flatMap((day) =>
      day.blocks.filter((block) => !block.isBreak).map((block) => block.id)
    );

    for (const slotId of candidateSlotIds) {
      if (selectedSet.has(slotId)) continue;
      if (occupiedSlotsByOtherSubjects.has(slotId)) continue;
      nextSlotIds.push(slotId);
      selectedSet.add(slotId);
      if (nextSlotIds.length >= baseSlotIds.length + orphanCount) break;
    }

    setDetailScheduleSlotIds(nextSlotIds);
    setSubjectDirty(true);
    if (nextSlotIds.length < baseSlotIds.length + orphanCount) {
      setNotice(`Se pudieron reasignar ${nextSlotIds.length - baseSlotIds.length} de ${orphanCount} horas. Revisa y ajusta manualmente.`);
      return;
    }
    setNotice(`Se han reasignado automaticamente ${orphanCount} horas. Revisa y guarda la asignatura.`);
  };

  return (
    <article className="management-card">
      <h1 className="sr-only">Asignaturas</h1>
      <div className="courses-layout">
        <aside className="courses-list-panel">
          <div className="courses-list-header">
            <strong>Listado</strong>
            <IconButton
              icon="add"
              label="Crear asignatura"
              onClick={async () => {
                if (!(await saveIfDirty())) return;
                const createdId = await createEmptySubject(detailCourseId);
                if (createdId) setSelectedSubjectId(createdId);
              }}
            />
          </div>
          <div className="courses-list section-tabs" role="group" aria-label="Secciones de asignaturas">
            {subjects.map((subject) => {
              const ids = courseIdsBySubject.get(subject.id) ?? [];
              const validSlotCount = (subject.scheduleSlotIds ?? []).filter((slotId) =>
                allScheduleSlotIds.has(slotId)
              ).length;
              return (
                <div key={subject.id} className="courses-list-row">
                  <button
                    type="button"
                    aria-pressed={selectedSubjectId === subject.id}
                    className={`section-tab ${selectedSubjectId === subject.id ? "active" : ""}`}
                    onClick={async () => {
                      if (!(await saveIfDirty())) return;
                      setSelectedSubjectId(subject.id);
                    }}
                  >
                    <span>{subject.name}</span>
                    <small>{courseMap.get(ids[0])?.name ?? "Sin curso"}</small>
                    <small>{validSlotCount} bloques marcados</small>
                  </button>
                  <IconButton
                    icon="delete"
                    label={`Eliminar ${subject.name || "asignatura"}`}
                    onClick={async () => {
                      if (!(await saveIfDirty())) return;
                      await deleteSubject(subject.id);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </aside>

        <section className="course-detail-panel">
          {selectedSubject ? (
            <>
              <div className="course-detail-header">
                <div>
                  <h2>Detalle de asignatura</h2>
                </div>
              </div>

              <div className="detail-summary">
                <span className="pill">{assignedRows.length} alumnos</span>
                <span className="pill">{detailScheduleSlotIds.length} horas marcadas</span>
              </div>

              <section className="detail-section">
                <h3>Datos de asignatura</h3>
                <div className="detail-grid">
                  <div className="detail-field full">
                    <label>Nombre</label>
                    <input
                      className="input"
                      placeholder="Nombre de asignatura"
                      value={detailName}
                      onChange={(event) => {
                        setDetailName(event.target.value);
                        setSubjectDirty(true);
                      }}
                    />
                  </div>
                </div>
              </section>

              <section className="detail-section">
                <h3>Curso</h3>
                <div className="detail-field full">
                  <label htmlFor="subject-course">Curso de la asignatura</label>
                  <select
                    id="subject-course"
                    className="input"
                    value={detailCourseId}
                    required
                    onChange={(event) => {
                      setDetailCourseId(event.target.value);
                      setSubjectDirty(true);
                    }}
                  >
                    <option value="">Selecciona un curso</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                </div>
              </section>

              <section className="detail-section">
                <h3>Horario de impartición</h3>
                {orphanSelectedSlotIds.length > 0 ? (
                  <div className="hint">
                    Esta asignatura tiene {orphanSelectedSlotIds.length} horas antiguas que ya no existen en el horario.
                    <div className="inline-form tight">
                      <button type="button" className="btn secondary" onClick={cleanOrphanSlots}>
                        Limpiar horas antiguas
                      </button>
                      <button type="button" className="btn secondary" onClick={reassignOrphanSlotsAutomatically}>
                        Reasignar automaticamente
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="schedule-grid-wrap">
                  <div className="schedule-grid">
                    {activeScheduleDays.map((day) => (
                      <div className="schedule-day-card" key={day.id}>
                        <strong>{day.dayName}</strong>
                        <div className="schedule-slot-list">
                          {day.blocks.map((block) => {
                            const slotId = block.id;
                            const occupiedBy = occupiedSlotsByOtherSubjects.get(slotId);
                            const isActive = detailScheduleSlotIds.includes(slotId);
                            const isBreak = Boolean(block.isBreak);
                            const isBlocked = Boolean(occupiedBy) && !isActive;
                            return (
                              <button
                                key={slotId}
                                type="button"
                                className={`schedule-slot-pill ${isActive ? "active" : ""} ${isBlocked ? "blocked" : ""} ${isBreak ? "break" : ""}`}
                                title={isBreak ? "Descanso" : occupiedBy ? `Ocupado por ${occupiedBy}` : undefined}
                                disabled={isBlocked || isBreak}
                                onClick={() => {
                                  if (isBlocked || isBreak) return;
                                  toggleSlot(slotId, detailScheduleSlotIds, setDetailScheduleSlotIds);
                                  setSubjectDirty(true);
                                }}
                              >
                                {block.isBreak ? "Descanso" : block.startTime}
                              </button>
                            );
                          })}
                          {day.blocks.length === 0 ? <small>Sin bloques</small> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {conflictingSelectedSlotIds.length > 0 ? (
                  <p className="hint">
                    Hay bloques en conflicto con otras asignaturas. Debes quitarlos para poder guardar.
                  </p>
                ) : null}
              </section>

              <section className="detail-section">
                <div className="course-detail-header">
                  <h3>Alumnos de la asignatura</h3>
                  <div className="inline-form flush">
                    <button
                      type="button"
                      className="btn secondary compact-link"
                      disabled={!detailCourseId || assignedRows.length >= rows.filter((row) => row.student.classId === detailCourseId).length}
                      onClick={async () => {
                        if (!(await saveIfDirty()) || !detailCourseId) return;
                        await bulkAssignCourseStudentsToSubject(detailCourseId, selectedSubject.id);
                      }}
                    >
                      Asignar todo el curso
                    </button>
                    <IconButton
                      icon="add"
                      label="Añadir alumnos"
                      onClick={async () => {
                        if (!(await saveIfDirty())) return;
                        setIsAddStudentsModalOpen(true);
                      }}
                    />
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Alumno</th>
                        <th>Curso</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedRows.map((row) => (
                        <tr key={row.student.id}>
                          <td>{formatName(row.student)}</td>
                          <td>{row.courseName}</td>
                          <td className="actions-cell">
                            <IconButton
                              icon="remove"
                              label="Quitar alumno"
                              onClick={async () => {
                                if (!(await saveIfDirty())) return;
                                await setStudentEnrollment(selectedSubject.id, row.student.id, false);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                      {assignedRows.length === 0 ? (
                        <tr>
                          <td colSpan={3}>No hay alumnos asignados.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <p className="empty-state">No hay asignaturas para mostrar.</p>
          )}
        </section>
      </div>

      <Modal
        open={isAddStudentsModalOpen && selectedSubject !== null}
        title={`Añadir alumnos a ${selectedSubject?.name ?? "asignatura"}`}
        onClose={() => setIsAddStudentsModalOpen(false)}
      >
        <div className="inline-form">
          <input
            className="input"
            placeholder="Buscar alumno..."
            aria-label="Buscar alumno"
            value={addSearchTerm}
            onChange={(event) => setAddSearchTerm(event.target.value)}
          />
          <IconButton
            icon="assign"
            label="Seleccionar todos"
            onClick={() => setSelectedCandidateIds(candidateRows.map((row) => row.student.id))}
            disabled={candidateRows.length === 0}
          />
          <IconButton
            icon="remove"
            label="Limpiar seleccion"
            onClick={() => setSelectedCandidateIds([])}
            disabled={selectedCandidateIds.length === 0}
          />
          <IconButton
            icon="save"
            label="Añadir seleccionados"
            onClick={async () => {
              if (!selectedSubject || selectedCandidateIds.length === 0) return;
              for (const studentId of selectedCandidateIds) {
                await setStudentEnrollment(selectedSubject.id, studentId, true);
              }
              setIsAddStudentsModalOpen(false);
            }}
            disabled={selectedCandidateIds.length === 0}
          />
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Alumno</th>
                <th>Curso</th>
              </tr>
            </thead>
            <tbody>
              {candidateRows.map((row) => (
                <tr key={row.student.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${formatName(row.student)}`}
                      checked={selectedCandidateIds.includes(row.student.id)}
                      onChange={() => toggleCandidate(row.student.id)}
                    />
                  </td>
                  <td>{formatName(row.student)}</td>
                  <td>{row.courseName}</td>
                </tr>
              ))}
              {candidateRows.length === 0 ? (
                <tr>
                  <td colSpan={3}>No hay alumnos disponibles con esos filtros.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Modal>
    </article>
  );
}
