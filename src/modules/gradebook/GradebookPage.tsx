import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import { db } from "../../shared/db/database";
import type { Assessment, GradeEntry, Student } from "../../shared/db/types";
import { getStudentFullName } from "../../shared/utils/student";

function assessmentLabel(assessment: Assessment): string {
  return `${assessment.title} (${assessment.weight}%)`;
}

function gradeCellKey(studentId: string, assessmentId: string): string {
  return `${studentId}:${assessmentId}`;
}

function calculateWeightedAverage(
  assessments: Assessment[],
  entriesByKey: Map<string, GradeEntry>,
  studentId: string
): number | null {
  let weightedSum = 0;
  let usedWeight = 0;

  for (const assessment of assessments) {
    const entry = entriesByKey.get(gradeCellKey(studentId, assessment.id));
    if (typeof entry?.numericValue === "number") {
      weightedSum += entry.numericValue * assessment.weight;
      usedWeight += assessment.weight;
    }
  }

  if (usedWeight === 0) {
    return null;
  }

  return weightedSum / usedWeight;
}

export function GradebookPage() {
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [entries, setEntries] = useState<GradeEntry[]>([]);
  const [newAssessmentTitle, setNewAssessmentTitle] = useState("");
  const [newAssessmentWeight, setNewAssessmentWeight] = useState("20");

  const loadData = async () => {
    if (!selectedClassId) {
      setStudents([]);
      setAssessments([]);
      setEntries([]);
      return;
    }

    const [studentsData, assessmentsData, gradeEntriesData] = await Promise.all([
      db.students.where("classId").equals(selectedClassId).toArray(),
      db.assessments.where("classId").equals(selectedClassId).toArray(),
      db.gradeEntries.where("classId").equals(selectedClassId).toArray()
    ]);

    setStudents(studentsData.sort((a, b) => getStudentFullName(a).localeCompare(getStudentFullName(b))));
    setAssessments(assessmentsData);
    setEntries(gradeEntriesData);
  };

  useEffect(() => {
    void loadData();
  }, [selectedClassId]);

  const entriesByKey = useMemo(() => {
    const map = new Map<string, GradeEntry>();
    for (const entry of entries) {
      map.set(gradeCellKey(entry.studentId, entry.assessmentId), entry);
    }
    return map;
  }, [entries]);

  const studentAverages = useMemo(
    () =>
      students.map((student) => ({
        studentId: student.id,
        average: calculateWeightedAverage(assessments, entriesByKey, student.id)
      })),
    [assessments, entriesByKey, students]
  );

  const groupAverage = useMemo(() => {
    const values = studentAverages
      .map((item) => item.average)
      .filter((value): value is number => typeof value === "number");

    if (values.length === 0) {
      return null;
    }
    return values.reduce((total, value) => total + value, 0) / values.length;
  }, [studentAverages]);

  const upsertGrade = async (
    studentId: string,
    assessmentId: string,
    rawValue: string
  ): Promise<void> => {
    if (!selectedClassId) {
      return;
    }

    const normalized = rawValue.replace(",", ".").trim();
    const parsed = Number(normalized);
    const key = gradeCellKey(studentId, assessmentId);
    const existing = entriesByKey.get(key);

    if (normalized.length === 0 || Number.isNaN(parsed)) {
      if (existing) {
        await db.gradeEntries.delete(existing.id);
      }
      await loadData();
      return;
    }

    const bounded = Math.min(10, Math.max(0, parsed));
    const payload: GradeEntry = {
      id: existing?.id ?? crypto.randomUUID(),
      classId: selectedClassId,
      assessmentId,
      studentId,
      numericValue: Number(bounded.toFixed(2))
    };
    await db.gradeEntries.put(payload);
    await loadData();
  };

  const createAssessment = async (): Promise<void> => {
    if (!selectedClassId) {
      return;
    }
    const title = newAssessmentTitle.trim();
    const weight = Number(newAssessmentWeight);

    if (title.length < 2 || Number.isNaN(weight) || weight <= 0) {
      return;
    }

    await db.assessments.add({
      id: crypto.randomUUID(),
      classId: selectedClassId,
      title,
      weight: Number(weight.toFixed(2)),
      period: "T1"
    });

    setNewAssessmentTitle("");
    setNewAssessmentWeight("20");
    await loadData();
  };

  const currentWeights = assessments.reduce((sum, assessment) => sum + assessment.weight, 0);

  return (
    <section className="module-card">
      <h2>Cuaderno de calificaciones</h2>

      <div className="metric-grid">
        <article className="metric-item">
          <strong>Alumnos</strong>
          <div>{students.length}</div>
        </article>
        <article className="metric-item">
          <strong>Media del grupo</strong>
          <div>{groupAverage !== null ? groupAverage.toFixed(2) : "-"}</div>
        </article>
        <article className="metric-item">
          <strong>Evaluaciones</strong>
          <div>
            {assessments.length} columnas ({currentWeights.toFixed(0)}% total)
          </div>
        </article>
      </div>

      <div className="inline-form">
        <input
          className="input"
          value={newAssessmentTitle}
          onChange={(event) => setNewAssessmentTitle(event.target.value)}
          placeholder="Nueva evaluación"
        />
        <input
          className="input"
          type="number"
          min={1}
          step={1}
          value={newAssessmentWeight}
          onChange={(event) => setNewAssessmentWeight(event.target.value)}
          placeholder="Peso %"
        />
        <button className="btn" type="button" onClick={() => void createAssessment()}>
          Agregar columna
        </button>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Alumno</th>
              {assessments.map((assessment) => (
                <th key={assessment.id}>{assessmentLabel(assessment)}</th>
              ))}
              <th>Nota final</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const average = studentAverages.find((item) => item.studentId === student.id)?.average;
              return (
                <tr key={student.id}>
                  <td>{getStudentFullName(student)}</td>
                  {assessments.map((assessment) => {
                    const entry = entriesByKey.get(gradeCellKey(student.id, assessment.id));
                    return (
                      <td key={`${student.id}-${assessment.id}`}>
                        <input
                          className="input grade-input"
                          type="number"
                          min={0}
                          max={10}
                          step={0.1}
                          defaultValue={
                            typeof entry?.numericValue === "number"
                              ? entry.numericValue.toString()
                              : ""
                          }
                          onBlur={(event) =>
                            void upsertGrade(student.id, assessment.id, event.target.value)
                          }
                        />
                      </td>
                    );
                  })}
                  <td>
                    <span className="pill">
                      {average !== null && average !== undefined ? average.toFixed(2) : "-"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
