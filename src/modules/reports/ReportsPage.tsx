import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import { db } from "../../shared/db/database";
import type { Assessment, AttendanceEntry, GradeEntry, Student } from "../../shared/db/types";

const today = new Date().toISOString().slice(0, 10);

export function ReportsPage() {
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [entries, setEntries] = useState<GradeEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!selectedClassId) {
        setStudents([]);
        setAssessments([]);
        setEntries([]);
        setAttendance([]);
        return;
      }

      const [studentsData, assessmentsData, entriesData, attendanceData] = await Promise.all([
        db.students.where("classId").equals(selectedClassId).toArray(),
        db.assessments.where("classId").equals(selectedClassId).toArray(),
        db.gradeEntries.where("classId").equals(selectedClassId).toArray(),
        db.attendanceEntries.where("[classId+date]").equals([selectedClassId, today]).toArray()
      ]);

      setStudents(studentsData);
      setAssessments(assessmentsData);
      setEntries(entriesData);
      setAttendance(attendanceData);
    };

    void loadData();
  }, [selectedClassId]);

  const avgGrade = useMemo(() => {
    const values = entries
      .map((entry) => entry.numericValue)
      .filter((value): value is number => typeof value === "number");
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [entries]);

  const attendanceRate = useMemo(() => {
    if (!students.length) return 0;
    const valid = attendance.filter((item) => item.status !== "absent").length;
    return Math.round((valid / students.length) * 100);
  }, [attendance, students.length]);

  const updated = new Date().toLocaleDateString("es-ES");
  const reportTemplates = [
    { name: "Informe individual", format: "PDF", updated },
    { name: "Acta de grupo", format: "Excel", updated },
    { name: "Resumen de asistencia", format: "PDF", updated }
  ];

  return (
    <section className="module-card">
      <h2>Informes y exportaciones</h2>

      <div className="metric-grid">
        <article className="metric-item">
          <strong>Alumnos</strong>
          <div>{students.length}</div>
        </article>
        <article className="metric-item">
          <strong>Evaluaciones</strong>
          <div>{assessments.length}</div>
        </article>
        <article className="metric-item">
          <strong>Media global</strong>
          <div>{avgGrade !== null ? avgGrade.toFixed(2) : "-"}</div>
        </article>
        <article className="metric-item">
          <strong>Asistencia hoy</strong>
          <div>{attendanceRate}%</div>
        </article>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Plantilla</th>
              <th>Formato</th>
              <th>Última actualización</th>
            </tr>
          </thead>
          <tbody>
            {reportTemplates.map((item) => (
              <tr key={item.name}>
                <td>{item.name}</td>
                <td>{item.format}</td>
                <td>{item.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
