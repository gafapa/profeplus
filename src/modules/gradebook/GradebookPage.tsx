import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import { db } from "../../shared/db/database";
import type {
  Assessment,
  ChecklistTemplate,
  GradeEntry,
  RubricTemplate,
  Student,
  Subject,
  Task,
  TaskChecklistAssessment,
  TaskDailyEvaluationSetting,
  TaskRubricAssessment,
  TaskSession,
  UnitBlock
} from "../../shared/db/types";
import { getStudentFullName } from "../../shared/utils/student";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";

function assessmentLabel(assessment: Assessment): string {
  return `${assessment.title} (${assessment.weight}%)`;
}

function gradeCellKey(studentId: string, assessmentId: string): string {
  return `${studentId}:${assessmentId}`;
}

function taskStudentKey(taskId: string, studentId: string): string {
  return `${taskId}:${studentId}`;
}

export function GradebookPage() {
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [entries, setEntries] = useState<GradeEntry[]>([]);
  const [includedTaskConfigs, setIncludedTaskConfigs] = useState<Task[]>([]);
  const [taskDailyEvaluationSettings, setTaskDailyEvaluationSettings] = useState<TaskDailyEvaluationSetting[]>([]);
  const [taskRubricAssessments, setTaskRubricAssessments] = useState<TaskRubricAssessment[]>([]);
  const [taskChecklistAssessments, setTaskChecklistAssessments] = useState<TaskChecklistAssessment[]>([]);
  const [rubricTemplates, setRubricTemplates] = useState<RubricTemplate[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [newAssessmentTitle, setNewAssessmentTitle] = useState("");
  const [newAssessmentWeight, setNewAssessmentWeight] = useState("20");
  const [pendingGradeKeys, setPendingGradeKeys] = useState<Set<string>>(new Set());
  const [gradebookNotice, setGradebookNotice] = useState("");
  const [includedTasks, setIncludedTasks] = useState<
    Array<{
      taskId: string;
      title: string;
      subjectName: string;
      unitName: string;
      sessionsCount: number;
      weight: number;
      instrument: string;
    }>
  >([]);

  const loadData = async () => {
    if (!selectedClassId) {
      setStudents([]);
      setAssessments([]);
      setEntries([]);
      setIncludedTaskConfigs([]);
      setTaskDailyEvaluationSettings([]);
      setTaskRubricAssessments([]);
      setTaskChecklistAssessments([]);
      setRubricTemplates([]);
      setChecklistTemplates([]);
      return;
    }

    const [studentsData, assessmentsData, gradeEntriesData] = await Promise.all([
      db.students.where("classId").equals(selectedClassId).toArray(),
      db.assessments.where("classId").equals(selectedClassId).toArray(),
      db.gradeEntries.where("classId").equals(selectedClassId).toArray()
    ]);

    const [
      linksData,
      tasksData,
      sessionsData,
      subjectsData,
      unitsData,
      taskDailySettingsData,
      taskRubricAssessmentsData,
      taskChecklistAssessmentsData,
      rubricTemplatesData,
      checklistTemplatesData
    ] = await Promise.all([
      db.subjectCourseLinks.where("classId").equals(selectedClassId).toArray(),
      db.tasks.filter((task) => Boolean(task.sendToGradebook)).toArray(),
      db.taskSessions.toArray(),
      db.subjects.toArray(),
      db.unitBlocks.toArray(),
      db.taskDailyEvaluationSettings.toArray(),
      db.taskRubricAssessments.toArray(),
      db.taskChecklistAssessments.toArray(),
      db.rubricTemplates.where("classId").equals(selectedClassId).toArray(),
      db.checklistTemplates.where("classId").equals(selectedClassId).toArray()
    ]);

    const allowedSubjectIds = new Set(linksData.map((item) => item.subjectId));
    const subjectsById = new Map<string, Subject>(subjectsData.map((item) => [item.id, item]));
    const unitsById = new Map<string, UnitBlock>(unitsData.map((item) => [item.id, item]));
    const sessionsByTask = new Map<string, TaskSession[]>();
    for (const session of sessionsData) {
      if (!sessionsByTask.has(session.taskId)) {
        sessionsByTask.set(session.taskId, []);
      }
      sessionsByTask.get(session.taskId)?.push(session);
    }
    const visibleTasks = tasksData
      .filter((task: Task) => allowedSubjectIds.has(task.subjectId))
      .map((task: Task) => ({
        taskId: task.id,
        title: task.title || "Tarea sin titulo",
        subjectName: subjectsById.get(task.subjectId)?.name ?? "-",
        unitName: task.unitId ? unitsById.get(task.unitId)?.name ?? "-" : "-",
        sessionsCount: sessionsByTask.get(task.id)?.length ?? 0,
        weight: Number(task.gradebookWeight ?? 0),
        instrument: task.rubricTemplateId ? "Rúbrica" : task.checklistTemplateId ? "Lista de cotejo" : "-"
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
    const visibleTaskIds = new Set(visibleTasks.map((item) => item.taskId));

    setStudents(studentsData.sort((a, b) => getStudentFullName(a).localeCompare(getStudentFullName(b))));
    setAssessments(assessmentsData);
    setEntries(gradeEntriesData);
    setIncludedTaskConfigs(tasksData.filter((task) => visibleTaskIds.has(task.id)));
    setTaskDailyEvaluationSettings(taskDailySettingsData.filter((item) => visibleTaskIds.has(item.taskId)));
    setTaskRubricAssessments(taskRubricAssessmentsData.filter((item) => visibleTaskIds.has(item.taskId)));
    setTaskChecklistAssessments(taskChecklistAssessmentsData.filter((item) => visibleTaskIds.has(item.taskId)));
    setRubricTemplates(rubricTemplatesData);
    setChecklistTemplates(checklistTemplatesData);
    setPendingGradeKeys(new Set());
    setIncludedTasks(visibleTasks);
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

  const taskScoreByTaskStudent = useMemo(() => {
    const scoreMap = new Map<string, number>();
    const rubricTemplateById = new Map<string, RubricTemplate>(rubricTemplates.map((item) => [item.id, item]));
    const checklistTemplateById = new Map<string, ChecklistTemplate>(
      checklistTemplates.map((item) => [item.id, item])
    );
    const settingsByTask = new Map<string, TaskDailyEvaluationSetting[]>();
    for (const setting of taskDailyEvaluationSettings) {
      if (!settingsByTask.has(setting.taskId)) {
        settingsByTask.set(setting.taskId, []);
      }
      settingsByTask.get(setting.taskId)?.push(setting);
    }

    for (const task of includedTaskConfigs) {
      const settings = settingsByTask.get(task.id) ?? [];
      for (const student of students) {
        const sessionScores: number[] = [];
        for (const setting of settings) {
          const sessionSlotId = setting.scheduleSlotId ?? "";
          const rubricId = task.rubricTemplateId || setting.rubricTemplateId || "";
          const checklistId = task.checklistTemplateId || setting.checklistTemplateId || "";
          if (rubricId) {
            const template = rubricTemplateById.get(rubricId);
            if (!template) {
              continue;
            }
            const maxScore = (template.criteria ?? []).reduce((sum, criterion) => {
              const criterionMax = Math.max(...(criterion.levels ?? []).map((level) => Number(level.score) || 0), 0);
              return sum + criterionMax;
            }, 0);
            if (maxScore <= 0) {
              continue;
            }
            const rows = taskRubricAssessments.filter(
              (row) =>
                row.taskId === task.id &&
                row.studentId === student.id &&
                row.date === setting.date &&
                (row.scheduleSlotId ?? "") === sessionSlotId
            );
            if (rows.length === 0) {
              continue;
            }
            const score = rows.reduce((sum, row) => sum + (Number(row.score) || 0), 0);
            sessionScores.push(Math.max(0, Math.min(10, (score / maxScore) * 10)));
            continue;
          }
          if (checklistId) {
            const template = checklistTemplateById.get(checklistId);
            const totalItems = template?.items?.length ?? 0;
            if (totalItems <= 0) {
              continue;
            }
            const checkedCount = taskChecklistAssessments.filter(
              (row) =>
                row.taskId === task.id &&
                row.studentId === student.id &&
                row.date === setting.date &&
                (row.scheduleSlotId ?? "") === sessionSlotId &&
                row.checked
            ).length;
            sessionScores.push(Math.max(0, Math.min(10, (checkedCount / totalItems) * 10)));
          }
        }
        if (sessionScores.length > 0) {
          const averageScore = sessionScores.reduce((sum, value) => sum + value, 0) / sessionScores.length;
          scoreMap.set(taskStudentKey(task.id, student.id), Number(averageScore.toFixed(2)));
        }
      }
    }
    return scoreMap;
  }, [
    checklistTemplates,
    includedTaskConfigs,
    rubricTemplates,
    students,
    taskChecklistAssessments,
    taskDailyEvaluationSettings,
    taskRubricAssessments
  ]);

  const studentAverages = useMemo(
    () =>
      students.map((student) => ({
        studentId: student.id,
        average: (() => {
          let weightedSum = 0;
          let usedWeight = 0;
          for (const assessment of assessments) {
            const entry = entriesByKey.get(gradeCellKey(student.id, assessment.id));
            if (typeof entry?.numericValue === "number") {
              weightedSum += entry.numericValue * assessment.weight;
              usedWeight += assessment.weight;
            }
          }
          for (const task of includedTaskConfigs) {
            const taskWeight = Number(task.gradebookWeight ?? 0);
            if (taskWeight <= 0) {
              continue;
            }
            const taskScore = taskScoreByTaskStudent.get(taskStudentKey(task.id, student.id));
            if (typeof taskScore === "number") {
              weightedSum += taskScore * taskWeight;
              usedWeight += taskWeight;
            }
          }
          if (usedWeight === 0) {
            return null;
          }
          return weightedSum / usedWeight;
        })()
      })),
    [assessments, entriesByKey, includedTaskConfigs, students, taskScoreByTaskStudent]
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

  const saveGradeAndClearPending = async (
    studentId: string,
    assessmentId: string,
    rawValue: string
  ): Promise<void> => {
    const key = gradeCellKey(studentId, assessmentId);
    try {
      await upsertGrade(studentId, assessmentId, rawValue);
    } finally {
      setPendingGradeKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const createAssessment = async (): Promise<void> => {
    if (!selectedClassId) {
      return;
    }
    const title = newAssessmentTitle.trim();
    const weight = Number(newAssessmentWeight);

    if (title.length < 2 || Number.isNaN(weight) || weight <= 0) {
      setGradebookNotice("La evaluacion necesita nombre (minimo 2 caracteres) y peso mayor que 0.");
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
    setGradebookNotice("Evaluacion creada.");
    await loadData();
  };

  const currentWeights = assessments.reduce((sum, assessment) => sum + assessment.weight, 0);
  const taskWeights = includedTaskConfigs.reduce((sum, task) => sum + Number(task.gradebookWeight ?? 0), 0);
  const assessmentDraftDirty =
    newAssessmentTitle.trim().length > 0 || newAssessmentWeight.trim() !== "20";
  const hasUnsavedChanges = pendingGradeKeys.size > 0 || assessmentDraftDirty;
  useUnsavedChangesGuard(hasUnsavedChanges);

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
            {assessments.length} columnas ({currentWeights.toFixed(2)})
          </div>
        </article>
        <article className="metric-item">
          <strong>Tareas en cuaderno</strong>
          <div>
            {includedTaskConfigs.length} tareas ({taskWeights.toFixed(2)})
          </div>
        </article>
      </div>

      <div className="inline-form">
        <input
          className="input"
          value={newAssessmentTitle}
          onChange={(event) => {
            setNewAssessmentTitle(event.target.value);
            setGradebookNotice("");
          }}
          placeholder="Nueva evaluación"
        />
        <input
          className="input"
          type="number"
          min={1}
          step={1}
          value={newAssessmentWeight}
          onChange={(event) => {
            setNewAssessmentWeight(event.target.value);
            setGradebookNotice("");
          }}
          placeholder="Peso %"
        />
        <button className="btn" type="button" onClick={() => void createAssessment()}>
          Agregar columna
        </button>
      </div>
      {gradebookNotice ? <p className="hint">{gradebookNotice}</p> : null}

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
                          onChange={() => {
                            const key = gradeCellKey(student.id, assessment.id);
                            setPendingGradeKeys((current) => {
                              const next = new Set(current);
                              next.add(key);
                              return next;
                            });
                          }}
                          onBlur={(event) => void saveGradeAndClearPending(student.id, assessment.id, event.target.value)}
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

      <section className="detail-section" style={{ marginTop: 10 }}>
        <h5>Tareas incluidas en cuaderno</h5>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tarea</th>
                <th>Asignatura</th>
                <th>Unidad</th>
                <th>Sesiones</th>
                <th>Peso</th>
                <th>Instrumento</th>
              </tr>
            </thead>
            <tbody>
              {includedTasks.map((task) => (
                <tr key={task.taskId}>
                  <td>{task.title}</td>
                  <td>{task.subjectName}</td>
                  <td>{task.unitName}</td>
                  <td>{task.sessionsCount}</td>
                  <td>{task.weight.toFixed(2)}</td>
                  <td>{task.instrument}</td>
                </tr>
              ))}
              {includedTasks.length === 0 ? (
                <tr>
                  <td colSpan={6}>No hay tareas marcadas para incluir en el cuaderno.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
