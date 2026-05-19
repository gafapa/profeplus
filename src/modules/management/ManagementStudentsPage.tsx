import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useManagement } from "./ManagementContext";
import { resizeImageToMaxSide } from "../../shared/utils/image";
import { useStudentDisplay } from "../../shared/hooks/useStudentDisplay";
import { IconButton } from "../../shared/ui/IconButton";

export function ManagementStudentsPage() {
  const { formatName } = useStudentDisplay();
  const { students, courses, createEmptyStudent, updateStudent, deleteStudent, setNotice } =
    useManagement();

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [detailFirstName, setDetailFirstName] = useState("");
  const [detailLastName, setDetailLastName] = useState("");
  const [detailComments, setDetailComments] = useState("");
  const [detailPhoto, setDetailPhoto] = useState<string | undefined>(undefined);
  const [studentDirty, setStudentDirty] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
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
      setDetailComments("");
      setDetailPhoto(undefined);
      setStudentDirty(false);
      return;
    }
    setDetailFirstName(selectedStudent.firstName ?? "");
    setDetailLastName(selectedStudent.lastName ?? "");
    setDetailComments(selectedStudent.comments ?? "");
    setDetailPhoto(selectedStudent.photoDataUrl);
    setStudentDirty(false);
  }, [selectedStudent]);

  // Auto-guardado con debounce (updateStudent excluido de deps: su referencia cambia en cada render del contexto)
  useEffect(() => {
    if (!studentDirty || !selectedStudent || isProcessingPhoto) return;
    const firstName = detailFirstName.trim();
    const lastName = detailLastName.trim();
    if (firstName.length < 2 || lastName.length < 2 || !selectedCourseId) return;
    const id = selectedStudent.id;
    const courseId = selectedCourseId;
    const photo = detailPhoto;
    const comments = detailComments;
    const timer = setTimeout(() => {
      void updateStudent(id, firstName, lastName, courseId, photo, comments).then(() => {
        if (courseId) {
          setSelectedCourseId(courseId);
        }
        setStudentDirty(false);
      });
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentDirty, isProcessingPhoto, detailFirstName, detailLastName, detailComments, selectedCourseId, detailPhoto, selectedStudent?.id]);

  const saveIfDirty = useCallback(async () => {
    if (!studentDirty || !selectedStudent || isProcessingPhoto) return;
    const firstName = detailFirstName.trim();
    const lastName = detailLastName.trim();
    if (firstName.length < 2 || lastName.length < 2 || !selectedCourseId) return;
    const courseId = selectedCourseId;
    await updateStudent(selectedStudent.id, firstName, lastName, courseId, detailPhoto, detailComments);
    if (courseId) {
      setSelectedCourseId(courseId);
    }
    setStudentDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentDirty, isProcessingPhoto, detailFirstName, detailLastName, detailComments, selectedCourseId, detailPhoto, selectedStudent?.id]);

  const changeSelectedCourse = useCallback(async (courseId: string) => {
    await saveIfDirty();
    setSelectedCourseId(courseId);
  }, [saveIfDirty]);

  const changeSelectedStudent = useCallback((studentId: string) => {
    setSelectedStudentId(studentId);
    void saveIfDirty();
  }, [saveIfDirty]);

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

                  {/* Campos */}
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
            </>
          ) : (
            <p className="empty-state">No hay alumnos para mostrar.</p>
          )}
        </section>
      </div>
    </article>
  );
}
