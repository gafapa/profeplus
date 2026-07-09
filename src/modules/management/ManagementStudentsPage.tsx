import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useManagement } from "./ManagementContext";
import { db } from "../../shared/db/database";
import type { StudentFollowUp, StudentFollowUpKind } from "../../shared/db/types";
import { parseStudentsCsv, type ParsedStudentCsvRow } from "../../shared/import/studentsCsv";
import {
  FOLLOW_UP_KINDS,
  defaultFollowUpDraft,
  followUpKindLabel,
  normalizeFollowUpDraft,
  type StudentFollowUpDraft
} from "../../shared/students/followUp";
import { resizeImageToMaxSide } from "../../shared/utils/image";
import { useStudentDisplay } from "../../shared/hooks/useStudentDisplay";
import { IconButton } from "../../shared/ui/IconButton";

export function ManagementStudentsPage() {
  const { formatName } = useStudentDisplay();
  const { students, courses, createEmptyStudent, updateStudent, deleteStudent, setNotice, refreshAll } =
    useManagement();

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [detailFirstName, setDetailFirstName] = useState("");
  const [detailLastName, setDetailLastName] = useState("");
  const [detailEmail, setDetailEmail] = useState("");
  const [detailComments, setDetailComments] = useState("");
  const [detailHasAcs, setDetailHasAcs] = useState(false);
  const [detailHasReinforcement, setDetailHasReinforcement] = useState(false);
  const [detailPhoto, setDetailPhoto] = useState<string | undefined>(undefined);
  const [studentDirty, setStudentDirty] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [followUps, setFollowUps] = useState<StudentFollowUp[]>([]);
  const [followUpDraft, setFollowUpDraft] = useState<StudentFollowUpDraft>(() => defaultFollowUpDraft(new Date().toISOString().slice(0, 10)));
  const [editingFollowUpId, setEditingFollowUpId] = useState("");
  const [studentImportText, setStudentImportText] = useState("");
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const importCsvInputRef = useRef<HTMLInputElement | null>(null);
  const selectedCourseRef = useRef("");

  useEffect(() => {
    if (courses.length === 0) {
      setSelectedCourseId("");
      return;
    }
    const exists = courses.some((course) => course.id === selectedCourseId);
    if (!selectedCourseId || !exists) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  const filteredStudents = useMemo(
    () => students.filter((student) => student.classId === selectedCourseId),
    [selectedCourseId, students]
  );

  useEffect(() => {
    if (filteredStudents.length === 0) {
      setSelectedStudentId("");
      selectedCourseRef.current = selectedCourseId;
      return;
    }
    const exists = filteredStudents.some((student) => student.id === selectedStudentId);
    const courseChanged = selectedCourseRef.current !== selectedCourseId;
    selectedCourseRef.current = selectedCourseId;
    if (courseChanged || !selectedStudentId || !exists) {
      setSelectedStudentId(filteredStudents[0].id);
    }
  }, [filteredStudents, selectedCourseId, selectedStudentId]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? null,
    [students, selectedStudentId]
  );

  useEffect(() => {
    if (!selectedStudent) {
      setDetailFirstName("");
      setDetailLastName("");
      setDetailEmail("");
      setDetailComments("");
      setDetailHasAcs(false);
      setDetailHasReinforcement(false);
      setDetailPhoto(undefined);
      setStudentDirty(false);
      setFollowUps([]);
      setEditingFollowUpId("");
      setFollowUpDraft(defaultFollowUpDraft(new Date().toISOString().slice(0, 10)));
      return;
    }
    setDetailFirstName(selectedStudent.firstName ?? "");
    setDetailLastName(selectedStudent.lastName ?? "");
    setDetailEmail(selectedStudent.email ?? "");
    setDetailComments(selectedStudent.comments ?? "");
    setDetailHasAcs(Boolean(selectedStudent.hasAcs));
    setDetailHasReinforcement(Boolean(selectedStudent.hasReinforcement));
    setDetailPhoto(selectedStudent.photoDataUrl);
    setStudentDirty(false);
    setEditingFollowUpId("");
    setFollowUpDraft(defaultFollowUpDraft(new Date().toISOString().slice(0, 10)));
  }, [selectedStudent]);

  useEffect(() => {
    let active = true;
    const loadFollowUps = async (): Promise<void> => {
      if (!selectedStudentId) {
        if (active) setFollowUps([]);
        return;
      }
      const rows = await db.studentFollowUps.where("studentId").equals(selectedStudentId).toArray();
      rows.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
      if (active) {
        setFollowUps(rows);
      }
    };
    void loadFollowUps();
    return () => {
      active = false;
    };
  }, [selectedStudentId]);

  // Debounced autosave. updateStudent is omitted because the context recreates its reference on each render.
  useEffect(() => {
    if (!studentDirty || !selectedStudent || isProcessingPhoto) return;
    const firstName = detailFirstName.trim();
    const lastName = detailLastName.trim();
    if (firstName.length < 2 || lastName.length < 2 || !selectedCourseId) return;
    const id = selectedStudent.id;
    const courseId = selectedCourseId;
    const photo = detailPhoto;
    const comments = detailComments;
    const email = detailEmail;
    const hasAcs = detailHasAcs;
    const hasReinforcement = detailHasReinforcement;
    const timer = setTimeout(() => {
      void updateStudent(id, firstName, lastName, courseId, photo, comments, email, hasAcs, hasReinforcement).then(() => {
        if (courseId) {
          setSelectedCourseId(courseId);
        }
        setStudentDirty(false);
      });
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentDirty, isProcessingPhoto, detailFirstName, detailLastName, detailEmail, detailComments, detailHasAcs, detailHasReinforcement, selectedCourseId, detailPhoto, selectedStudent?.id]);

  const saveIfDirty = useCallback(async () => {
    if (!studentDirty || !selectedStudent || isProcessingPhoto) return;
    const firstName = detailFirstName.trim();
    const lastName = detailLastName.trim();
    if (firstName.length < 2 || lastName.length < 2 || !selectedCourseId) return;
    const courseId = selectedCourseId;
    await updateStudent(
      selectedStudent.id,
      firstName,
      lastName,
      courseId,
      detailPhoto,
      detailComments,
      detailEmail,
      detailHasAcs,
      detailHasReinforcement
    );
    if (courseId) {
      setSelectedCourseId(courseId);
    }
    setStudentDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentDirty, isProcessingPhoto, detailFirstName, detailLastName, detailEmail, detailComments, detailHasAcs, detailHasReinforcement, selectedCourseId, detailPhoto, selectedStudent?.id]);

  const changeSelectedCourse = useCallback(async (courseId: string) => {
    await saveIfDirty();
    setSelectedCourseId(courseId);
  }, [saveIfDirty]);

  const changeSelectedStudent = useCallback((studentId: string) => {
    setSelectedStudentId(studentId);
    void saveIfDirty();
  }, [saveIfDirty]);

  const importStudentRows = async (parsedRows: ParsedStudentCsvRow[], sourceLabel: string): Promise<boolean> => {
    const targetCourseId = selectedCourseId || courses[0]?.id;
    if (!targetCourseId) {
      setNotice("Crea o selecciona un curso antes de importar alumnos.");
      return false;
    }

    if (parsedRows.length === 0) {
      setNotice(`No se encontraron alumnos válidos en ${sourceLabel}.`);
      return false;
    }

    const existingNames = new Set(
      students
        .filter((student) => student.classId === targetCourseId)
        .map((student) => `${student.firstName} ${student.lastName}`.trim().toLowerCase())
    );
    const rowsToAdd = parsedRows.filter((row) => {
      const key = `${row.firstName} ${row.lastName}`.trim().toLowerCase();
      if (existingNames.has(key)) {
        return false;
      }
      existingNames.add(key);
      return true;
    });

    if (rowsToAdd.length === 0) {
      setNotice(`Todos los alumnos de ${sourceLabel} ya existen en el curso seleccionado.`);
      return false;
    }

    const createdIds = rowsToAdd.map(() => crypto.randomUUID());
    await db.students.bulkAdd(
      rowsToAdd.map((row, index) => ({
        id: createdIds[index],
        classId: targetCourseId,
        firstName: row.firstName,
        lastName: row.lastName,
        fullName: `${row.firstName} ${row.lastName}`.trim(),
        email: row.email,
        comments: row.comments,
        hasAcs: row.hasAcs,
        hasReinforcement: row.hasReinforcement
      }))
    );
    await refreshAll();
    setSelectedCourseId(targetCourseId);
    setSelectedStudentId(createdIds[0] ?? "");
    setNotice(`Importados ${rowsToAdd.length} alumnos desde ${sourceLabel}.`);
    return true;
  };

  const importStudentsCsvFile = async (file: File): Promise<void> => {
    if (file.size > 1024 * 1024) {
      setNotice("El CSV es demasiado grande. Usa un archivo de hasta 1 MB.");
      return;
    }

    await importStudentRows(parseStudentsCsv(await file.text()), "CSV");
  };

  const importStudentsFromText = async (): Promise<void> => {
    const imported = await importStudentRows(parseStudentsCsv(studentImportText), "la tabla pegada");
    if (imported) {
      setStudentImportText("");
    }
  };

  const resetFollowUpForm = (): void => {
    setEditingFollowUpId("");
    setFollowUpDraft(defaultFollowUpDraft(new Date().toISOString().slice(0, 10)));
  };

  const editFollowUp = (followUp: StudentFollowUp): void => {
    setEditingFollowUpId(followUp.id);
    setFollowUpDraft({
      date: followUp.date,
      kind: followUp.kind,
      title: followUp.title,
      notes: followUp.notes,
      nextStep: followUp.nextStep ?? "",
      resolved: followUp.resolved
    });
  };

  const saveFollowUp = async (): Promise<void> => {
    if (!selectedStudent) {
      return;
    }
    const normalized = normalizeFollowUpDraft(followUpDraft);
    if (!normalized) {
      setNotice("El seguimiento necesita fecha válida, título y notas.");
      return;
    }
    const id = editingFollowUpId || crypto.randomUUID();
    await db.studentFollowUps.put({
      id,
      studentId: selectedStudent.id,
      classId: selectedStudent.classId,
      ...normalized
    });
    const rows = await db.studentFollowUps.where("studentId").equals(selectedStudent.id).toArray();
    rows.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
    setFollowUps(rows);
    resetFollowUpForm();
    setNotice(editingFollowUpId ? "Seguimiento actualizado." : "Seguimiento añadido.");
  };

  const deleteFollowUp = async (followUpId: string): Promise<void> => {
    await db.studentFollowUps.delete(followUpId);
    setFollowUps((current) => current.filter((item) => item.id !== followUpId));
    if (editingFollowUpId === followUpId) {
      resetFollowUpForm();
    }
    setNotice("Seguimiento eliminado.");
  };

  return (
    <article className="management-card">
      <div className="courses-layout">
        <aside className="courses-list-panel">
          <div className="context-sidebar-tabs">
            <div className="context-sidebar-group">
              <strong>Curso</strong>
              {courses.length > 0 ? (
                <div className="courses-list section-tabs context-sidebar-list" role="tablist" aria-label="Cursos de alumnos">
                  {courses.map((course) => (
                    <button
                      key={course.id}
                      type="button"
                      role="tab"
                      aria-selected={selectedCourseId === course.id}
                      className={`section-tab ${selectedCourseId === course.id ? "active" : ""}`}
                      onClick={() => {
                        void changeSelectedCourse(course.id);
                      }}
                    >
                      <span>{course.name || "Curso sin nombre"}</span>
                      <small>{course.schoolYear}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="hint">Sin cursos</p>
              )}
            </div>
          </div>
          <div className="courses-list-header">
            <strong>Listado</strong>
            <span className="courses-list-actions">
              <button
                type="button"
                className="btn secondary"
                disabled={courses.length === 0}
                onClick={() => importCsvInputRef.current?.click()}
              >
                Importar CSV
              </button>
              <IconButton
                icon="add"
                label="Crear alumno"
                onClick={async () => {
                  await saveIfDirty();
                  const targetCourseId = selectedCourseId || courses[0]?.id;
                  const createdId = await createEmptyStudent(targetCourseId);
                  if (createdId) {
                    if (targetCourseId) {
                      setSelectedCourseId(targetCourseId);
                    }
                    setSelectedStudentId(createdId);
                  }
                }}
              />
            </span>
          </div>
          <input
            ref={importCsvInputRef}
            className="student-photo-input-hidden"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) {
                void importStudentsCsvFile(file);
              }
            }}
          />

          <div className="student-import-panel">
            <textarea
              className="input"
              value={studentImportText}
              onChange={(event) => setStudentImportText(event.target.value)}
              rows={3}
              aria-label="Tabla de alumnos"
              placeholder="Nombre	Apellidos	Correo	Observaciones	ACS	Refuerzo"
            />
            <button
              type="button"
              className="btn secondary"
              disabled={courses.length === 0 || studentImportText.trim().length === 0}
              onClick={() => void importStudentsFromText()}
            >
              Importar tabla
            </button>
          </div>

          <div
            className="courses-list section-tabs"
            role="tablist"
            aria-label="Secciones de alumnos"
          >
            {filteredStudents.map((student) => {
              const courseName = courses.find((course) => course.id === student.classId)?.name;
              return (
                <div key={student.id} className="courses-list-row">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedStudentId === student.id}
                    className={`section-tab ${selectedStudentId === student.id ? "active" : ""}`}
                    onClick={() => {
                      changeSelectedStudent(student.id);
                    }}
                  >
                    <span className="student-item-name">
                      {student.photoDataUrl ? (
                        <img
                          className="student-avatar"
                          src={student.photoDataUrl}
                          alt={formatName(student)}
                        />
                      ) : (
                        <span className="student-avatar-placeholder">-</span>
                      )}
                      {formatName(student) || "Sin nombre"}
                    </span>
                    <small>{courseName || "Sin curso"}</small>
                  </button>
                  <IconButton
                    icon="delete"
                    label={`Eliminar ${formatName(student) || "alumno"}`}
                    onClick={async () => {
                      await saveIfDirty();
                      await deleteStudent(student.id);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </aside>

        <section className="course-detail-panel">
          {selectedStudent ? (
            <>
              <div className="course-detail-header">
                <div>
                  <h4>Ficha del alumno</h4>
                </div>
              </div>

              <div className="detail-summary">
                {selectedCourseId ? (
                  <span className="pill">
                    {courses.find((course) => course.id === selectedCourseId)?.name ?? selectedCourseId}
                  </span>
                ) : (
                  <span className="pill warning">
                    Sin curso asignado
                  </span>
                )}
              </div>

              <section className="detail-section">
                <h5>Datos del alumno</h5>
                <div className="student-detail-top">
                  {/* Foto */}
                  <div className="student-photo-box">
                    <button
                      type="button"
                      className="student-photo-trigger"
                      title={
                        isProcessingPhoto ? "Procesando foto..." : "Pulsa para cambiar la foto"
                      }
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isProcessingPhoto}
                    >
                      {detailPhoto ? (
                        <img
                          className="student-profile-photo"
                          src={detailPhoto}
                          alt="Foto del alumno"
                        />
                      ) : (
                        <div className="student-profile-photo placeholder">Sin foto</div>
                      )}
                    </button>
                    <input
                      ref={photoInputRef}
                      className="student-photo-input-hidden"
                      type="file"
                      accept="image/*"
                      disabled={isProcessingPhoto}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setIsProcessingPhoto(true);
                        void resizeImageToMaxSide(file, 200)
                          .then((value) => {
                            setDetailPhoto(value);
                            setStudentDirty(true);
                          })
                          .catch((error) => {
                            const message = error instanceof Error ? error.message : "No se pudo procesar la imagen.";
                            setNotice(message);
                          })
                          .finally(() => {
                            setIsProcessingPhoto(false);
                          });
                      }}
                    />
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => {
                        setDetailPhoto(undefined);
                        setStudentDirty(true);
                      }}
                      disabled={!detailPhoto || isProcessingPhoto}
                    >
                      Eliminar foto
                    </button>
                  </div>

                  <div className="detail-grid">
                    <div className="detail-field">
                      <label>Nombre</label>
                      <input
                        className="input"
                        placeholder="Nombre"
                        value={detailFirstName}
                        onChange={(event) => {
                          setDetailFirstName(event.target.value);
                          setStudentDirty(true);
                        }}
                      />
                    </div>
                    <div className="detail-field">
                      <label>Apellidos</label>
                      <input
                        className="input"
                        placeholder="Apellidos"
                        value={detailLastName}
                        onChange={(event) => {
                          setDetailLastName(event.target.value);
                          setStudentDirty(true);
                        }}
                      />
                    </div>
                    <div className="detail-field full">
                      <label>Email</label>
                      <input
                        className="input"
                        type="email"
                        placeholder="correo@centro.es"
                        value={detailEmail}
                        onChange={(event) => {
                          setDetailEmail(event.target.value);
                          setStudentDirty(true);
                        }}
                      />
                    </div>
                    <div className="detail-field full">
                      <label>Medidas educativas</label>
                      <div className="student-support-options">
                        <label className="chip-toggle">
                          <input
                            type="checkbox"
                            checked={detailHasAcs}
                            onChange={(event) => {
                              setDetailHasAcs(event.target.checked);
                              setStudentDirty(true);
                            }}
                          />
                          <span>ACS</span>
                        </label>
                        <label className="chip-toggle">
                          <input
                            type="checkbox"
                            checked={detailHasReinforcement}
                            onChange={(event) => {
                              setDetailHasReinforcement(event.target.checked);
                              setStudentDirty(true);
                            }}
                          />
                          <span>Refuerzo</span>
                        </label>
                      </div>
                    </div>
                    <div className="detail-field full">
                      <label>Comentarios</label>
                      <textarea
                        className="input"
                        rows={5}
                        placeholder="Comentarios del alumno"
                        value={detailComments}
                        onChange={(event) => {
                          setDetailComments(event.target.value);
                          setStudentDirty(true);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="detail-section">
                <div className="course-detail-header">
                  <h5>Seguimiento tutorial</h5>
                  <button type="button" className="btn secondary" onClick={resetFollowUpForm}>
                    Nuevo registro
                  </button>
                </div>
                <div className="follow-up-form">
                  <label className="detail-field">
                    <span>Fecha</span>
                    <input
                      className="input"
                      type="date"
                      value={followUpDraft.date}
                      onChange={(event) => setFollowUpDraft((current) => ({ ...current, date: event.target.value }))}
                    />
                  </label>
                  <label className="detail-field">
                    <span>Tipo</span>
                    <select
                      className="input"
                      value={followUpDraft.kind}
                      onChange={(event) =>
                        setFollowUpDraft((current) => ({
                          ...current,
                          kind: event.target.value as StudentFollowUpKind
                        }))
                      }
                    >
                      {FOLLOW_UP_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {followUpKindLabel(kind)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="detail-field">
                    <span>Título</span>
                    <input
                      className="input"
                      value={followUpDraft.title}
                      placeholder="Ej. Entrevista con familia"
                      onChange={(event) => setFollowUpDraft((current) => ({ ...current, title: event.target.value }))}
                    />
                  </label>
                  <label className="chip-toggle follow-up-resolved-toggle">
                    <input
                      type="checkbox"
                      checked={followUpDraft.resolved}
                      onChange={(event) => setFollowUpDraft((current) => ({ ...current, resolved: event.target.checked }))}
                    />
                    <span>Resuelto</span>
                  </label>
                  <label className="detail-field full">
                    <span>Notas</span>
                    <textarea
                      className="input"
                      value={followUpDraft.notes}
                      placeholder="Evidencias, acuerdos, incidencias o medidas observadas"
                      onChange={(event) => setFollowUpDraft((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </label>
                  <label className="detail-field full">
                    <span>Próximo paso</span>
                    <input
                      className="input"
                      value={followUpDraft.nextStep}
                      placeholder="Ej. Revisar evolución la próxima semana"
                      onChange={(event) => setFollowUpDraft((current) => ({ ...current, nextStep: event.target.value }))}
                    />
                  </label>
                  <div className="inline-form full">
                    <button type="button" className="btn secondary" onClick={() => void saveFollowUp()}>
                      {editingFollowUpId ? "Actualizar seguimiento" : "Añadir seguimiento"}
                    </button>
                    {editingFollowUpId ? (
                      <button type="button" className="btn secondary" onClick={resetFollowUpForm}>
                        Cancelar edición
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="follow-up-list">
                  {followUps.map((followUp) => (
                    <article key={followUp.id} className={`follow-up-card ${followUp.resolved ? "resolved" : ""}`}>
                      <div>
                        <strong>{followUp.title}</strong>
                        <span>
                          {followUp.date} · {followUpKindLabel(followUp.kind)} · {followUp.resolved ? "Resuelto" : "Abierto"}
                        </span>
                      </div>
                      <p>{followUp.notes}</p>
                      {followUp.nextStep ? <small>Próximo paso: {followUp.nextStep}</small> : null}
                      <div className="inline-form tight">
                        <button type="button" className="btn secondary" onClick={() => editFollowUp(followUp)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn secondary management-danger-btn"
                          onClick={() => void deleteFollowUp(followUp.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </article>
                  ))}
                  {followUps.length === 0 ? (
                    <p className="hint">No hay seguimiento tutorial registrado para este alumno.</p>
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <p className="empty-state">No hay alumnos para mostrar.</p>
          )}
        </section>
      </div>
    </article>
  );
}
