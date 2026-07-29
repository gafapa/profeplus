import { useCallback, useEffect, useMemo, useState } from "react";
import { useManagement } from "./ManagementContext";
import { IconButton } from "../../shared/ui/IconButton";
import type { ScheduleBlock, ScheduleDay } from "../../shared/db/types";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";
import { validateScheduleDay } from "../../shared/schedule/validation";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

function snapTimeToFiveMinutes(value: string): string {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
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
    if (byStart !== 0) return byStart;
    return a.endTime.localeCompare(b.endTime);
  });
}

function formatBlockSummary(blocks: ScheduleBlock[]): string {
  const breakCount = blocks.filter((block) => block.isBreak).length;
  const classCount = blocks.length - breakCount;
  if (breakCount === 0) return `${classCount} bloques`;
  if (classCount === 0) return `${breakCount} descansos`;
  return `${classCount} clases · ${breakCount} descansos`;
}

function addMinutesToTime(value: string, minutesToAdd: number): string {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
  const totalMinutes = (hour * 60 + minute + minutesToAdd + 24 * 60) % (24 * 60);
  const nextHour = Math.floor(totalMinutes / 60);
  const nextMinute = totalMinutes % 60;
  return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
}

function normalizeDurationMinutes(value: number): number {
  if (Number.isNaN(value) || value <= 0) return 50;
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
          <option key={item} value={item}>{item}</option>
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
          <option key={item} value={item}>{item}</option>
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
    updateScheduleSettings
  } = useManagement();

  const [selectedDayId, setSelectedDayId] = useState("");
  const [draggingDayId, setDraggingDayId] = useState<string | null>(null);
  const [dropDayId, setDropDayId] = useState<string | null>(null);
  const [detailDay, setDetailDay] = useState<ScheduleDay | null>(null);
  const [dirty, setDirty] = useState(false);
  const [durationDirty, setDurationDirty] = useState(false);
  const [defaultDuration, setDefaultDuration] = useState(50);
  useUnsavedChangesGuard(dirty || durationDirty, "Hay cambios del horario sin guardar.");

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

  // Debounced day autosave. The context action is intentionally omitted because its reference is unstable.
  useEffect(() => {
    if (!dirty || !detailDay) return;
    const day = detailDay;
    const timer = setTimeout(() => {
      void updateScheduleDay(day).then((saved) => {
        if (saved) setDirty(false);
      });
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, detailDay]);

  // Debounced duration autosave.
  useEffect(() => {
    if (!durationDirty) return;
    const mins = normalizeDurationMinutes(defaultDuration);
    const timer = setTimeout(() => {
      void updateScheduleSettings({ id: "default", defaultBlockDurationMinutes: mins }).then((saved) => {
        if (saved) setDurationDirty(false);
      });
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationDirty, defaultDuration]);

  const saveIfDirty = useCallback(async (): Promise<boolean> => {
    if (durationDirty) {
      const saved = await updateScheduleSettings({ id: "default", defaultBlockDurationMinutes: normalizeDurationMinutes(defaultDuration) });
      if (!saved) return false;
      setDurationDirty(false);
    }
    if (dirty && detailDay) {
      const saved = await updateScheduleDay(detailDay);
      if (!saved) return false;
      setDirty(false);
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationDirty, defaultDuration, dirty, detailDay]);

  const patchDetail = (next: ScheduleDay) => {
    setDetailDay(next);
    setDirty(true);
  };

  const scheduleValidationError = detailDay ? validateScheduleDay(detailDay) : null;

  const addBlock = () => {
    if (!detailDay) return;
    const sortedExisting = sortBlocksByTime(detailDay.blocks);
    const previousBlock = sortedExisting[sortedExisting.length - 1];
    const durationMinutes = normalizeDurationMinutes(defaultDuration);
    const startTime = previousBlock ? previousBlock.endTime : "08:00";
    const endTime = addMinutesToTime(startTime, durationMinutes);
    const newBlock: ScheduleBlock = { id: crypto.randomUUID(), startTime, endTime, isBreak: false };
    patchDetail({ ...detailDay, blocks: sortBlocksByTime([...sortedExisting, newBlock]) });
  };

  const updateBlock = (blockId: string, field: "startTime" | "endTime", value: string) => {
    if (!detailDay) return;
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
    if (!detailDay) return;
    patchDetail({ ...detailDay, blocks: detailDay.blocks.filter((block) => block.id !== blockId) });
  };

  const toggleBlockBreak = (blockId: string, isBreak: boolean) => {
    if (!detailDay) return;
    patchDetail({
      ...detailDay,
      blocks: detailDay.blocks.map((block) => (block.id === blockId ? { ...block, isBreak } : block))
    });
  };

  const copyDaySchedule = (sourceDayId: string, targetDayId: string) => {
    if (sourceDayId === targetDayId) return;
    const sourceDay = scheduleDays.find((day) => day.id === sourceDayId);
    const targetDay = scheduleDays.find((day) => day.id === targetDayId);
    if (!sourceDay || !targetDay) return;

    const sourceBlocks = sortBlocksByTime(sourceDay.blocks);
    const targetBlocks = sortBlocksByTime(targetDay.blocks);
    const copiedBlocks = sourceBlocks.map((block, index) => ({
      id: targetBlocks[index]?.id ?? crypto.randomUUID(),
      startTime: block.startTime,
      endTime: block.endTime,
      isBreak: block.isBreak
    }));
    void updateScheduleDay({ ...targetDay, enabled: sourceDay.enabled, blocks: sortBlocksByTime(copiedBlocks) });
  };

  return (
    <article className="management-card">
      <h1 className="sr-only">Horario</h1>
      <div className="inline-form split">
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
      </div>

      <div className="courses-layout">
        <aside className="courses-list-panel">
          <div className="courses-list-header">
            <strong>Días</strong>
          </div>
          <div className="courses-list section-tabs" role="group" aria-label="Secciones de horario">
            {scheduleDays.map((day) => {
              const displayedDay = detailDay?.id === day.id ? detailDay : day;
              return (
                <button
                  key={day.id}
                  type="button"
                  aria-pressed={selectedDayId === day.id}
                  className={`section-tab ${selectedDayId === day.id ? "active" : ""} ${
                    dropDayId === day.id ? "drop-target" : ""
                  }`}
                  onClick={async () => {
                    if (!(await saveIfDirty())) return;
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
                    if (sourceDayId) copyDaySchedule(sourceDayId, day.id);
                    setDraggingDayId(null);
                    setDropDayId(null);
                  }}
                  onDragEnd={() => {
                    setDraggingDayId(null);
                    setDropDayId(null);
                  }}
                >
                  <span>{day.dayName}</span>
                  <small>{displayedDay.enabled ? `Activo · ${formatBlockSummary(displayedDay.blocks)}` : "Desactivado"}</small>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="course-detail-panel">
          {detailDay ? (
            <>
              <div className="course-detail-header">
                <div className="schedule-day-title">
                  <h2>{detailDay.dayName}</h2>
                  <label>
                    <input
                      type="checkbox"
                      checked={detailDay.enabled}
                      onChange={(event) => patchDetail({ ...detailDay, enabled: event.target.checked })}
                    />{" "}
                    Activo
                  </label>
                </div>
                <div className="inline-form flush">
                  <IconButton icon="add" label="Añadir bloque" onClick={addBlock} disabled={!detailDay.enabled} />
                </div>
              </div>

              {detailDay.enabled ? (
                <>
                {scheduleValidationError ? <p className="notice compact" role="alert">{scheduleValidationError}</p> : null}
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Inicio</th>
                        <th>Fin</th>
                        <th>Tipo</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailDay.blocks.map((block) => (
                        <tr key={block.id} className={block.isBreak ? "schedule-break-row" : ""}>
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
                          <td>
                            <div className="schedule-block-type-control" aria-label={`Tipo de bloque ${block.startTime} - ${block.endTime}`}>
                              <button
                                type="button"
                                className={`schedule-block-type-option ${!block.isBreak ? "active" : ""}`}
                                aria-pressed={!block.isBreak}
                                onClick={() => toggleBlockBreak(block.id, false)}
                              >
                                Clase
                              </button>
                              <button
                                type="button"
                                className={`schedule-block-type-option break ${block.isBreak ? "active" : ""}`}
                                aria-pressed={Boolean(block.isBreak)}
                                onClick={() => toggleBlockBreak(block.id, true)}
                              >
                                Descanso
                              </button>
                            </div>
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
                          <td colSpan={4}>No hay bloques para este día.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                </>
              ) : (
                <p className="empty-state">Día desactivado.</p>
              )}
            </>
          ) : (
            <p className="empty-state">No hay días de horario configurados.</p>
          )}
        </section>
      </div>
    </article>
  );
}
