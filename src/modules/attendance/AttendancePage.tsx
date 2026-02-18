import { useEffect, useMemo, useState } from "react";
import { db } from "../../shared/db/database";
import type { AttendanceEntry, ScheduleDay, Student, Subject } from "../../shared/db/types";
import { getStudentFullName } from "../../shared/utils/student";
import { IconButton } from "../../shared/ui/IconButton";

const today = new Date().toISOString().slice(0, 10);
const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];
const DAY_LABELS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

type SubjectSlot = {
  key: string;
  subjectId: string;
  subjectName: string;
  slotId: string;
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
};

function statusLabel(value: AttendanceEntry["status"]): string {
  if (value === "present") return "Presente";
  if (value === "late") return "Retraso";
  return "Ausente";
}

function toMinutes(value: string): number {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return 0;
  }
  return hour * 60 + minute;
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mondayFirstIndex(value: Date): number {
  return (value.getDay() + 6) % 7;
}

function monthStart(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, delta: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + delta, 1);
}

function shiftIsoDate(value: string, deltaDays: number): string {
  const [year, month, day] = value.split("-").map((item) => Number(item));
  if (!year || !month || !day) {
    return value;
  }
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + deltaDays);
  return toIsoDate(date);
}

function monthGrid(value: Date): { date: Date; inMonth: boolean }[] {
  const start = monthStart(value);
  const startOffset = mondayFirstIndex(start);
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - startOffset);

  const items: { date: Date; inMonth: boolean }[] = [];
  for (let index = 0; index < 42; index += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + index);
    items.push({
      date: current,
      inMonth: current.getMonth() === value.getMonth()
    });
  }
  return items;
}

function isoDayOfWeek(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map((item) => Number(item));
  if (!year || !month || !day) {
    return 0;
  }
  const value = new Date(year, month - 1, day);
  const jsDay = value.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function getNearestSlotKey(slots: SubjectSlot[]): string {
  if (slots.length === 0) {
    return "";
  }
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let best = slots[0];
  let bestDistance = Math.abs(toMinutes(best.startTime) - nowMinutes);
  for (let index = 1; index < slots.length; index += 1) {
    const current = slots[index];
    const distance = Math.abs(toMinutes(current.startTime) - nowMinutes);
    if (distance < bestDistance) {
      best = current;
      bestDistance = distance;
    }
  }
  return best.key;
}

export function AttendancePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => monthStart(new Date()));
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);
  const [draftStatusByStudent, setDraftStatusByStudent] = useState<Map<string, AttendanceEntry["status"]>>(
    new Map()
  );
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [attendanceNotice, setAttendanceNotice] = useState("");
  const [attendanceRecordedByDate, setAttendanceRecordedByDate] = useState<Map<string, number>>(new Map());
  const [attendanceExpectedByDate, setAttendanceExpectedByDate] = useState<Map<string, number>>(new Map());
  const [coverageVersion, setCoverageVersion] = useState(0);

  const loadMetadata = async (): Promise<void> => {
    const [subjectsData, scheduleDaysData] = await Promise.all([
      db.subjects.orderBy("name").toArray(),
      db.scheduleDays.orderBy("dayOfWeek").toArray()
    ]);
    setSubjects(subjectsData);
    setScheduleDays(scheduleDaysData);
    if (!selectedSubjectId && subjectsData.length > 0) {
      setSelectedSubjectId(subjectsData[0].id);
    }
  };

  const dayOfWeek = useMemo(() => {
    const date = new Date(`${selectedDate}T00:00:00`);
    const jsDay = date.getDay();
    return jsDay === 0 ? 7 : jsDay;
  }, [selectedDate]);
  const selectedDayName = DAY_LABELS[Math.max(0, Math.min(6, dayOfWeek - 1))] ?? "";

  const subjectSlotsForDate = useMemo(() => {
    const slots: SubjectSlot[] = [];
    const day = scheduleDays.find((item) => item.enabled && item.dayOfWeek === dayOfWeek);
    if (!day) {
      return slots;
    }

    for (const subject of subjects) {
      const subjectSlotIds = new Set(subject.scheduleSlotIds ?? []);
      for (const block of day.blocks) {
        if (!subjectSlotIds.has(block.id)) {
          continue;
        }
        slots.push({
          key: `${subject.id}:${block.id}`,
          subjectId: subject.id,
          subjectName: subject.name,
          slotId: block.id,
          dayOfWeek: day.dayOfWeek,
          dayName: day.dayName,
          startTime: block.startTime,
          endTime: block.endTime
        });
      }
    }

    return slots.sort((a, b) => {
      const byStart = a.startTime.localeCompare(b.startTime);
      if (byStart !== 0) {
        return byStart;
      }
      return a.subjectName.localeCompare(b.subjectName);
    });
  }, [dayOfWeek, scheduleDays, subjects]);

  useEffect(() => {
    if (subjectSlotsForDate.length === 0) {
      setSelectedSlotKey("");
      return;
    }
    let effectiveSubjectId = selectedSubjectId;
    if (!effectiveSubjectId) {
      effectiveSubjectId = subjectSlotsForDate[0].subjectId;
      setSelectedSubjectId(effectiveSubjectId);
    }
    const subjectSlots = subjectSlotsForDate.filter((slot) => slot.subjectId === effectiveSubjectId);
    const exists = subjectSlots.some((slot) => slot.key === selectedSlotKey);
    if (exists) {
      return;
    }
    if (subjectSlots.length > 0) {
      setSelectedSlotKey(getNearestSlotKey(subjectSlots));
      return;
    }
    setSelectedSlotKey("");
  }, [selectedSlotKey, selectedSubjectId, subjectSlotsForDate]);

  const selectedSubjectSlot = useMemo(
    () => subjectSlotsForDate.find((slot) => slot.key === selectedSlotKey) ?? null,
    [selectedSlotKey, subjectSlotsForDate]
  );
  const activeCalendarSubjectId = selectedSubjectId || selectedSubjectSlot?.subjectId || "";
  const selectedSubject = useMemo(
    () => subjects.find((item) => item.id === activeCalendarSubjectId) ?? null,
    [activeCalendarSubjectId, subjects]
  );

  useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
      return;
    }
    const exists = subjects.some((item) => item.id === selectedSubjectId);
    if (!exists && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [selectedSubjectId, subjects]);

  useEffect(() => {
    const [year, month] = selectedDate.split("-").map((item) => Number(item));
    if (!year || !month) {
      return;
    }
    setCalendarMonth(new Date(year, month - 1, 1));
  }, [selectedDate]);

  const loadData = async () => {
    if (!selectedSubjectSlot) {
      setStudents([]);
      setAttendanceEntries([]);
      return;
    }

    const links = await db.subjectStudentLinks.where("subjectId").equals(selectedSubjectSlot.subjectId).toArray();
    const studentIds = links.map((link) => link.studentId);
    if (studentIds.length === 0) {
      setStudents([]);
      setAttendanceEntries([]);
      return;
    }

    const [studentsData, attendanceData] = await Promise.all([
      db.students.where("id").anyOf(studentIds).toArray(),
      db.attendanceEntries.where("studentId").anyOf(studentIds).toArray()
    ]);

    setStudents(studentsData.sort((a, b) => getStudentFullName(a).localeCompare(getStudentFullName(b))));
    setAttendanceEntries(
      attendanceData.filter(
        (entry) => entry.date === selectedDate && (entry.scheduleSlotId ?? "") === selectedSubjectSlot.slotId
      )
    );
  };

  useEffect(() => {
    void loadMetadata();
  }, []);

  useEffect(() => {
    void loadData();
  }, [selectedDate, selectedSubjectSlot?.slotId, selectedSubjectSlot?.subjectId]);

  useEffect(() => {
    setDraftStatusByStudent(new Map());
    setAttendanceNotice("");
  }, [selectedDate, selectedSubjectSlot?.key, students.length, attendanceEntries.length]);

  useEffect(() => {
    const loadCalendarCoverage = async () => {
      if (!selectedSubject) {
        setAttendanceRecordedByDate(new Map());
        setAttendanceExpectedByDate(new Map());
        return;
      }

      const monthStartDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
      const monthEndDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
      const fromIso = toIsoDate(monthStartDate);
      const toIso = toIsoDate(monthEndDate);

      const links = await db.subjectStudentLinks.where("subjectId").equals(selectedSubject.id).toArray();
      const studentIds = links.map((item) => item.studentId);
      if (studentIds.length === 0) {
        setAttendanceRecordedByDate(new Map());
        setAttendanceExpectedByDate(new Map());
        return;
      }

      const subjectSlotIds = new Set(selectedSubject.scheduleSlotIds ?? []);
      const slotIdsByDayOfWeek = new Map<number, string[]>();
      for (const day of scheduleDays) {
        if (!day.enabled) {
          continue;
        }
        const slotIds = day.blocks
          .map((block) => block.id)
          .filter((slotId) => subjectSlotIds.has(slotId));
        if (slotIds.length > 0) {
          slotIdsByDayOfWeek.set(day.dayOfWeek, slotIds);
        }
      }

      const expectedByDate = new Map<string, number>();
      const dateCursor = new Date(monthStartDate);
      while (dateCursor <= monthEndDate) {
        const iso = toIsoDate(dateCursor);
        const dow = isoDayOfWeek(iso);
        const slotIds = slotIdsByDayOfWeek.get(dow) ?? [];
        if (slotIds.length > 0) {
          expectedByDate.set(iso, slotIds.length * studentIds.length);
        }
        dateCursor.setDate(dateCursor.getDate() + 1);
      }

      const monthEntries = (
        await db.attendanceEntries.where("studentId").anyOf(studentIds).toArray()
      ).filter(
        (entry) =>
          subjectSlotIds.has(entry.scheduleSlotId ?? "") &&
          entry.date >= fromIso &&
          entry.date <= toIso
      );

      const uniquePairsByDate = new Map<string, Set<string>>();
      for (const entry of monthEntries) {
        if (!expectedByDate.has(entry.date)) {
          continue;
        }
        const pairSet = uniquePairsByDate.get(entry.date) ?? new Set<string>();
        pairSet.add(`${entry.studentId}:${entry.scheduleSlotId ?? ""}`);
        uniquePairsByDate.set(entry.date, pairSet);
      }

      const recordedByDate = new Map<string, number>();
      for (const [date, pairSet] of uniquePairsByDate.entries()) {
        recordedByDate.set(date, pairSet.size);
      }

      setAttendanceExpectedByDate(expectedByDate);
      setAttendanceRecordedByDate(recordedByDate);
    };

    void loadCalendarCoverage();
  }, [calendarMonth, coverageVersion, scheduleDays, selectedSubject]);

  const attendanceByStudent = useMemo(() => {
    const map = new Map<string, AttendanceEntry>();
    for (const entry of attendanceEntries) {
      map.set(entry.studentId, entry);
    }
    return map;
  }, [attendanceEntries]);

  const studentsById = useMemo(() => {
    const map = new Map<string, Student>();
    for (const student of students) {
      map.set(student.id, student);
    }
    return map;
  }, [students]);

  const baseStatusByStudent = useMemo(() => {
    const map = new Map<string, AttendanceEntry["status"]>();
    for (const student of students) {
      map.set(student.id, attendanceByStudent.get(student.id)?.status ?? "present");
    }
    return map;
  }, [attendanceByStudent, students]);

  const attendanceDirty = draftStatusByStudent.size > 0;

  const setDraftStatus = (studentId: string, status: AttendanceEntry["status"]): void => {
    const baseStatus = baseStatusByStudent.get(studentId) ?? "present";
    setDraftStatusByStudent((prev) => {
      const next = new Map(prev);
      if (status === baseStatus) {
        next.delete(studentId);
      } else {
        next.set(studentId, status);
      }
      return next;
    });
    setAttendanceNotice("");
  };

  const saveAttendance = async (): Promise<void> => {
    if (!selectedSubjectSlot) {
      return;
    }
    setIsSavingAttendance(true);
    try {
      for (const student of students) {
        const studentId = student.id;
        const status =
          draftStatusByStudent.get(studentId) ??
          attendanceByStudent.get(studentId)?.status ??
          "present";
        const studentRecord = studentsById.get(studentId);
        if (!studentRecord) {
          continue;
        }
        const existing = attendanceByStudent.get(studentId);
        await db.attendanceEntries.put({
          id:
            existing?.id ??
            `att-${selectedSubjectSlot.subjectId}-${studentId}-${selectedDate}-${selectedSubjectSlot.slotId}`,
          classId: studentRecord.classId,
          studentId,
          date: selectedDate,
          scheduleSlotId: selectedSubjectSlot.slotId,
          status,
          note: existing?.note
        });
      }
      setDraftStatusByStudent(new Map());
      setAttendanceNotice("Asistencia guardada.");
      await loadData();
      setCoverageVersion((current) => current + 1);
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const ensureCanChangeContext = (): boolean => {
    if (!attendanceDirty) {
      return true;
    }
    setAttendanceNotice("Tienes cambios sin guardar. Pulsa Guardar asistencia antes de cambiar.");
    return false;
  };

  const calendarCells = useMemo(() => monthGrid(calendarMonth), [calendarMonth]);

  return (
    <section className="module-card">
      <h2>Asistencia por asignatura</h2>

      <div className="courses-layout">
        <aside className="courses-list-panel">
          <div className="attendance-day-nav">
            <button
              type="button"
              className="icon-btn"
              aria-label="Dia anterior"
              onClick={() => {
                if (!ensureCanChangeContext()) {
                  return;
                }
                setSelectedDate((current) => shiftIsoDate(current, -1));
              }}
            >
              {"<"}
            </button>
            <strong>{selectedDayName}</strong>
            <small>{selectedDate}</small>
            <button
              type="button"
              className="icon-btn"
              aria-label="Dia siguiente"
              onClick={() => {
                if (!ensureCanChangeContext()) {
                  return;
                }
                setSelectedDate((current) => shiftIsoDate(current, 1));
              }}
            >
              {">"}
            </button>
          </div>
          <div className="courses-list section-tabs" role="tablist" aria-label="Combinaciones de asignatura y hora">
            {subjectSlotsForDate.map((slot) => (
              <button
                key={slot.key}
                type="button"
                role="tab"
                aria-selected={selectedSlotKey === slot.key}
                className={`section-tab ${selectedSlotKey === slot.key ? "active" : ""}`}
                onClick={() => {
                  if (!ensureCanChangeContext()) {
                    return;
                  }
                  setSelectedSlotKey(slot.key);
                  setSelectedSubjectId(slot.subjectId);
                }}
              >
                <span>{slot.subjectName}</span>
                <small>
                  {slot.startTime} - {slot.endTime}
                </small>
              </button>
            ))}
            {subjectSlotsForDate.length === 0 ? (
              <p className="hint">No hay combinaciones de asignatura y hora para este dia.</p>
            ) : null}
          </div>
          <section className="attendance-calendar">
            <div className="attendance-calendar-header">
              <button
                type="button"
                className="icon-btn"
                aria-label="Mes anterior"
                onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
              >
                {"<"}
              </button>
              <strong>
                {MONTH_LABELS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
              </strong>
              <button
                type="button"
                className="icon-btn"
                aria-label="Mes siguiente"
                onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
              >
                {">"}
              </button>
            </div>
            <div className="attendance-calendar-grid" role="grid" aria-label="Calendario de asistencia">
              {WEEKDAY_LABELS.map((item) => (
                <span key={item} className="attendance-calendar-weekday">
                  {item}
                </span>
              ))}
              {calendarCells.map((cell) => {
                const iso = toIsoDate(cell.date);
                const expectedCount = attendanceExpectedByDate.get(iso) ?? 0;
                const isClassDay = expectedCount > 0;
                const entriesCount = attendanceRecordedByDate.get(iso) ?? 0;
                const isFuture = iso > today;
                const isToday = iso === today;
                const isDone = isClassDay && entriesCount >= expectedCount;
                const isMissing =
                  isClassDay && !isFuture && entriesCount === 0;
                const isPartial =
                  isClassDay &&
                  !isFuture &&
                  entriesCount > 0 &&
                  entriesCount < expectedCount;
                const isSelected = selectedDate === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`attendance-calendar-day ${cell.inMonth ? "" : "outside"} ${
                      isDone ? "done" : isMissing ? "missing" : isPartial ? "partial" : ""
                    } ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
                    onClick={() => {
                      if (!ensureCanChangeContext()) {
                        return;
                      }
                      setSelectedDate(iso);
                    }}
                  >
                    {cell.date.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="attendance-calendar-legend">
              <span className="attendance-dot today">Hoy</span>
              <span className="attendance-dot done">Lista pasada</span>
              <span className="attendance-dot partial">Parcial</span>
              <span className="attendance-dot missing">Sin pasar lista</span>
            </div>
          </section>
        </aside>

        <section className="course-detail-panel">
          {selectedSubjectSlot ? (
            <>
              <div className="course-detail-header">
                <div>
                  <h4>{selectedSubjectSlot.subjectName}</h4>
                  <p>
                    {selectedSubjectSlot.dayName} · {selectedSubjectSlot.startTime} - {selectedSubjectSlot.endTime}
                  </p>
                </div>
              </div>

              <div className="actions-cell" style={{ marginBottom: 8 }}>
                <IconButton
                  icon="save"
                  label="Guardar asistencia"
                  className={attendanceDirty ? "save-attention" : ""}
                  disabled={isSavingAttendance}
                  onClick={async () => {
                    await saveAttendance();
                  }}
                />
              </div>
              {attendanceNotice ? <p className="hint">{attendanceNotice}</p> : null}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Alumno</th>
                      <th>Estado</th>
                      <th>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const entry = attendanceByStudent.get(student.id);
                      const status = entry?.status ?? "present";

                      return (
                        <tr key={student.id}>
                          <td>{getStudentFullName(student)}</td>
                          <td>
                            <select
                              className="status-select"
                              value={draftStatusByStudent.get(student.id) ?? status}
                              onChange={(event) =>
                                setDraftStatus(student.id, event.target.value as AttendanceEntry["status"])
                              }
                            >
                              <option value="present">Presente</option>
                              <option value="late">Retraso</option>
                              <option value="absent">Ausente</option>
                            </select>
                          </td>
                          <td>{entry?.note ?? statusLabel(status)}</td>
                        </tr>
                      );
                    })}
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={3}>No hay alumnos en esta asignatura.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p>Selecciona una combinacion de asignatura y hora para pasar lista.</p>
          )}
        </section>
      </div>
    </section>
  );
}
