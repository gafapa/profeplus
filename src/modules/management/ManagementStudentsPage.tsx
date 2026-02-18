import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useManagement } from "./ManagementContext";
import { resizeImageToMaxSide } from "../../shared/utils/image";
import { getStudentFullName } from "../../shared/utils/student";
import { IconButton } from "../../shared/ui/IconButton";
import { Modal } from "../../shared/ui/Modal";

export function ManagementStudentsPage() {
  const { students, courses, createEmptyStudent, updateStudent, deleteStudent, setNotice } = useManagement();

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [detailFirstName, setDetailFirstName] = useState("");
  const [detailLastName, setDetailLastName] = useState("");
  const [detailCourseId, setDetailCourseId] = useState("");
  const [detailPhoto, setDetailPhoto] = useState<string | undefined>(undefined);
  const [studentDirty, setStudentDirty] = useState(false);
  const [preferredCourseId, setPreferredCourseId] = useState("");
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selectedStudentId && students.length > 0) {
      setSelectedStudentId(students[0].id);
    }
    const exists = students.some((student) => student.id === selectedStudentId);
    if (!exists && students.length > 0) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [students, selectedStudentId]
  );

  useEffect(() => {
    if (!selectedStudent) {
      setDetailFirstName("");
      setDetailLastName("");
      setDetailCourseId((current) => current || preferredCourseId || courses[0]?.id || "");
      setDetailPhoto(undefined);
      setStudentDirty(false);
      return;
    }
    setDetailFirstName(selectedStudent.firstName ?? "");
    setDetailLastName(selectedStudent.lastName ?? "");
    setDetailCourseId(selectedStudent.classId);
    setPreferredCourseId(selectedStudent.classId);
    setDetailPhoto(selectedStudent.photoDataUrl);
    setStudentDirty(false);
  }, [courses, selectedStudent]);

  const persistStudent = useCallback(async (): Promise<boolean> => {
    if (!selectedStudent || !studentDirty) {
      return true;
    }
    if (isProcessingPhoto) {
      setNotice("Espera a que termine de procesarse la foto antes de guardar.");
      return false;
    }
    const firstName = detailFirstName.trim();
    const lastName = detailLastName.trim();
    if (firstName.length < 2 || lastName.length < 2 || !detailCourseId) {
      setNotice("Completa nombre, apellidos y curso (minimo 2 caracteres por campo).");
      return false;
    }
    await updateStudent(
      selectedStudent.id,
      firstName,
      lastName,
      detailCourseId,
      detailPhoto
    );
    setPreferredCourseId(detailCourseId);
    setStudentDirty(false);
    return true;
  }, [
    detailCourseId,
    detailFirstName,
    detailLastName,
    detailPhoto,
    isProcessingPhoto,
    selectedStudent,
    setNotice,
    studentDirty,
    updateStudent
  ]);

  const ensureNoPendingChanges = (): boolean => {
    if (!studentDirty) {
      return true;
    }
    setShowUnsavedModal(true);
    return false;
  };

  return (
    <>
      <article className="management-card">
      <h3>Alumnos</h3>

      <div className="courses-layout">
        <aside className="courses-list-panel">
          <div className="courses-list-header">
            <strong>Listado</strong>
            <IconButton
              icon="add"
              label="Crear alumno"
              onClick={async () => {
                if (!ensureNoPendingChanges()) {
                  return;
                }
                const targetCourseId = detailCourseId || preferredCourseId || courses[0]?.id;
                const createdId = await createEmptyStudent(targetCourseId);
                if (createdId) {
                  setSelectedStudentId(createdId);
                }
              }}
            />
          </div>
          <div className="courses-list section-tabs" role="tablist" aria-label="Secciones de alumnos">
            {students.map((student) => (
              <div key={student.id} className="courses-list-row">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedStudentId === student.id}
                  className={`section-tab ${selectedStudentId === student.id ? "active" : ""}`}
                  onClick={() => {
                    if (!ensureNoPendingChanges()) {
                      return;
                    }
                    setSelectedStudentId(student.id);
                  }}
                >
                  <span className="student-item-name">
                    {student.photoDataUrl ? (
                      <img
                        className="student-avatar"
                        src={student.photoDataUrl}
                        alt={getStudentFullName(student)}
                      />
                    ) : (
                      <span className="student-avatar-placeholder">-</span>
                    )}
                    {getStudentFullName(student)}
                  </span>
                  <small>{courses.find((course) => course.id === student.classId)?.name ?? "-"}</small>
                </button>
                <IconButton
                  icon="delete"
                  label={`Eliminar ${getStudentFullName(student)}`}
                  onClick={async () => {
                    if (!ensureNoPendingChanges()) {
                      return;
                    }
                    await deleteStudent(student.id);
                  }}
                />
              </div>
            ))}
          </div>
        </aside>

        <section className="course-detail-panel">
          {selectedStudent ? (
            <>
              <div className="course-detail-header">
                <div>
                  <h4>Ficha del alumno</h4>
                </div>
                <div className="actions-cell">
                  <IconButton
                    icon="save"
                    label="Guardar alumno"
                    className={studentDirty ? "save-attention" : ""}
                    disabled={!studentDirty || isProcessingPhoto}
                    onClick={async () => {
                      await persistStudent();
                    }}
                  />
                </div>
              </div>

              <div className="detail-summary">
                <span className="pill">
                  {courses.find((course) => course.id === detailCourseId)?.name ?? "Sin curso"}
                </span>
              </div>

              <section className="detail-section">
                <h5>Datos del alumno</h5>
                <div className="student-detail-top">
                  <div className="student-photo-box">
                    <button
                      type="button"
                      className="student-photo-trigger"
                      title={isProcessingPhoto ? "Procesando foto..." : "Pulsa para cambiar la foto"}
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isProcessingPhoto}
                    >
                      {detailPhoto ? (
                        <img className="student-profile-photo" src={detailPhoto} alt="Foto del alumno" />
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
                        if (!file) {
                          return;
                        }
                        setIsProcessingPhoto(true);
                        void resizeImageToMaxSide(file, 200)
                          .then((value) => {
                            setDetailPhoto(value);
                            setStudentDirty(true);
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
                      <label>Curso</label>
                      <select
                        className="input"
                        value={detailCourseId}
                        onChange={(event) => {
                          setDetailCourseId(event.target.value);
                          setPreferredCourseId(event.target.value);
                          setStudentDirty(true);
                        }}
                      >
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <p>No hay alumnos para mostrar.</p>
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
