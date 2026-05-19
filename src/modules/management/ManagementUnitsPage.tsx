import { useCallback, useEffect, useMemo, useState } from "react";
import { useManagement } from "./ManagementContext";
import { useAppSelector } from "../../app/hooks";
import { ContextSidebarTabs } from "../../shared/ui/ContextSidebarTabs";
import { IconButton } from "../../shared/ui/IconButton";

export function ManagementUnitsPage() {
  const selectedSubjectId = useAppSelector((s) => s.app.selectedSubjectId);

  const { units, createEmptyUnit, updateUnit, deleteUnit } = useManagement();

  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [detailName, setDetailName] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [detailSessionCount, setDetailSessionCount] = useState(1);
  const [unitDirty, setUnitDirty] = useState(false);

  const unitsBySubject = useMemo(
    () =>
      units
        .filter((u) => u.subjectId === selectedSubjectId)
        .sort((a, b) => a.position - b.position),
    [selectedSubjectId, units]
  );

  useEffect(() => {
    if (unitsBySubject.length === 0) { setSelectedUnitId(""); return; }
    const exists = unitsBySubject.some((u) => u.id === selectedUnitId);
    if (!exists) setSelectedUnitId(unitsBySubject[0].id);
  }, [selectedSubjectId, unitsBySubject]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedUnit = unitsBySubject.find((u) => u.id === selectedUnitId) ?? null;

  useEffect(() => {
    if (!selectedUnit) {
      setDetailName("");
      setDetailDescription("");
      setDetailSessionCount(1);
      setUnitDirty(false);
      return;
    }
    setDetailName(selectedUnit.name ?? "");
    setDetailDescription(selectedUnit.description ?? "");
    setDetailSessionCount(selectedUnit.sessionCount ?? 1);
    setUnitDirty(false);
  }, [selectedUnit]);

  // Auto-guardado con debounce (updateUnit excluido de deps: su referencia cambia en cada render del contexto)
  useEffect(() => {
    if (!unitDirty || !selectedUnit) return;
    const name = detailName.trim();
    if (name.length < 2) return;
    const id = selectedUnit.id;
    const desc = detailDescription;
    const count = detailSessionCount;
    const timer = setTimeout(() => {
      void updateUnit(id, name, desc, count);
      setUnitDirty(false);
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitDirty, detailName, detailDescription, detailSessionCount, selectedUnit?.id]);

  const saveIfDirty = useCallback(async () => {
    if (!unitDirty || !selectedUnit) return;
    if (detailName.trim().length < 2) return;
    await updateUnit(selectedUnit.id, detailName.trim(), detailDescription, detailSessionCount);
    setUnitDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitDirty, detailName, detailDescription, detailSessionCount, selectedUnit?.id]);

  return (
    <article className="management-card">
      <div className="courses-layout">
        <aside className="courses-list-panel">
          <ContextSidebarTabs beforeChange={saveIfDirty} />
          <div className="courses-list-header">
            <strong>Unidades</strong>
            <IconButton
              icon="add"
              label="Crear unidad"
              disabled={!selectedSubjectId}
              onClick={async () => {
                await saveIfDirty();
                const createdId = await createEmptyUnit(selectedSubjectId);
                if (createdId) setSelectedUnitId(createdId);
              }}
            />
          </div>
          <div className="courses-list section-tabs" role="tablist" aria-label="Unidades">
            {selectedSubjectId ? unitsBySubject.map((unit) => (
              <div key={unit.id} className="courses-list-row">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedUnitId === unit.id}
                  className={`section-tab ${selectedUnitId === unit.id ? "active" : ""}`}
                  onClick={async () => {
                    await saveIfDirty();
                    setSelectedUnitId(unit.id);
                  }}
                >
                  <span>{unit.name || "Sin nombre"}</span>
                  <small>{unit.sessionCount} sesiones previstas</small>
                </button>
                <IconButton
                  icon="delete"
                  label={`Eliminar ${unit.name || "unidad"}`}
                  onClick={async () => {
                    await saveIfDirty();
                  await deleteUnit(unit.id);
                }}
              />
            </div>
            )) : null}
            {selectedSubjectId && unitsBySubject.length === 0 && (
              <p className="hint">No hay unidades en esta asignatura.</p>
            )}
          </div>
        </aside>

        <section className="course-detail-panel">
          {selectedUnit ? (
            <>
              <div className="course-detail-header">
                <h4>Detalle de unidad</h4>
              </div>

              <section className="detail-section">
                <div className="unit-detail-layout">
                  <label className="unit-field unit-field-full">
                    <span className="unit-field-label">Nombre</span>
                    <input
                      className="input"
                      placeholder="Nombre de la unidad"
                      value={detailName}
                      onChange={(e) => { setDetailName(e.target.value); setUnitDirty(true); }}
                    />
                  </label>

                  <label className="unit-field unit-field-full">
                    <span className="unit-field-label">Descripción</span>
                    <textarea
                      className="input"
                      placeholder="Descripción de la unidad"
                      value={detailDescription}
                      onChange={(e) => { setDetailDescription(e.target.value); setUnitDirty(true); }}
                    />
                  </label>

                  <label className="unit-field">
                    <span className="unit-field-label">Sesiones previstas</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={detailSessionCount}
                      onChange={(e) => {
                        setDetailSessionCount(Math.max(1, Number(e.target.value) || 1));
                        setUnitDirty(true);
                      }}
                    />
                  </label>
                </div>

                <p className="hint">
                  Las fechas de inicio y fin se calculan automáticamente a partir de las sesiones
                  registradas en el Diario.
                </p>
              </section>
            </>
          ) : (
            <p className="empty-state">
              {selectedSubjectId ? "Selecciona una unidad para editarla." : "Selecciona una asignatura en el panel izquierdo."}
            </p>
          )}
        </section>
      </div>
    </article>
  );
}
