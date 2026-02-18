import { useCallback, useEffect, useMemo, useState } from "react";
import { useManagement } from "./ManagementContext";
import { Modal } from "../../shared/ui/Modal";
import { getStudentFullName } from "../../shared/utils/student";
import { IconButton } from "../../shared/ui/IconButton";

export function ManagementSubjectsPage() {
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
    setNotice
  } = useManagement();

  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [detailName, setDetailName] = useState("");
  const [detailTeachingHours, setDetailTeachingHours] = useState("");
  const [detailCourseIds, setDetailCourseIds] = useState<string[]>([]);
  const [detailScheduleSlotIds, setDetailScheduleSlotIds] = useState<string[]>([]);
  const [subjectDirty, setSubjectDirty] = useState(false);

  const [isAddStudentsModalOpen, setIsAddStudentsModalOpen] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [addFilterCourseId, setAddFilterCourseId] = useState("all");
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
  const activeScheduleDays = useMemo(
    () => scheduleDays.filter((day) => day.enabled),
    [scheduleDays]
  );
  const occupiedSlotsByOtherSubjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const subject of subjects) {
      if (subject.id === selectedSubjectId) {
        continue;
      }
      for (const slotId of subject.scheduleSlotIds ?? []) {
        if (!map.has(slotId)) {
          map.set(slotId, subject.name);
        }
      }
    }
    return map;
  }, [selectedSubjectId, subjects]);
  const conflictingSelectedSlotIds = useMemo(
    () => detailScheduleSlotIds.filter((slotId) => occupiedSlotsByOtherSubjects.has(slotId)),
    [detailScheduleSlotIds, occupiedSlotsByOtherSubjects]
  );

  useEffect(() => {
    if (!selectedSubject) {
      setDetailName("");
      setDetailTeachingHours("");
      setDetailCourseIds([]);
      setDetailScheduleSlotIds([]);
      setSubjectDirty(false);
      return;
    }
    setDetailName(selectedSubject.name);
    setDetailTeachingHours(selectedSubject.teachingHours ?? "");
    setDetailCourseIds(courseIdsBySubject.get(selectedSubject.id) ?? []);
    setDetailScheduleSlotIds(selectedSubject.scheduleSlotIds ?? []);
    setSubjectDirty(false);
  }, [courseIdsBySubject, selectedSubject]);

  const persistSubject = useCallback(async (): Promise<boolean> => {
    if (!selectedSubject || !subjectDirty) {
      return true;
    }
    if (detailName.trim().length < 2) {
      setNotice("La asignatura necesita al menos 2 caracteres.");
      return false;
    }
    if (conflictingSelectedSlotIds.length > 0) {
      setNotice("Hay horas en conflicto con otra asignatura. Libera esos bloques antes de guardar.");
      return false;
    }

    await updateSubject(
      selectedSubject.id,
      detailName,
      detailTeachingHours,
      detailScheduleSlotIds,
      detailCourseIds
    );
    setSubjectDirty(false);
    return true;
  }, [
    detailCourseIds,
    detailName,
    detailScheduleSlotIds,
    detailTeachingHours,
    conflictingSelectedSlotIds.length,
    selectedSubject,
    setNotice,
    subjectDirty,
    updateSubject
  ]);

  const ensureNoPendingChanges = (): boolean => {
    if (!subjectDirty) {
      return true;
    }
    setShowUnsavedModal(true);
    return false;
  };

  const rows = useMemo(() => getEnrollmentRows(selectedSubjectId), [getEnrollmentRows, selectedSubjectId]);
  const assignedRows = useMemo(() => rows.filter((row) => row.effectiveIncluded), [rows]);
  const candidateRows = useMemo(() => {
    const search = addSearchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.effectiveIncluded) {
        return false;
      }
      const byCourse = addFilterCourseId === "all" ? true : row.student.classId === addFilterCourseId;
      const bySearch =
        search.length === 0 ? true : getStudentFullName(row.student).toLowerCase().includes(search);
      return byCourse && bySearch;
    });
  }, [addFilterCourseId, addSearchTerm, rows]);

  useEffect(() => {
    if (!isAddStudentsModalOpen) {
      setSelectedCandidateIds([]);
      setAddFilterCourseId("all");
      setAddSearchTerm("");
    }
  }, [isAddStudentsModalOpen]);

  const toggleCourse = (courseId: string, setter: (next: string[] | ((prev: string[]) => string[])) => void) => {
    setter((prev) => (prev.includes(courseId) ? prev.filter((item) => item !== courseId) : [...prev, courseId]));
  };

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

  return (
    <article className="management-card">
      <h3>Asignaturas</h3>

      <div className="courses-layout">
        <aside className="courses-list-panel">
          <div className="courses-list-header">
            <strong>Listado</strong>
            <IconButton
              icon="add"
              label="Crear asignatura"
              onClick={async () => {
                if (!ensureNoPendingChanges()) {
                  return;
                }
                const createdId = await createEmptySubject(detailCourseIds);
                if (createdId) {
                  setSelectedSubjectId(createdId);
                }
              }}
            />
          </div>
          <div className="courses-list section-tabs" role="tablist" aria-label="Secciones de asignaturas">
            {subjects.map((subject) => {
              const ids = courseIdsBySubject.get(subject.id) ?? [];
              return (
                <div key={subject.id} className="courses-list-row">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedSubjectId === subject.id}
                    className={`section-tab ${selectedSubjectId === subject.id ? "active" : ""}`}
                    onClick={() => {
                      if (!ensureNoPendingChanges()) {
                        return;
                      }
                      setSelectedSubjectId(subject.id);
                    }}
                  >
                    <span>{subject.name}</span>
                    <small>{ids.map((id) => courseMap.get(id)?.name ?? "-").join(", ")}</small>
                    <small>{subject.scheduleSlotIds?.length ?? 0} bloques marcados</small>
                  </button>
                  <IconButton
                    icon="delete"
                    label={`Eliminar ${subject.name || "asignatura"}`}
                    onClick={async () => {
                      if (!ensureNoPendingChanges()) {
                        return;
                      }
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
                  <h4>Detalle de asignatura</h4>
                </div>
                <div className="actions-cell">
                  <IconButton
                    icon="save"
                    label="Guardar asignatura"
                    className={subjectDirty ? "save-attention" : ""}
                    disabled={!subjectDirty}
                    onClick={async () => {
                      await persistSubject();
                    }}
                  />
                </div>
              </div>

              <div className="detail-summary">
                <span className="pill">{assignedRows.length} alumnos</span>
                <span className="pill">{detailScheduleSlotIds.length} horas marcadas</span>
              </div>

              <section className="detail-section">
                <h5>Datos de asignatura</h5>
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
                <h5>Cursos asociados</h5>
                <div className="chips-wrap">
                  {courses.map((course) => (
                    <label className="chip-toggle" key={course.id}>
                      <input
                        type="checkbox"
                        checked={detailCourseIds.includes(course.id)}
                        onChange={() => {
                          toggleCourse(course.id, setDetailCourseIds);
                          setSubjectDirty(true);
                        }}
                      />
                      {course.name}
                    </label>
                  ))}
                </div>
              </section>

              <section className="detail-section">
                <h5>Horario de impartición</h5>
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
                            const isBlocked = Boolean(occupiedBy) && !isActive;
                            return (
                              <button
                                key={slotId}
                                type="button"
                                className={`schedule-slot-pill ${
                                  isActive ? "active" : ""
                                } ${isBlocked ? "blocked" : ""}`}
                                title={occupiedBy ? `Ocupado por ${occupiedBy}` : undefined}
                                disabled={isBlocked}
                                onClick={() => {
                                  if (isBlocked) {
                                    return;
                                  }
                                  toggleSlot(slotId, detailScheduleSlotIds, setDetailScheduleSlotIds);
                                  setSubjectDirty(true);
                                }}
                              >
                                {block.startTime}
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
                  <p className="hint" style={{ marginTop: 8 }}>
                    Hay bloques en conflicto con otras asignaturas. Debes quitarlos para poder guardar.
                  </p>
                ) : null}
              </section>

              <section className="detail-section">
                <div className="course-detail-header">
                  <h5>Alumnos de la asignatura</h5>
                  <IconButton
                    icon="add"
                    label="Añadir alumnos"
                    onClick={() => {
                      if (!ensureNoPendingChanges()) {
                        return;
                      }
                      setIsAddStudentsModalOpen(true);
                    }}
                  />
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
                          <td>{getStudentFullName(row.student)}</td>
                          <td>{row.courseName}</td>
                          <td className="actions-cell">
                            <IconButton
                              icon="remove"
                              label="Quitar alumno"
                              onClick={async () => {
                                if (!ensureNoPendingChanges()) {
                                  return;
                                }
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
            <p>No hay asignaturas para mostrar.</p>
          )}
        </section>
      </div>

      <Modal
        open={isAddStudentsModalOpen && selectedSubject !== null}
        title={`Añadir alumnos a ${selectedSubject?.name ?? "asignatura"}`}
        onClose={() => setIsAddStudentsModalOpen(false)}
      >
        <div className="inline-form">
          <select
            className="input"
            value={addFilterCourseId}
            onChange={(event) => setAddFilterCourseId(event.target.value)}
          >
            <option value="all">Todos los cursos</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Buscar alumno..."
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
              if (!selectedSubject || selectedCandidateIds.length === 0) {
                return;
              }
              if (!ensureNoPendingChanges()) {
                return;
              }
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
                      checked={selectedCandidateIds.includes(row.student.id)}
                      onChange={() => toggleCandidate(row.student.id)}
                    />
                  </td>
                  <td>{getStudentFullName(row.student)}</td>
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
      <Modal
        open={showUnsavedModal}
        title="Cambios sin guardar"
        onClose={() => setShowUnsavedModal(false)}
      >
        <p>Tienes cambios sin guardar. Pulsa Guardar antes de continuar.</p>
        <div className="inline-form">
          <button type="button" className="btn" onClick={() => setShowUnsavedModal(false)}>
            Entendido
          </button>
        </div>
      </Modal>
    </article>
  );
}



