import { useCallback, useEffect, useMemo, useState } from "react";
import { useManagement } from "./ManagementContext";
import { IconButton } from "../../shared/ui/IconButton";
import { Modal } from "../../shared/ui/Modal";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";

const today = new Date().toISOString().slice(0, 10);

export function ManagementUnitsPage() {
  const { subjects, units, createEmptyUnit, updateUnit, deleteUnit, setNotice } = useManagement();

  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");

  const [detailName, setDetailName] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [detailStartDate, setDetailStartDate] = useState(today);
  const [detailEndDate, setDetailEndDate] = useState(today);
  const [detailSessionCount, setDetailSessionCount] = useState(1);
  const [unitDirty, setUnitDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);


  useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
    }
    const exists = subjects.some((subject) => subject.id === selectedSubjectId);
    if (!exists && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [selectedSubjectId, subjects]);

  const unitsBySubject = useMemo(
    () => units.filter((unit) => unit.subjectId === selectedSubjectId).sort((a, b) => a.position - b.position),
    [selectedSubjectId, units]
  );

  useEffect(() => {
    if (!selectedUnitId && unitsBySubject.length > 0) {
      setSelectedUnitId(unitsBySubject[0].id);
    }
    const exists = unitsBySubject.some((unit) => unit.id === selectedUnitId);
    if (!exists && unitsBySubject.length > 0) {
      setSelectedUnitId(unitsBySubject[0].id);
    }
    if (unitsBySubject.length === 0) {
      setSelectedUnitId("");
    }
  }, [selectedUnitId, unitsBySubject]);

  const selectedUnit = unitsBySubject.find((unit) => unit.id === selectedUnitId) ?? null;

  useEffect(() => {
    if (!selectedUnit) {
      setDetailName("");
      setDetailDescription("");
      setDetailStartDate(today);
      setDetailEndDate(today);
      setDetailSessionCount(1);
      setUnitDirty(false);
      return;
    }
    setDetailName(selectedUnit.name ?? "");
    setDetailDescription(selectedUnit.description ?? "");
    setDetailStartDate(selectedUnit.startDate ?? today);
    setDetailEndDate(selectedUnit.endDate ?? today);
    setDetailSessionCount(selectedUnit.sessionCount ?? 1);
    setUnitDirty(false);
  }, [selectedUnit]);

  const persistUnit = useCallback(async (): Promise<boolean> => {
    if (!selectedUnit || !unitDirty) {
      return true;
    }
    if (detailName.trim().length < 2 || !detailStartDate || !detailEndDate) {
      setNotice("La unidad necesita nombre (minimo 2 caracteres) y fechas de inicio y fin.");
      return false;
    }

    await updateUnit(
      selectedUnit.id,
      detailName,
      detailDescription,
      detailStartDate,
      detailEndDate,
      detailSessionCount
    );
    setUnitDirty(false);
    return true;
  }, [
    detailDescription,
    detailEndDate,
    detailName,
    detailSessionCount,
    detailStartDate,
    selectedUnit,
    setNotice,
    unitDirty,
    updateUnit
  ]);

  const ensureNoPendingChanges = (): boolean => {
    if (!unitDirty) {
      return true;
    }
    setShowUnsavedModal(true);
    return false;
  };

  useUnsavedChangesGuard(unitDirty);

  return (
    <>
    <article className="management-card">
      <h3>Unidades</h3>

      <div className="units-subject-buttons" aria-label="Asignaturas">
        {subjects.map((subject) => (
          <button
            key={subject.id}
            type="button"
            aria-pressed={selectedSubjectId === subject.id}
            className={`btn secondary units-subject-button ${
              selectedSubjectId === subject.id ? "active" : ""
            }`}
            onClick={() => {
              if (!ensureNoPendingChanges()) {
                return;
              }
              setSelectedSubjectId(subject.id);
            }}
          >
            {subject.name}
          </button>
        ))}
      </div>

      <div className="courses-layout">
        <aside className="courses-list-panel">
          <div className="courses-list-header">
            <strong>Unidades</strong>
            <IconButton
              icon="add"
              label="Crear unidad"
              onClick={async () => {
                if (!ensureNoPendingChanges()) {
                  return;
                }
                const createdId = await createEmptyUnit(selectedSubjectId);
                if (createdId) {
                  setSelectedUnitId(createdId);
                }
              }}
            />
          </div>
          <div className="courses-list section-tabs" role="tablist" aria-label="Secciones de unidades">
            {unitsBySubject.map((unit) => (
              <div key={unit.id} className="courses-list-row">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedUnitId === unit.id}
                  className={`section-tab ${selectedUnitId === unit.id ? "active" : ""}`}
                  onClick={() => {
                    if (!ensureNoPendingChanges()) {
                      return;
                    }
                    setSelectedUnitId(unit.id);
                  }}
                >
                  <span>{unit.name}</span>
                  <small>
                    {unit.startDate} - {unit.endDate}
                  </small>
                  <small>{unit.sessionCount} sesiones</small>
                </button>
                <IconButton
                  icon="delete"
                  label={`Eliminar ${unit.name || "unidad"}`}
                  onClick={async () => {
                    if (!ensureNoPendingChanges()) {
                      return;
                    }
                    await deleteUnit(unit.id);
                  }}
                />
              </div>
            ))}
            {unitsBySubject.length === 0 ? <p className="hint">No hay unidades en esta asignatura.</p> : null}
          </div>
        </aside>

        <section className="course-detail-panel">
          {selectedUnit ? (
            <>
              <div className="course-detail-header">
                <div>
                  <h4>Detalle de unidad</h4>
                </div>
                <div className="actions-cell">
                  <IconButton
                    icon="save"
                    label="Guardar unidad"
                    className={unitDirty ? "save-attention" : ""}
                    disabled={!unitDirty}
                    onClick={async () => {
                      await persistUnit();
                    }}
                  />
                </div>
              </div>

              <div className="unit-detail-layout">
                <label className="unit-field unit-field-full">
                  <span className="unit-field-label">Nombre</span>
                  <input
                    className="input"
                    placeholder="Nombre de la unidad"
                    value={detailName}
                    onChange={(event) => {
                      setDetailName(event.target.value);
                      setUnitDirty(true);
                    }}
                  />
                </label>

                <label className="unit-field unit-field-full">
                  <span className="unit-field-label">Descripción</span>
                  <textarea
                    className="input"
                    placeholder="Descripción de la unidad"
                    value={detailDescription}
                    onChange={(event) => {
                      setDetailDescription(event.target.value);
                      setUnitDirty(true);
                    }}
                  />
                </label>

                <label className="unit-field">
                  <span className="unit-field-label">Inicio</span>
                  <input
                    className="input"
                    type="date"
                    value={detailStartDate}
                    onChange={(event) => {
                      setDetailStartDate(event.target.value);
                      setUnitDirty(true);
                    }}
                  />
                </label>

                <label className="unit-field">
                  <span className="unit-field-label">Fin</span>
                  <input
                    className="input"
                    type="date"
                    value={detailEndDate}
                    onChange={(event) => {
                      setDetailEndDate(event.target.value);
                      setUnitDirty(true);
                    }}
                  />
                </label>

                <label className="unit-field">
                  <span className="unit-field-label">Sesiones</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={detailSessionCount}
                    onChange={(event) => {
                      setDetailSessionCount(Math.max(1, Number(event.target.value) || 1));
                      setUnitDirty(true);
                    }}
                  />
                </label>
              </div>
            </>
          ) : (
            <p>Selecciona una unidad para editarla.</p>
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



