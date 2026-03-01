import { useCallback, useEffect, useMemo, useState } from "react";
import { useManagement } from "./ManagementContext";
import { getStudentFullName } from "../../shared/utils/student";
import { IconButton } from "../../shared/ui/IconButton";
import { Modal } from "../../shared/ui/Modal";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";

export function ManagementCoursesPage() {
  const {
    courses,
    students,
    createEmptyCourse,
    updateCourse,
    deleteCourse,
    moveStudent,
    setNotice
  } = useManagement();

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [draggingStudentId, setDraggingStudentId] = useState<string | null>(null);
  const [dropCourseId, setDropCourseId] = useState<string | null>(null);

  const [detailCourseName, setDetailCourseName] = useState("");
  const [detailCourseYear, setDetailCourseYear] = useState("");
  const [detailCourseComments, setDetailCourseComments] = useState("");
  const [courseDirty, setCourseDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);


  useEffect(() => {
    if (!selectedCourseId && courses.length > 0) {
      setSelectedCourseId(courses[0].id);
    }
    const exists = courses.some((course) => course.id === selectedCourseId);
    if (!exists && courses.length > 0) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
  const selectedStudents = useMemo(
    () => students.filter((student) => student.classId === selectedCourseId),
    [selectedCourseId, students]
  );

  useEffect(() => {
    if (!selectedCourse) {
      setDetailCourseName("");
      setDetailCourseYear("");
      setDetailCourseComments("");
      setCourseDirty(false);
      return;
    }
    setDetailCourseName(selectedCourse.name);
    setDetailCourseYear(selectedCourse.schoolYear);
    setDetailCourseComments(selectedCourse.comments ?? "");
    setCourseDirty(false);
  }, [selectedCourse]);

  const persistCourse = useCallback(async (): Promise<boolean> => {
    if (!selectedCourse || !courseDirty) {
      return true;
    }
    if (detailCourseName.trim().length < 3 || detailCourseYear.trim().length < 4) {
      setNotice("Completa nombre del curso (minimo 3 caracteres) y curso escolar (minimo 4).");
      return false;
    }
    await updateCourse(selectedCourse.id, detailCourseName, detailCourseYear, detailCourseComments);
    setCourseDirty(false);
    return true;
  }, [
    courseDirty,
    detailCourseComments,
    detailCourseName,
    detailCourseYear,
    selectedCourse,
    setNotice,
    updateCourse
  ]);

  const ensureNoPendingChanges = (): boolean => {
    if (!courseDirty) {
      return true;
    }
    setShowUnsavedModal(true);
    return false;
  };

  useUnsavedChangesGuard(courseDirty);

  const handleCourseDrop = async (targetCourseId: string, rawStudentId: string | null) => {
    if (!ensureNoPendingChanges()) {
      return;
    }
    const studentId = rawStudentId || draggingStudentId;
    if (!studentId) {
      return;
    }
    void moveStudent(studentId, targetCourseId);
    setDraggingStudentId(null);
    setDropCourseId(null);
  };

  return (
    <>
      <article className="management-card">
      <h3>Cursos</h3>
      <div className="courses-layout">
        <aside className="courses-list-panel">
          <div className="courses-list-header">
            <strong>Listado</strong>
            <IconButton
              icon="add"
              label="Crear curso"
              onClick={async () => {
                if (!ensureNoPendingChanges()) {
                  return;
                }
                const createdId = await createEmptyCourse();
                if (createdId) {
                  setSelectedCourseId(createdId);
                }
              }}
            />
          </div>
          <div className="courses-list section-tabs" role="tablist" aria-label="Secciones de cursos">
            {courses.map((course) => (
              <div key={course.id} className="courses-list-row">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCourseId === course.id}
                  className={`section-tab ${selectedCourseId === course.id ? "active" : ""} ${
                    dropCourseId === course.id ? "drop-target" : ""
                  }`}
                  onClick={() => {
                    if (!ensureNoPendingChanges()) {
                      return;
                    }
                    setSelectedCourseId(course.id);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropCourseId(course.id);
                  }}
                  onDragLeave={() => setDropCourseId(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    void handleCourseDrop(course.id, event.dataTransfer.getData("text/student-id"));
                  }}
                >
                  <span>{course.name}</span>
                  <small>{course.schoolYear}</small>
                </button>
                <IconButton
                  icon="delete"
                  label={`Eliminar ${course.name || "curso"}`}
                  onClick={async () => {
                    if (!ensureNoPendingChanges()) {
                      return;
                    }
                    await deleteCourse(course.id);
                  }}
                />
              </div>
            ))}
          </div>
        </aside>

        <section className="course-detail-panel">
          {selectedCourse ? (
            <>
              <div className="course-detail-header">
                <div>
                  <h4>Detalle del curso</h4>
                </div>
                <div className="actions-cell">
                  <IconButton
                    icon="save"
                    label="Guardar curso"
                    className={courseDirty ? "save-attention" : ""}
                    disabled={!courseDirty}
                    onClick={async () => {
                      await persistCourse();
                    }}
                  />
                </div>
              </div>

              <div className="detail-summary">
                <span className="pill">{selectedStudents.length} alumnos</span>
                <span className="pill">{detailCourseYear || "Sin curso escolar"}</span>
              </div>

              <section className="detail-section">
                <h5>Datos del curso</h5>
                <div className="detail-grid">
                  <div className="detail-field">
                    <label>Nombre</label>
                    <input
                      className="input"
                      placeholder="Ej. 4 ESO A"
                      value={detailCourseName}
                      onChange={(event) => {
                        setDetailCourseName(event.target.value);
                        setCourseDirty(true);
                      }}
                    />
                  </div>
                  <div className="detail-field">
                    <label>Curso escolar</label>
                    <input
                      className="input"
                      placeholder="2025-2026"
                      value={detailCourseYear}
                      onChange={(event) => {
                        setDetailCourseYear(event.target.value);
                        setCourseDirty(true);
                      }}
                    />
                  </div>
                  <div className="detail-field full">
                    <label>Comentarios</label>
                    <textarea
                      className="input"
                      placeholder="Comentarios del curso (opcional)"
                      value={detailCourseComments}
                      onChange={(event) => {
                        setDetailCourseComments(event.target.value);
                        setCourseDirty(true);
                      }}
                    />
                  </div>
                </div>
              </section>

              <section className="detail-section">
                <h5>Alumnos del curso</h5>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Foto</th>
                        <th>Alumno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStudents.map((student) => (
                        <tr
                          key={student.id}
                          draggable
                          onDragStart={(event) => {
                            setDraggingStudentId(student.id);
                            event.dataTransfer.setData("text/student-id", student.id);
                            event.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDraggingStudentId(null);
                            setDropCourseId(null);
                          }}
                        >
                          <td>
                            {student.photoDataUrl ? (
                              <img
                                className="student-avatar"
                                src={student.photoDataUrl}
                                alt={getStudentFullName(student)}
                              />
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>{getStudentFullName(student)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <p>Selecciona un curso para ver sus opciones y alumnado.</p>
          )}
        </section>
      </div>
      </article>
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
    </>
  );
}
