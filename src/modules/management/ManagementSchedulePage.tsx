import { useCallback, useEffect, useMemo, useState } from "react";
import { useManagement } from "./ManagementContext";
import { IconButton } from "../../shared/ui/IconButton";
import { Modal } from "../../shared/ui/Modal";
import type { ScheduleBlock, ScheduleDay } from "../../shared/db/types";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

function snapTimeToFiveMinutes(value: string): string {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value;
  }
  const snappedMinute = Math.round(minute / 5) * 5;
  if (snappedMinute === 60) {
    const nextHour = (hour + 1) % 24;
    return `${String(nextHour).padStart(2, "0")}:00`;
  }
  return `${String(hour).padStart(2, "0")}:${String(snappedMinute).padStart(2, "0")}`;
}

function sortBlocksByTime(blocks: ScheduleBlock[]): ScheduleBlock[] {
  return [...blocks].sort((a, b) => {
    const byStart = a.startTime.localeCompare(b.startTime);
    if (byStart !== 0) {
      return byStart;
    }
    return a.endTime.localeCompare(b.endTime);
  });
}

function addMinutesToTime(value: string, minutesToAdd: number): string {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value;
  }
  const totalMinutes = (hour * 60 + minute + minutesToAdd + 24 * 60) % (24 * 60);
  const nextHour = Math.floor(totalMinutes / 60);
  const nextMinute = totalMinutes % 60;
  return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
}

function normalizeDurationMinutes(value: number): number {
  if (Number.isNaN(value) || value <= 0) {
    return 50;
  }
  const snapped = Math.round(value / 5) * 5;
  return Math.max(5, snapped);
}

function TimeSelect({
  value,
  disabled,
  onChange
}: {
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const normalized = snapTimeToFiveMinutes(value);
  const [hour = "00", minute = "00"] = normalized.split(":");

  return (
    <span className="time-select">
      <select
        className="input time-select-input"
        value={hour}
        disabled={disabled}
        onChange={(event) => onChange(`${event.target.value}:${minute}`)}
      >
        {HOUR_OPTIONS.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <span className="time-separator">:</span>
      <select
        className="input time-select-input"
        value={minute}
        disabled={disabled}
        onChange={(event) => onChange(`${hour}:${event.target.value}`)}
      >
        {MINUTE_OPTIONS.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </span>
  );
}

export function ManagementSchedulePage() {
  const {
    scheduleDays,
    scheduleSettings,
    updateScheduleDay,
    updateScheduleSettings,
    createDefaultScheduleDays
  } = useManagement();

  const [selectedDayId, setSelectedDayId] = useState("");
  const [draggingDayId, setDraggingDayId] = useState<string | null>(null);
  const [dropDayId, setDropDayId] = useState<string | null>(null);
  const [detailDay, setDetailDay] = useState<ScheduleDay | null>(null);
  const [dirty, setDirty] = useState(false);
  const [durationDirty, setDurationDirty] = useState(false);
  const [defaultDuration, setDefaultDuration] = useState(50);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  useEffect(() => {
    if (!selectedDayId && scheduleDays.length > 0) {
      setSelectedDayId(scheduleDays[0].id);
    }
    const exists = scheduleDays.some((day) => day.id === selectedDayId);
    if (!exists && scheduleDays.length > 0) {
      setSelectedDayId(scheduleDays[0].id);
    }
  }, [scheduleDays, selectedDayId]);

  const selectedDay = useMemo(
    () => scheduleDays.find((day) => day.id === selectedDayId) ?? null,
    [scheduleDays, selectedDayId]
  );

  useEffect(() => {
    if (!selectedDay) {
      setDetailDay(null);
      setDirty(false);
      return;
    }
    setDetailDay(selectedDay);
    setDirty(false);
  }, [selectedDay]);

  useEffect(() => {
    setDefaultDuration(normalizeDurationMinutes(scheduleSettings.defaultBlockDurationMinutes));
    setDurationDirty(false);
  }, [scheduleSettings]);

  const persistSchedule = useCallback(async (): Promise<void> => {
    if (durationDirty) {
      await updateScheduleSettings({
        id: "default",
        defaultBlockDurationMinutes: normalizeDurationMinutes(defaultDuration)
      });
      setDurationDirty(false);
    }
    if (detailDay && dirty) {
      await updateScheduleDay(detailDay);
      setDirty(false);
    }
  }, [defaultDuration, detailDay, dirty, durationDirty, updateScheduleDay, updateScheduleSettings]);

  const patchDetail = (next: ScheduleDay) => {
    setDetailDay(next);
    setDirty(true);
  };

  const hasPendingChanges = durationDirty || dirty;

  const ensureNoPendingChanges = (): boolean => {
    if (!hasPendingChanges) {
      return true;
    }
    setShowUnsavedModal(true);
    return false;
  };

  useUnsavedChangesGuard(hasPendingChanges);

  const addBlock = () => {
    if (!detailDay) {
      return;
    }
    const sortedExisting = sortBlocksByTime(detailDay.blocks);
    const previousBlock = sortedExisting[sortedExisting.length - 1];
    const durationMinutes = normalizeDurationMinutes(defaultDuration);
    const startTime = previousBlock ? previousBlock.endTime : "08:00";
    const endTime = addMinutesToTime(startTime, durationMinutes);
    const newBlock: ScheduleBlock = {
      id: crypto.randomUUID(),
      startTime,
      endTime
    };
    patchDetail({ ...detailDay, blocks: sortBlocksByTime([...sortedExisting, newBlock]) });
  };

  const updateBlock = (blockId: string, field: "startTime" | "endTime", value: string) => {
    if (!detailDay) {
      return;
    }
    patchDetail({
      ...detailDay,
      blocks: sortBlocksByTime(
        detailDay.blocks.map((block) =>
          block.id === blockId ? { ...block, [field]: snapTimeToFiveMinutes(value) } : block
        )
      )
    });
  };

  const removeBlock = (blockId: string) => {
    if (!detailDay) {
      return;
    }
    patchDetail({ ...detailDay, blocks: detailDay.blocks.filter((block) => block.id !== blockId) });
  };

  const copyDaySchedule = (sourceDayId: string, targetDayId: string) => {
    if (sourceDayId === targetDayId) {
      return;
    }
    const sourceDay = scheduleDays.find((day) => day.id === sourceDayId);
    const targetDay = scheduleDays.find((day) => day.id === targetDayId);
    if (!sourceDay || !targetDay) {
      return;
    }

    const sourceBlocks = sortBlocksByTime(sourceDay.blocks);
    const targetBlocks = sortBlocksByTime(targetDay.blocks);
    const copiedBlocks = sourceBlocks.map((block, index) => ({
      id: targetBlocks[index]?.id ?? crypto.randomUUID(),
      startTime: block.startTime,
      endTime: block.endTime
    }));
    void updateScheduleDay({
      ...targetDay,
      enabled: sourceDay.enabled,
      blocks: sortBlocksByTime(copiedBlocks)
    });
  };

  return (
    <>
      <article className="management-card">
      <h3>Horario</h3>
      <div className="inline-form">
        <label>
          Duración global (min)
          <input
            className="input"
            type="number"
            min={5}
            step={5}
            value={defaultDuration}
            onChange={(event) => {
              setDefaultDuration(normalizeDurationMinutes(Number(event.target.value)));
              setDurationDirty(true);
            }}
          />
        </label>
        <IconButton
          icon="save"
          label="Guardar horario"
          className={hasPendingChanges ? "save-attention" : ""}
          disabled={!hasPendingChanges}
          onClick={async () => {
            await persistSchedule();
          }}
        />
      </div>

      <div className="courses-layout">
        <aside className="courses-list-panel">
          <div className="courses-list-header">
            <strong>Días</strong>
          </div>
          <div className="courses-list section-tabs" role="tablist" aria-label="Secciones de horario">
            {scheduleDays.map((day) => (
              <button
                key={day.id}
                type="button"
                role="tab"
                aria-selected={selectedDayId === day.id}
                className={`section-tab ${selectedDayId === day.id ? "active" : ""} ${
                  dropDayId === day.id ? "drop-target" : ""
                }`}
                onClick={() => {
                  if (!ensureNoPendingChanges()) {
                    return;
                  }
                  setSelectedDayId(day.id);
                }}
                draggable
                onDragStart={(event) => {
                  setDraggingDayId(day.id);
                  event.dataTransfer.setData("text/day-id", day.id);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropDayId(day.id);
                }}
                onDragLeave={() => setDropDayId(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceDayId = event.dataTransfer.getData("text/day-id") || draggingDayId;
                  if (sourceDayId) {
                    if (!ensureNoPendingChanges()) {
                      setDraggingDayId(null);
                      setDropDayId(null);
                      return;
                    }
                    copyDaySchedule(sourceDayId, day.id);
                  }
                  setDraggingDayId(null);
                  setDropDayId(null);
                }}
                onDragEnd={() => {
                  setDraggingDayId(null);
                  setDropDayId(null);
                }}
              >
                <span>{day.dayName}</span>
                <small>{day.enabled ? `Activo · ${day.blocks.length} bloques` : "Desactivado"}</small>
              </button>
            ))}
            {scheduleDays.length === 0 ? (
              <div className="hint">
                <p>No hay dias creados.</p>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={async () => {
                    await createDefaultScheduleDays();
                  }}
                >
                  Crear dias de la semana
                </button>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="course-detail-panel">
          {detailDay ? (
            <>
              <div className="course-detail-header">
                <div className="schedule-day-title">
                  <h4>{detailDay.dayName}</h4>
                  <label>
                    <input
                      type="checkbox"
                      checked={detailDay.enabled}
                      onChange={(event) => patchDetail({ ...detailDay, enabled: event.target.checked })}
                    />{" "}
                    Activo
                  </label>
                </div>
                <div className="inline-form" style={{ margin: 0 }}>
                  <IconButton icon="add" label="Añadir bloque" onClick={addBlock} disabled={!detailDay.enabled} />
                </div>
              </div>

              {detailDay.enabled ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Inicio</th>
                        <th>Fin</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailDay.blocks.map((block) => (
                        <tr key={block.id}>
                          <td>
                            <TimeSelect
                              value={block.startTime}
                              onChange={(nextValue) => updateBlock(block.id, "startTime", nextValue)}
                            />
                          </td>
                          <td>
                            <TimeSelect
                              value={block.endTime}
                              onChange={(nextValue) => updateBlock(block.id, "endTime", nextValue)}
                            />
                          </td>
                          <td className="actions-cell">
                            <IconButton
                              icon="remove"
                              label="Quitar bloque"
                              onClick={() => removeBlock(block.id)}
                            />
                          </td>
                        </tr>
                      ))}
                      {detailDay.blocks.length === 0 ? (
                        <tr>
                          <td colSpan={3}>No hay bloques para este día.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>Día desactivado.</p>
              )}
            </>
          ) : (
            <p>No hay días de horario configurados.</p>
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



