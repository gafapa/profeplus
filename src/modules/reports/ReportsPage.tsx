import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import { db } from "../../shared/db/database";
import type {
  Assessment,
  AttendanceEntry,
  ChecklistTemplate,
  GradeEntry,
  GradebookGroup,
  RubricTemplate,
  Student,
  StudentFollowUp,
  Subject,
  SubjectCourseLink,
  Task,
  TaskChecklistAssessment,
  TaskDailyEvaluationSetting,
  TaskDirectGrade,
  TaskGradebookConfig,
  TaskRubricAssessment,
  TaskSession,
  TaskStudentComment,
  TaskSubjectLink
} from "../../shared/db/types";
import { generateAiText } from "../../shared/ai/extensionRuntime";
import {
  calculateGradebookContributions,
  calculateTaskScoresByStudent,
  gradeCellKey,
  matchesTaskScope,
  taskStudentKey,
  taskSubjectKey
} from "../../shared/gradebook/calculations";
import { useStudentDisplay } from "../../shared/hooks/useStudentDisplay";
import { buildPrintableReportHtml } from "../../shared/reports/printableReports";
import { followUpKindLabel } from "../../shared/students/followUp";
import { ContextSidebarTabs } from "../../shared/ui/ContextSidebarTabs";
import { Modal } from "../../shared/ui/Modal";

export { taskStudentKey, taskSubjectKey };
export const calculateContributions = calculateGradebookContributions;

export type ReportTaskRow = {
  taskId: string;
  subjectId: string;
  subjectName: string;
  title: string;
  gradebookWeight: number;
  groupId?: string;
  rubricTemplateId?: string;
  checklistTemplateId?: string;
  directGradeEnabled?: boolean;
};

type ReportItem = {
  key: string;
  type: "assessment" | "task";
  sourceId: string;
  subjectId: string;
  subjectName: string;
  title: string;
  period?: string;
  competency?: string;
  contribution: number;
  weight: number;
};

export type AttendanceSummary = {
  present: number;
  late: number;
  absent: number;
  total: number;
  rate: number;
};

type AiReportKind =
  | "tutorial"
  | "reinforcement"
  | "families"
  | "attendance"
  | "recovery"
  | "taskAnalysis"
  | "riskMap"
  | "acsSupport"
  | "subjectDiagnosis";

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadCsv(filename: string, rows: string[][]): void {
  const content = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  downloadBlob(filename, new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" }));
}

function downloadText(filename: string, text: string): void {
  downloadBlob(filename, new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8;" }));
}

function downloadHtml(filename: string, html: string): void {
  downloadBlob(filename, new Blob(["\uFEFF" + html], { type: "text/html;charset=utf-8;" }));
}

function formatDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function studentSubjectKey(studentId: string, subjectId: string): string {
  return `${studentId}:${subjectId}`;
}

function formatOptionalNumber(value: number | null | undefined): string {
  return typeof value === "number" ? value.toFixed(2) : "";
}

function formatOptionalPercent(value: number | null | undefined): string {
  return typeof value === "number" ? `${value.toFixed(0)}%` : "";
}

function instrumentLabel(task: ReportTaskRow): string {
  if (task.rubricTemplateId) return "Rúbrica";
  if (task.checklistTemplateId) return "Lista de cotejo";
  if (task.directGradeEnabled) return "Nota directa";
  return "Sin método";
}

export function riskLabel(
  grade: number | null | undefined,
  attendanceRate: number,
  missingRate: number,
  hasAcs?: boolean,
  hasReinforcement?: boolean
): string {
  if ((typeof grade === "number" && grade < 5) || attendanceRate < 75 || missingRate >= 40) {
    return "Alto";
  }
  if ((typeof grade === "number" && grade < 6) || attendanceRate < 90 || missingRate >= 20 || hasAcs || hasReinforcement) {
    return "Medio";
  }
  return "Bajo";
}

export function joinUnique(values: Array<string | undefined>): string {
  const seen = new Set<string>();
  const cleanValues: string[] = [];
  for (const value of values) {
    const clean = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    cleanValues.push(clean);
  }
  return cleanValues.join(" | ");
}

export function csvPreview(rows: string[][], maxRows: number): string {
  return rows
    .slice(0, maxRows)
    .map((row) => row.map((cell) => String(cell).replace(/\s+/g, " ").trim()).join("; "))
    .join("\n");
}

export function calculateAttendanceSummary(attendance: AttendanceEntry[], studentId: string): AttendanceSummary {
  const rows = attendance.filter((entry) => entry.studentId === studentId);
  const present = rows.filter((entry) => entry.status === "present").length;
  const late = rows.filter((entry) => entry.status === "late").length;
  const absent = rows.filter((entry) => entry.status === "absent").length;
  const total = present + late + absent;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
  return { present, late, absent, total, rate };
}

export function ReportsPage() {
  const { formatName, compareFn } = useStudentDisplay();
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectLinks, setSubjectLinks] = useState<SubjectCourseLink[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskLinks, setTaskLinks] = useState<TaskSubjectLink[]>([]);
  const [taskConfigs, setTaskConfigs] = useState<TaskGradebookConfig[]>([]);
  const [taskSessions, setTaskSessions] = useState<TaskSession[]>([]);
  const [taskStudentComments, setTaskStudentComments] = useState<TaskStudentComment[]>([]);
  const [taskDailySettings, setTaskDailySettings] = useState<TaskDailyEvaluationSetting[]>([]);
  const [taskRubricAssessments, setTaskRubricAssessments] = useState<TaskRubricAssessment[]>([]);
  const [taskChecklistAssessments, setTaskChecklistAssessments] = useState<TaskChecklistAssessment[]>([]);
  const [taskDirectGrades, setTaskDirectGrades] = useState<TaskDirectGrade[]>([]);
  const [rubricTemplates, setRubricTemplates] = useState<RubricTemplate[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [gradebookGroups, setGradebookGroups] = useState<GradebookGroup[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [entries, setEntries] = useState<GradeEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [studentFollowUps, setStudentFollowUps] = useState<StudentFollowUp[]>([]);
  const [isAiReportModalOpen, setIsAiReportModalOpen] = useState(false);
  const [isGeneratingAiReport, setIsGeneratingAiReport] = useState(false);
  const [aiReportTitle, setAiReportTitle] = useState("");
  const [aiReportStatus, setAiReportStatus] = useState("");
  const [aiReportOutput, setAiReportOutput] = useState("");
  const [selectedAiStudentId, setSelectedAiStudentId] = useState("");
  const [selectedAiSubjectId, setSelectedAiSubjectId] = useState("");
  const [anonymizeAiReports, setAnonymizeAiReports] = useState(true);

  useEffect(() => {
    let active = true;

    const clearData = (): void => {
      setStudents([]);
      setSubjects([]);
      setSubjectLinks([]);
      setTasks([]);
      setTaskLinks([]);
      setTaskConfigs([]);
      setTaskSessions([]);
      setTaskStudentComments([]);
      setTaskDailySettings([]);
      setTaskRubricAssessments([]);
      setTaskChecklistAssessments([]);
      setTaskDirectGrades([]);
      setRubricTemplates([]);
      setChecklistTemplates([]);
      setGradebookGroups([]);
      setAssessments([]);
      setEntries([]);
      setAttendance([]);
      setStudentFollowUps([]);
    };

    const loadData = async (): Promise<void> => {
      if (!selectedClassId) {
        clearData();
        return;
      }

      const [
        studentsData,
        subjectsData,
        subjectLinksData,
        tasksData,
        taskLinksData,
        taskConfigsData,
        taskSessionsData,
        taskStudentCommentsData,
        taskDailySettingsData,
        taskRubricAssessmentsData,
        taskChecklistAssessmentsData,
        taskDirectGradesData,
        rubricTemplatesData,
        checklistTemplatesData,
        gradebookGroupsData,
        assessmentsData,
        entriesData,
        attendanceData,
        studentFollowUpsData
      ] = await Promise.all([
        db.students.where("classId").equals(selectedClassId).toArray(),
        db.subjects.orderBy("name").toArray(),
        db.subjectCourseLinks.where("classId").equals(selectedClassId).toArray(),
        db.tasks.filter((task) => Boolean(task.sendToGradebook)).toArray(),
        db.taskSubjectLinks.toArray(),
        db.taskGradebookConfigs.where("classId").equals(selectedClassId).toArray(),
        db.taskSessions.filter((session) => session.classId === selectedClassId).toArray(),
        db.taskStudentComments.toArray(),
        db.taskDailyEvaluationSettings.toArray(),
        db.taskRubricAssessments.toArray(),
        db.taskChecklistAssessments.toArray(),
        db.taskDirectGrades.where("classId").equals(selectedClassId).toArray(),
        db.rubricTemplates.where("classId").equals(selectedClassId).toArray(),
        db.checklistTemplates.where("classId").equals(selectedClassId).toArray(),
        db.gradebookGroups.where("classId").equals(selectedClassId).toArray(),
        db.assessments.where("classId").equals(selectedClassId).toArray(),
        db.gradeEntries.where("classId").equals(selectedClassId).toArray(),
        db.attendanceEntries.where("classId").equals(selectedClassId).toArray(),
        db.studentFollowUps.where("classId").equals(selectedClassId).toArray()
      ]);

      if (!active) return;

      setStudents(studentsData.sort(compareFn));
      setSubjects(subjectsData);
      setSubjectLinks(subjectLinksData);
      setTasks(tasksData);
      setTaskLinks(taskLinksData);
      setTaskConfigs(taskConfigsData);
      setTaskSessions(taskSessionsData);
      setTaskStudentComments(taskStudentCommentsData);
      setTaskDailySettings(taskDailySettingsData);
      setTaskRubricAssessments(taskRubricAssessmentsData);
      setTaskChecklistAssessments(taskChecklistAssessmentsData);
      setTaskDirectGrades(taskDirectGradesData);
      setRubricTemplates(rubricTemplatesData);
      setChecklistTemplates(checklistTemplatesData);
      setGradebookGroups(gradebookGroupsData);
      setAssessments(assessmentsData);
      setEntries(entriesData);
      setAttendance(attendanceData);
      setStudentFollowUps(studentFollowUpsData);
    };

    void loadData();
    return () => {
      active = false;
    };
  }, [compareFn, selectedClassId]);

  const subjectsForClass = useMemo(() => {
    const linkedSubjectIds = new Set(subjectLinks.map((link) => link.subjectId));
    return subjects.filter((subject) => linkedSubjectIds.has(subject.id));
  }, [subjectLinks, subjects]);

  useEffect(() => {
    if (selectedAiStudentId && !students.some((student) => student.id === selectedAiStudentId)) {
      setSelectedAiStudentId("");
    }
    if (selectedAiSubjectId && !subjectsForClass.some((subject) => subject.id === selectedAiSubjectId)) {
      setSelectedAiSubjectId("");
    }
  }, [selectedAiStudentId, selectedAiSubjectId, students, subjectsForClass]);

  const reportTasks = useMemo<ReportTaskRow[]>(() => {
    const linkedSubjectIds = new Set(subjectLinks.map((link) => link.subjectId));
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const configByTaskSubject = new Map(taskConfigs.map((config) => [taskSubjectKey(config.taskId, config.subjectId), config]));
    const rows: ReportTaskRow[] = [];
    const usedKeys = new Set<string>();

    for (const link of taskLinks) {
      if (!linkedSubjectIds.has(link.subjectId)) continue;
      const task = taskById.get(link.taskId);
      if (!task?.sendToGradebook) continue;
      const key = taskSubjectKey(link.taskId, link.subjectId);
      if (usedKeys.has(key)) continue;
      usedKeys.add(key);

      const config = configByTaskSubject.get(key);
      rows.push({
        taskId: link.taskId,
        subjectId: link.subjectId,
        subjectName: subjectById.get(link.subjectId)?.name ?? "Asignatura sin nombre",
        title: task.title || "Tarea sin título",
        gradebookWeight: Number(config?.gradebookWeight ?? 0),
        groupId: config?.groupId,
        rubricTemplateId: config?.rubricTemplateId,
        checklistTemplateId: config?.checklistTemplateId,
        directGradeEnabled: config?.directGradeEnabled
      });
    }

    return rows.sort((a, b) => a.subjectName.localeCompare(b.subjectName) || a.title.localeCompare(b.title));
  }, [subjectLinks, subjects, taskConfigs, taskLinks, tasks]);

  const reportTaskByKey = useMemo(
    () => new Map(reportTasks.map((task) => [taskSubjectKey(task.taskId, task.subjectId), task])),
    [reportTasks]
  );

  const visibleTaskIds = useMemo(() => new Set(reportTasks.map((task) => task.taskId)), [reportTasks]);

  const entriesByKey = useMemo(() => {
    const map = new Map<string, GradeEntry>();
    for (const entry of entries) {
      map.set(gradeCellKey(entry.studentId, entry.assessmentId), entry);
    }
    return map;
  }, [entries]);

  const taskScoreByTaskStudent = useMemo(
    () =>
      calculateTaskScoresByStudent({
        tasks: reportTasks.map((task) => ({ ...task, classId: selectedClassId ?? "" })),
        students,
        selectedClassId: selectedClassId ?? "",
        rubricTemplates,
        checklistTemplates,
        taskDailyEvaluationSettings: taskDailySettings,
        taskRubricAssessments,
        taskChecklistAssessments,
        taskDirectGrades
      }),
    [
      checklistTemplates,
      reportTasks,
      selectedClassId,
      students,
      taskChecklistAssessments,
      taskDailySettings,
      taskDirectGrades,
      taskRubricAssessments,
      rubricTemplates
    ]
  );

  const reportData = useMemo(() => {
    const reportItems: ReportItem[] = [];
    const subjectGradeByStudentSubject = new Map<string, number>();
    const finalGradeByStudent = new Map<string, number | null>();

    for (const subject of subjectsForClass) {
      const subjectAssessments = assessments.filter((assessment) => assessment.subjectId === subject.id);
      const subjectTasks = reportTasks.filter((task) => task.subjectId === subject.id);
      const subjectGroups = gradebookGroups.filter((group) => group.subjectId === subject.id);
      const contributions = calculateContributions(subjectAssessments, subjectTasks, subjectGroups);

      for (const assessment of subjectAssessments) {
        reportItems.push({
          key: `assessment:${assessment.id}`,
          type: "assessment",
          sourceId: assessment.id,
          subjectId: subject.id,
          subjectName: subject.name,
          title: assessment.title,
          period: assessment.period,
          competency: assessment.competency,
          contribution: contributions.assessmentContributionById.get(assessment.id) ?? 0,
          weight: Number(assessment.weight ?? 0)
        });
      }

      for (const task of subjectTasks) {
        const key = taskSubjectKey(task.taskId, task.subjectId);
        reportItems.push({
          key: `task:${key}`,
          type: "task",
          sourceId: task.taskId,
          subjectId: subject.id,
          subjectName: subject.name,
          title: task.title,
          contribution: contributions.taskContributionByKey.get(key) ?? 0,
          weight: Number(task.gradebookWeight ?? 0)
        });
      }

      for (const student of students) {
        let weightedSum = 0;
        let usedWeight = 0;

        for (const assessment of subjectAssessments) {
          const contribution = contributions.assessmentContributionById.get(assessment.id) ?? 0;
          if (contribution <= 0) continue;
          const entry = entriesByKey.get(gradeCellKey(student.id, assessment.id));
          if (typeof entry?.numericValue !== "number") continue;
          weightedSum += entry.numericValue * contribution;
          usedWeight += contribution;
        }

        for (const task of subjectTasks) {
          const contribution = contributions.taskContributionByKey.get(taskSubjectKey(task.taskId, task.subjectId)) ?? 0;
          if (contribution <= 0) continue;
          const score = taskScoreByTaskStudent.get(taskStudentKey(task.taskId, task.subjectId, student.id));
          if (typeof score !== "number") continue;
          weightedSum += score * contribution;
          usedWeight += contribution;
        }

        if (usedWeight > 0) {
          subjectGradeByStudentSubject.set(studentSubjectKey(student.id, subject.id), Number((weightedSum / usedWeight).toFixed(2)));
        }
      }
    }

    for (const student of students) {
      const subjectGrades = subjectsForClass
        .map((subject) => subjectGradeByStudentSubject.get(studentSubjectKey(student.id, subject.id)))
        .filter((value): value is number => typeof value === "number");
      finalGradeByStudent.set(
        student.id,
        subjectGrades.length > 0
          ? Number((subjectGrades.reduce((sum, value) => sum + value, 0) / subjectGrades.length).toFixed(2))
          : null
      );
    }

    reportItems.sort((a, b) => a.subjectName.localeCompare(b.subjectName) || a.title.localeCompare(b.title));
    return { finalGradeByStudent, reportItems, subjectGradeByStudentSubject };
  }, [assessments, entriesByKey, gradebookGroups, reportTasks, students, subjectsForClass, taskScoreByTaskStudent]);

  const attendanceByStudent = useMemo(() => {
    const map = new Map<string, AttendanceSummary>();
    for (const student of students) {
      map.set(student.id, calculateAttendanceSummary(attendance, student.id));
    }
    return map;
  }, [attendance, students]);

  const attendanceNotesByStudent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const entry of attendance) {
      if (!entry.note?.trim()) continue;
      if (!map.has(entry.studentId)) {
        map.set(entry.studentId, []);
      }
      map.get(entry.studentId)?.push(`${entry.date}: ${entry.note.trim()}`);
    }
    return map;
  }, [attendance]);

  const followUpNotesByStudent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const followUp of studentFollowUps) {
      const status = followUp.resolved ? "resuelto" : "abierto";
      const text = `${followUp.date} · ${followUpKindLabel(followUp.kind)} · ${status}: ${followUp.title}. ${followUp.notes}${
        followUp.nextStep ? ` Próximo paso: ${followUp.nextStep}` : ""
      }`;
      if (!map.has(followUp.studentId)) {
        map.set(followUp.studentId, []);
      }
      map.get(followUp.studentId)?.push(text);
    }
    return map;
  }, [studentFollowUps]);

  const taskCommentsByTaskSubjectStudent = useMemo(() => {
    const taskSubjectsByTaskId = new Map<string, string[]>();
    for (const task of reportTasks) {
      if (!taskSubjectsByTaskId.has(task.taskId)) {
        taskSubjectsByTaskId.set(task.taskId, []);
      }
      taskSubjectsByTaskId.get(task.taskId)?.push(task.subjectId);
    }

    const sessionSubjectByTaskDateSlot = new Map<string, string>();
    for (const session of taskSessions) {
      sessionSubjectByTaskDateSlot.set(
        `${session.classId}:${session.taskId}:${session.date}:${session.scheduleSlotId ?? ""}`,
        session.subjectId
      );
    }

    const map = new Map<string, string[]>();
    for (const comment of taskStudentComments) {
      if (!visibleTaskIds.has(comment.taskId) || !comment.comment.trim()) continue;
      if (!matchesTaskScope(comment, selectedClassId ?? "")) continue;
      const inferredSubjectId = comment.subjectId
        ? comment.subjectId
        : comment.date
        ? sessionSubjectByTaskDateSlot.get(
            `${comment.classId ?? selectedClassId ?? ""}:${comment.taskId}:${comment.date}:${comment.scheduleSlotId ?? ""}`
          )
        : undefined;
      const subjectIds = inferredSubjectId ? [inferredSubjectId] : taskSubjectsByTaskId.get(comment.taskId) ?? [];
      for (const subjectId of subjectIds.filter((id) => matchesTaskScope(comment, selectedClassId ?? "", id))) {
        const key = taskStudentKey(comment.taskId, subjectId, comment.studentId);
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)?.push(comment.date ? `${comment.date}: ${comment.comment.trim()}` : comment.comment.trim());
      }
    }
    return map;
  }, [reportTasks, selectedClassId, taskSessions, taskStudentComments, visibleTaskIds]);

  const avgGrade = useMemo(() => {
    const values = Array.from(reportData.finalGradeByStudent.values()).filter(
      (value): value is number => typeof value === "number"
    );
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [reportData.finalGradeByStudent]);

  const totalSessions = useMemo(() => {
    const dates = new Set(attendance.map((item) => `${item.date}:${item.scheduleSlotId ?? ""}`));
    return dates.size;
  }, [attendance]);

  const attendanceRate = useMemo(() => {
    if (!attendance.length) return null;
    const valid = attendance.filter((item) => item.status !== "absent").length;
    return Math.round((valid / attendance.length) * 100);
  }, [attendance]);

  const getItemScore = (item: ReportItem, studentId: string): number | null => {
    if (item.type === "assessment") {
      const entry = entriesByKey.get(gradeCellKey(studentId, item.sourceId));
      return typeof entry?.numericValue === "number" ? entry.numericValue : null;
    }
    const score = taskScoreByTaskStudent.get(taskStudentKey(item.sourceId, item.subjectId, studentId));
    return typeof score === "number" ? score : null;
  };

  const getItemComment = (item: ReportItem, studentId: string): string => {
    if (item.type === "assessment") {
      const entry = entriesByKey.get(gradeCellKey(studentId, item.sourceId));
      return entry?.comment?.trim() ?? "";
    }
    return joinUnique(taskCommentsByTaskSubjectStudent.get(taskStudentKey(item.sourceId, item.subjectId, studentId)) ?? []);
  };

  const getItemStats = (studentId: string, subjectId?: string): { total: number; scored: number; missing: number; missingRate: number } => {
    const items = subjectId ? reportData.reportItems.filter((item) => item.subjectId === subjectId) : reportData.reportItems;
    const scored = items.filter((item) => typeof getItemScore(item, studentId) === "number").length;
    const total = items.length;
    const missing = total - scored;
    return {
      total,
      scored,
      missing,
      missingRate: total > 0 ? Math.round((missing / total) * 100) : 0
    };
  };

  const buildAiSourceRows = (studentId = "", subjectId = "", anonymize = true): string[][] => {
    const rows: string[][] = [
      ["Ámbito", "Alumno", "ACS", "Refuerzo", "Asignatura", "Indicador", "Valor", "Detalle", "Prioridad"]
    ];

    const sourceStudents = studentId ? students.filter((student) => student.id === studentId) : students;
    const studentLabelById = new Map(sourceStudents.map((student, index) => [student.id, `Alumno ${index + 1}`]));
    const sourceSubjects = subjectId ? subjectsForClass.filter((subject) => subject.id === subjectId) : subjectsForClass;
    const sourceItems = subjectId
      ? reportData.reportItems.filter((item) => item.subjectId === subjectId)
      : reportData.reportItems;

    for (const student of sourceStudents) {
      const studentLabel = anonymize ? studentLabelById.get(student.id) ?? "Alumno" : formatName(student);
      const attendanceSummary = attendanceByStudent.get(student.id) ?? { present: 0, late: 0, absent: 0, total: 0, rate: 0 };
      const finalGrade = reportData.finalGradeByStudent.get(student.id);
      const overallStats = getItemStats(student.id);
      const priority = riskLabel(finalGrade, attendanceSummary.rate, overallStats.missingRate, student.hasAcs, student.hasReinforcement);

      rows.push([
        "Alumno",
        studentLabel,
        student.hasAcs ? "Sí" : "No",
        student.hasReinforcement ? "Sí" : "No",
        "",
        "Media final",
        formatOptionalNumber(finalGrade) || "Sin datos",
        `${overallStats.missing} pendientes de ${overallStats.total}. Asistencia ${attendanceSummary.rate}%`,
        priority
      ]);

      const notes = joinUnique(attendanceNotesByStudent.get(student.id) ?? []);
      if (notes) {
        rows.push([
          "Observaciones",
          studentLabel,
          student.hasAcs ? "Sí" : "No",
          student.hasReinforcement ? "Sí" : "No",
          "",
          "Asistencia",
          "",
          notes,
          priority
        ]);
      }
      const followUps = joinUnique(followUpNotesByStudent.get(student.id) ?? []);
      if (followUps) {
        rows.push([
          "Seguimiento",
          studentLabel,
          student.hasAcs ? "Sí" : "No",
          student.hasReinforcement ? "Sí" : "No",
          "",
          "Tutoría",
          "",
          followUps,
          priority
        ]);
      }

      for (const subject of sourceSubjects) {
        const subjectGrade = reportData.subjectGradeByStudentSubject.get(studentSubjectKey(student.id, subject.id));
        const subjectStats = getItemStats(student.id, subject.id);
        rows.push([
          "Asignatura",
          studentLabel,
          student.hasAcs ? "Sí" : "No",
          student.hasReinforcement ? "Sí" : "No",
          subject.name,
          "Media asignatura",
          formatOptionalNumber(subjectGrade) || "Sin datos",
          `${subjectStats.missing} pendientes de ${subjectStats.total}`,
          riskLabel(subjectGrade, attendanceSummary.rate, subjectStats.missingRate, student.hasAcs, student.hasReinforcement)
        ]);
      }

      for (const item of sourceItems) {
        const score = getItemScore(item, student.id);
        const comment = getItemComment(item, student.id);
        if (typeof score === "number" && score >= 5 && !comment) continue;
        rows.push([
          item.type === "assessment" ? "Evaluación" : "Tarea",
          studentLabel,
          student.hasAcs ? "Sí" : "No",
          student.hasReinforcement ? "Sí" : "No",
          item.subjectName,
          item.title,
          typeof score === "number" ? formatOptionalNumber(score) : "Pendiente",
          comment || `Aporta ${(item.contribution * 100).toFixed(2)}%`,
          typeof score === "number" && score < 5 ? "Alto" : "Medio"
        ]);
      }
    }

    return rows;
  };

  const aiReportLabel = (kind: AiReportKind): string => {
    if (kind === "tutorial") return "Resumen de tutoría";
    if (kind === "reinforcement") return "Plan de refuerzo";
    if (kind === "families") return "Comentarios para familias";
    if (kind === "attendance") return "Asistencia y rendimiento";
    if (kind === "recovery") return "Plan de recuperación";
    if (kind === "taskAnalysis") return "Análisis de tareas y rúbricas";
    if (kind === "riskMap") return "Mapa de riesgo";
    if (kind === "acsSupport") return "Seguimiento ACS y refuerzo";
    return "Diagnóstico de asignatura";
  };

  const aiReportInstructions = (kind: AiReportKind): string => {
    if (kind === "tutorial") {
      return [
        "Genera un informe de tutoría del grupo.",
        "Incluye: visión general, alumnado prioritario, evidencias concretas y próximos pasos.",
        "Agrupa por prioridad alta, media y baja. No inventes datos."
      ].join("\n");
    }
    if (kind === "reinforcement") {
      return [
        "Genera propuestas de refuerzo por alumno y asignatura.",
        "Incluye objetivo, actividad sugerida, seguimiento y criterio de mejora observable.",
        "Prioriza alumnado con ACS, refuerzo, baja nota, baja asistencia o muchos pendientes. No inventes datos."
      ].join("\n");
    }
    if (kind === "families") {
      return [
        "Genera borradores breves de comentario para familias por alumno.",
        "Tono profesional, claro y constructivo. Menciona fortalezas solo si hay evidencias; si no, céntrate en acciones.",
        "No uses lenguaje diagnóstico ni afirmaciones que no estén apoyadas por los datos."
      ].join("\n");
    }
    if (kind === "recovery") {
      return [
        "Genera un plan de recuperación práctico.",
        "Debe incluir prioridades, tareas pendientes, acciones semanales, criterios de éxito y una pauta de revisión.",
        "Si los datos están filtrados a un alumno, escribe el plan para ese alumno. Si no, agrupa por alumno."
      ].join("\n");
    }
    if (kind === "taskAnalysis") {
      return [
        "Analiza tareas, rúbricas y listas de cotejo con bajo rendimiento o pendientes.",
        "Identifica elementos problemáticos, posibles causas pedagógicas como hipótesis y actividades de reenseñanza.",
        "Incluye evidencias: nota, pendiente, instrumento o comentario disponible."
      ].join("\n");
    }
    if (kind === "riskMap") {
      return [
        "Genera un mapa de riesgo del grupo.",
        "Clasifica alumnado en riesgo alto, medio y bajo usando notas, pendientes, asistencia, ACS/refuerzo y observaciones.",
        "Para cada caso de riesgo alto o medio, incluye motivo y acción inmediata."
      ].join("\n");
    }
    if (kind === "acsSupport") {
      return [
        "Genera un informe de seguimiento para alumnado con ACS o refuerzo.",
        "Incluye estado actual, evidencias, barreras observables, apoyos sugeridos y seguimiento recomendado.",
        "No uses lenguaje diagnóstico. No inventes necesidades no presentes en los datos."
      ].join("\n");
    }
    if (kind === "subjectDiagnosis") {
      return [
        "Genera un diagnóstico de asignatura.",
        "Incluye media, alumnado con dificultades, elementos pendientes o con bajo resultado, y propuesta de reenseñanza.",
        "Si se ha filtrado una asignatura, céntrate solo en ella. Si no, compara asignaturas."
      ].join("\n");
    }
    return [
      "Analiza la relación entre asistencia, retrasos, observaciones y rendimiento.",
      "Incluye patrones relevantes, alumnado a revisar y acciones concretas de seguimiento.",
      "No inventes causas; formula hipótesis como hipótesis."
    ].join("\n");
  };

  const generateAiReport = async (kind: AiReportKind): Promise<void> => {
    if (students.length === 0) return;
    const title = aiReportLabel(kind);
    const confirmed = window.confirm(
      anonymizeAiReports
        ? "Se enviarán datos académicos sin nombres de alumnos a la extensión de IA. Revisa que el proveedor configurado cumple tus requisitos de privacidad. ¿Continuar?"
        : "Se enviarán nombres de alumnos, datos académicos, asistencia, ACS/refuerzo y observaciones a la extensión de IA. ¿Confirmas que quieres continuar?"
    );
    if (!confirmed) return;
    setAiReportTitle(title);
    setAiReportOutput("");
    setAiReportStatus("Generando informe...");
    setIsAiReportModalOpen(true);
    setIsGeneratingAiReport(true);

    try {
      const selectedStudent = students.find((student) => student.id === selectedAiStudentId);
      const selectedSubject = subjectsForClass.find((subject) => subject.id === selectedAiSubjectId);
      const source = csvPreview(buildAiSourceRows(selectedAiStudentId, selectedAiSubjectId, anonymizeAiReports), 650);
      const response = await generateAiText(
        [
          {
            role: "system",
            content:
              "Eres un asistente docente. Genera informes en texto claro a partir de datos CSV. No devuelvas JSON ni tablas JSON."
          },
          {
            role: "user",
            content: [
              aiReportInstructions(kind),
              selectedStudent
                ? `Alumno filtrado: ${anonymizeAiReports ? "Alumno 1" : formatName(selectedStudent)}`
                : "Alcance de alumnado: grupo completo",
              selectedSubject ? `Asignatura filtrada: ${selectedSubject.name}` : "Alcance de asignaturas: todas",
              "",
              "Formato de salida:",
              "- Título",
              "- Resumen ejecutivo",
              "- Hallazgos con evidencias",
              "- Acciones recomendadas",
              "- Seguimiento propuesto",
              "",
              "Datos CSV separados por punto y coma:",
              source
            ].join("\n")
          }
        ],
        { temperature: 0.2, maxOutputTokens: 1800, responseFormat: "text" }
      );
      setAiReportOutput(response.text.trim());
      setAiReportStatus("Informe generado.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setAiReportStatus(`No se pudo generar el informe (${message}).`);
    } finally {
      setIsGeneratingAiReport(false);
    }
  };

  const downloadAiReport = (): void => {
    if (!aiReportOutput.trim()) return;
    downloadText(`${aiReportTitle.toLocaleLowerCase().replace(/\s+/g, "-")}-${formatDate()}.txt`, aiReportOutput);
  };

  const exportGrades = (): void => {
    const header = [
      "Alumno",
      "Email",
      "ACS",
      "Refuerzo",
      ...reportData.reportItems.map((item) => `${item.subjectName} - ${item.title}`),
      ...subjectsForClass.map((subject) => `Media ${subject.name}`),
      "Media final"
    ];
    const rows: string[][] = [header];

    for (const student of students) {
      rows.push([
        formatName(student),
        student.email ?? "",
        student.hasAcs ? "Sí" : "No",
        student.hasReinforcement ? "Sí" : "No",
        ...reportData.reportItems.map((item) => formatOptionalNumber(getItemScore(item, student.id))),
        ...subjectsForClass.map((subject) =>
          formatOptionalNumber(reportData.subjectGradeByStudentSubject.get(studentSubjectKey(student.id, subject.id)))
        ),
        formatOptionalNumber(reportData.finalGradeByStudent.get(student.id))
      ]);
    }

    downloadCsv(`acta-grupo-${formatDate()}.csv`, rows);
  };

  const exportAttendance = (): void => {
    const header = [
      "Alumno",
      "Email",
      "ACS",
      "Refuerzo",
      "Presentes",
      "Retrasos",
      "Ausencias",
      "Total sesiones",
      "% Asistencia",
      "Observaciones y seguimiento"
    ];
    const rows: string[][] = [header];

    for (const student of students) {
      const summary = attendanceByStudent.get(student.id) ?? { present: 0, late: 0, absent: 0, total: 0, rate: 0 };
      rows.push([
        formatName(student),
        student.email ?? "",
        student.hasAcs ? "Sí" : "No",
        student.hasReinforcement ? "Sí" : "No",
        String(summary.present),
        String(summary.late),
        String(summary.absent),
        String(summary.total),
        `${summary.rate}%`,
        joinUnique([...(attendanceNotesByStudent.get(student.id) ?? []), ...(followUpNotesByStudent.get(student.id) ?? [])])
      ]);
    }

    downloadCsv(`asistencia-${formatDate()}.csv`, rows);
  };

  const exportIndividual = (): void => {
    const rows: string[][] = [
      ["Alumno", "Email", "ACS", "Refuerzo", "Tipo", "Asignatura", "Elemento", "Nota", "Aporta", "Observaciones"],
      ...students.flatMap((student) => {
        const itemRows = reportData.reportItems.map((item) => [
          formatName(student),
          student.email ?? "",
          student.hasAcs ? "Sí" : "No",
          student.hasReinforcement ? "Sí" : "No",
          item.type === "assessment" ? "Evaluación" : "Tarea",
          item.subjectName,
          item.title,
          formatOptionalNumber(getItemScore(item, student.id)) || "-",
          `${(item.contribution * 100).toFixed(2)}%`,
          getItemComment(item, student.id)
        ]);
        const subjectRows = subjectsForClass.map((subject) => [
          formatName(student),
          student.email ?? "",
          student.hasAcs ? "Sí" : "No",
          student.hasReinforcement ? "Sí" : "No",
          "Media asignatura",
          subject.name,
          "Cuaderno",
          formatOptionalNumber(reportData.subjectGradeByStudentSubject.get(studentSubjectKey(student.id, subject.id))) || "-",
          "",
          ""
        ]);
        const attendanceSummary = attendanceByStudent.get(student.id) ?? { present: 0, late: 0, absent: 0, total: 0, rate: 0 };
        const summaryRows = [
          [
            formatName(student),
            student.email ?? "",
            student.hasAcs ? "Sí" : "No",
            student.hasReinforcement ? "Sí" : "No",
            "Media final",
            "",
            "Cuaderno",
            formatOptionalNumber(reportData.finalGradeByStudent.get(student.id)) || "-",
            "",
            ""
          ],
          [
            formatName(student),
            student.email ?? "",
            student.hasAcs ? "Sí" : "No",
            student.hasReinforcement ? "Sí" : "No",
            "Asistencia",
            "",
            `${attendanceSummary.total} sesiones`,
            `${attendanceSummary.rate}%`,
            "",
            joinUnique(attendanceNotesByStudent.get(student.id) ?? [])
          ],
          [
            formatName(student),
            student.email ?? "",
            student.hasAcs ? "Sí" : "No",
            student.hasReinforcement ? "Sí" : "No",
            "Seguimiento",
            "",
            "Tutoría",
            "",
            "",
            joinUnique(followUpNotesByStudent.get(student.id) ?? [])
          ],
          [
            formatName(student),
            student.email ?? "",
            student.hasAcs ? "Sí" : "No",
            student.hasReinforcement ? "Sí" : "No",
            "Pendientes",
            "",
            "Elementos sin nota",
            String(getItemStats(student.id).missing),
            "",
            ""
          ]
        ];
        return [...itemRows, ...subjectRows, ...summaryRows];
      })
    ];

    downloadCsv(`informe-individual-${formatDate()}.csv`, rows);
  };

  const exportAcademicSummary = (): void => {
    const rows: string[][] = [
      [
        "Alumno",
        "Email",
        "ACS",
        "Refuerzo",
        "Asignatura",
        "Media asignatura",
        "Media final",
        "Elementos evaluables",
        "Elementos con nota",
        "Elementos pendientes",
        "% pendientes",
        "% asistencia",
        "Riesgo",
        "Observaciones"
      ]
    ];

    for (const student of students) {
      const attendanceSummary = attendanceByStudent.get(student.id) ?? { present: 0, late: 0, absent: 0, total: 0, rate: 0 };
      const finalGrade = reportData.finalGradeByStudent.get(student.id);
      for (const subject of subjectsForClass) {
        const subjectGrade = reportData.subjectGradeByStudentSubject.get(studentSubjectKey(student.id, subject.id));
        const stats = getItemStats(student.id, subject.id);
        rows.push([
          formatName(student),
          student.email ?? "",
          student.hasAcs ? "Sí" : "No",
          student.hasReinforcement ? "Sí" : "No",
          subject.name,
          formatOptionalNumber(subjectGrade),
          formatOptionalNumber(finalGrade),
          String(stats.total),
          String(stats.scored),
          String(stats.missing),
          formatOptionalPercent(stats.missingRate),
          `${attendanceSummary.rate}%`,
          riskLabel(subjectGrade ?? finalGrade, attendanceSummary.rate, stats.missingRate, student.hasAcs, student.hasReinforcement),
          joinUnique([...(attendanceNotesByStudent.get(student.id) ?? []), ...(followUpNotesByStudent.get(student.id) ?? [])])
        ]);
      }
    }

    downloadCsv(`resumen-academico-${formatDate()}.csv`, rows);
  };

  const exportEvaluationDetail = (): void => {
    const rows: string[][] = [
      [
        "Alumno",
        "Email",
        "ACS",
        "Refuerzo",
        "Asignatura",
        "Tipo",
        "Instrumento",
        "Elemento",
        "Periodo",
        "Competencia",
        "Peso",
        "Aporta",
        "Nota",
        "Estado",
        "Observaciones"
      ]
    ];

    for (const student of students) {
      for (const item of reportData.reportItems) {
        const score = getItemScore(item, student.id);
        const task = item.type === "task" ? reportTaskByKey.get(taskSubjectKey(item.sourceId, item.subjectId)) : undefined;
        rows.push([
          formatName(student),
          student.email ?? "",
          student.hasAcs ? "Sí" : "No",
          student.hasReinforcement ? "Sí" : "No",
          item.subjectName,
          item.type === "assessment" ? "Evaluación" : "Tarea",
          task ? instrumentLabel(task) : "Nota manual",
          item.title,
          item.period ?? "",
          item.competency ?? "",
          formatOptionalNumber(item.weight),
          `${(item.contribution * 100).toFixed(2)}%`,
          formatOptionalNumber(score),
          typeof score === "number" ? "Evaluado" : "Pendiente",
          getItemComment(item, student.id)
        ]);
      }
    }

    downloadCsv(`detalle-evaluacion-${formatDate()}.csv`, rows);
  };

  const exportAiDataset = (): void => {
    const rows: string[][] = [
      ["Ámbito", "Alumno", "ACS", "Refuerzo", "Asignatura", "Indicador", "Valor", "Detalle", "Prioridad sugerida"]
    ];

    for (const student of students) {
      const attendanceSummary = attendanceByStudent.get(student.id) ?? { present: 0, late: 0, absent: 0, total: 0, rate: 0 };
      const finalGrade = reportData.finalGradeByStudent.get(student.id);
      const overallStats = getItemStats(student.id);
      const priority = riskLabel(finalGrade, attendanceSummary.rate, overallStats.missingRate, student.hasAcs, student.hasReinforcement);

      rows.push([
        "Alumno",
        formatName(student),
        student.hasAcs ? "Sí" : "No",
        student.hasReinforcement ? "Sí" : "No",
        "",
        "Media final",
        formatOptionalNumber(finalGrade) || "Sin datos",
        `${overallStats.missing} elementos pendientes de ${overallStats.total}`,
        priority
      ]);

      rows.push([
        "Asistencia",
        formatName(student),
        student.hasAcs ? "Sí" : "No",
        student.hasReinforcement ? "Sí" : "No",
        "",
        "% asistencia",
        `${attendanceSummary.rate}%`,
        `Presentes: ${attendanceSummary.present}; retrasos: ${attendanceSummary.late}; ausencias: ${attendanceSummary.absent}`,
        attendanceSummary.rate < 75 ? "Alto" : attendanceSummary.rate < 90 ? "Medio" : "Bajo"
      ]);

      const attendanceNotes = joinUnique(attendanceNotesByStudent.get(student.id) ?? []);
      if (attendanceNotes) {
        rows.push([
          "Observaciones",
          formatName(student),
          student.hasAcs ? "Sí" : "No",
          student.hasReinforcement ? "Sí" : "No",
          "",
          "Asistencia",
          "",
          attendanceNotes,
          priority
        ]);
      }
      const followUps = joinUnique(followUpNotesByStudent.get(student.id) ?? []);
      if (followUps) {
        rows.push([
          "Seguimiento",
          formatName(student),
          student.hasAcs ? "Sí" : "No",
          student.hasReinforcement ? "Sí" : "No",
          "",
          "Tutoría",
          "",
          followUps,
          priority
        ]);
      }

      for (const subject of subjectsForClass) {
        const subjectGrade = reportData.subjectGradeByStudentSubject.get(studentSubjectKey(student.id, subject.id));
        const subjectStats = getItemStats(student.id, subject.id);
        rows.push([
          "Asignatura",
          formatName(student),
          student.hasAcs ? "Sí" : "No",
          student.hasReinforcement ? "Sí" : "No",
          subject.name,
          "Media asignatura",
          formatOptionalNumber(subjectGrade) || "Sin datos",
          `${subjectStats.missing} pendientes de ${subjectStats.total}`,
          riskLabel(subjectGrade, attendanceSummary.rate, subjectStats.missingRate, student.hasAcs, student.hasReinforcement)
        ]);
      }

      for (const item of reportData.reportItems) {
        const score = getItemScore(item, student.id);
        const comment = getItemComment(item, student.id);
        if (typeof score === "number" && score >= 5 && !comment) continue;
        rows.push([
          item.type === "assessment" ? "Evaluación" : "Tarea",
          formatName(student),
          student.hasAcs ? "Sí" : "No",
          student.hasReinforcement ? "Sí" : "No",
          item.subjectName,
          item.title,
          typeof score === "number" ? formatOptionalNumber(score) : "Pendiente",
          comment || `Aporta ${(item.contribution * 100).toFixed(2)}%`,
          typeof score === "number" && score < 5 ? "Alto" : "Medio"
        ]);
      }
    }

    downloadCsv(`dataset-ia-${formatDate()}.csv`, rows);
  };

  const exportPrintableGroupReport = (): void => {
    const studentRows = students.map((student) => {
      const finalGrade = reportData.finalGradeByStudent.get(student.id);
      const attendanceSummary = attendanceByStudent.get(student.id) ?? { present: 0, late: 0, absent: 0, total: 0, rate: 0 };
      const stats = getItemStats(student.id);
      return [
        formatName(student),
        student.email ?? "",
        student.hasAcs ? "Sí" : "No",
        student.hasReinforcement ? "Sí" : "No",
        formatOptionalNumber(finalGrade) || "-",
        `${attendanceSummary.rate}% (${attendanceSummary.total} sesiones)`,
        `${stats.missing}/${stats.total}`,
        riskLabel(finalGrade, attendanceSummary.rate, stats.missingRate, student.hasAcs, student.hasReinforcement),
        joinUnique([...(attendanceNotesByStudent.get(student.id) ?? []), ...(followUpNotesByStudent.get(student.id) ?? [])])
      ];
    });

    const subjectRows = students.flatMap((student) =>
      subjectsForClass.map((subject) => {
        const subjectGrade = reportData.subjectGradeByStudentSubject.get(studentSubjectKey(student.id, subject.id));
        const stats = getItemStats(student.id, subject.id);
        return [
          formatName(student),
          subject.name,
          formatOptionalNumber(subjectGrade) || "-",
          `${stats.scored}/${stats.total}`,
          String(stats.missing),
          riskLabel(
            subjectGrade,
            attendanceByStudent.get(student.id)?.rate ?? 0,
            stats.missingRate,
            student.hasAcs,
            student.hasReinforcement
          )
        ];
      })
    );

    downloadHtml(
      `informe-imprimible-grupo-${formatDate()}.html`,
      buildPrintableReportHtml({
        title: "Informe imprimible del grupo",
        generatedAt: new Date().toLocaleString("es-ES"),
        summary: [
          { label: "Alumnos", value: String(students.length) },
          { label: "Elementos evaluables", value: String(reportData.reportItems.length) },
          { label: "Media global", value: avgGrade !== null ? avgGrade.toFixed(2) : "-" },
          { label: "Asistencia", value: attendanceRate !== null ? `${attendanceRate}%` : "-" }
        ],
        tables: [
          {
            title: "Resumen por alumno",
            headers: ["Alumno", "Email", "ACS", "Refuerzo", "Media final", "Asistencia", "Pendientes", "Riesgo", "Observaciones y seguimiento"],
            rows: studentRows
          },
          {
            title: "Medias por asignatura",
            headers: ["Alumno", "Asignatura", "Media", "Evaluados", "Pendientes", "Riesgo"],
            rows: subjectRows
          }
        ]
      })
    );
  };

  const exportPrintableStudentReports = (): void => {
    const indexRows = students.map((student) => {
      const finalGrade = reportData.finalGradeByStudent.get(student.id);
      const attendanceSummary = attendanceByStudent.get(student.id) ?? { present: 0, late: 0, absent: 0, total: 0, rate: 0 };
      const stats = getItemStats(student.id);
      return [
        formatName(student),
        student.email ?? "",
        formatOptionalNumber(finalGrade) || "-",
        `${attendanceSummary.rate}%`,
        `${stats.missing}/${stats.total}`,
        riskLabel(finalGrade, attendanceSummary.rate, stats.missingRate, student.hasAcs, student.hasReinforcement)
      ];
    });

    const sections = students.map((student, index) => {
      const finalGrade = reportData.finalGradeByStudent.get(student.id);
      const attendanceSummary = attendanceByStudent.get(student.id) ?? { present: 0, late: 0, absent: 0, total: 0, rate: 0 };
      const stats = getItemStats(student.id);
      const risk = riskLabel(finalGrade, attendanceSummary.rate, stats.missingRate, student.hasAcs, student.hasReinforcement);
      const support = joinUnique([
        student.hasAcs ? "ACS" : undefined,
        student.hasReinforcement ? "Refuerzo" : undefined
      ]) || "Sin apoyos marcados";
      const observations = joinUnique([
        ...(attendanceNotesByStudent.get(student.id) ?? []),
        ...(followUpNotesByStudent.get(student.id) ?? [])
      ]) || "-";

      const subjectRows = subjectsForClass.map((subject) => {
        const subjectGrade = reportData.subjectGradeByStudentSubject.get(studentSubjectKey(student.id, subject.id));
        const subjectStats = getItemStats(student.id, subject.id);
        return [
          subject.name,
          formatOptionalNumber(subjectGrade) || "-",
          `${subjectStats.scored}/${subjectStats.total}`,
          String(subjectStats.missing),
          riskLabel(subjectGrade, attendanceSummary.rate, subjectStats.missingRate, student.hasAcs, student.hasReinforcement)
        ];
      });

      const evaluationRows = reportData.reportItems.map((item) => {
        const score = getItemScore(item, student.id);
        return [
          item.subjectName,
          item.type === "assessment" ? "Evaluación" : "Tarea",
          item.title,
          item.period ?? "",
          item.competency ?? "",
          formatOptionalNumber(item.weight) || "-",
          `${(item.contribution * 100).toFixed(2)}%`,
          formatOptionalNumber(score) || "Pendiente",
          getItemComment(item, student.id)
        ];
      });

      return {
        title: `Informe individual - ${formatName(student)}`,
        pageBreakBefore: index > 0,
        summary: [
          { label: "Media final", value: formatOptionalNumber(finalGrade) || "-" },
          { label: "Asistencia", value: `${attendanceSummary.rate}%` },
          { label: "Pendientes", value: `${stats.missing}/${stats.total}` },
          { label: "Riesgo", value: risk }
        ],
        tables: [
          {
            title: "Datos tutoriales",
            headers: ["Email", "Apoyos", "Asistencia", "Observaciones y seguimiento"],
            rows: [[student.email ?? "", support, `${attendanceSummary.present} presentes, ${attendanceSummary.late} retrasos, ${attendanceSummary.absent} ausencias`, observations]]
          },
          {
            title: "Resumen por asignatura",
            headers: ["Asignatura", "Media", "Evaluados", "Pendientes", "Riesgo"],
            rows: subjectRows
          },
          {
            title: "Detalle evaluable",
            headers: ["Asignatura", "Tipo", "Elemento", "Periodo", "Competencia", "Peso", "Aporta", "Nota", "Observaciones"],
            rows: evaluationRows
          }
        ]
      };
    });

    downloadHtml(
      `informes-individuales-${formatDate()}.html`,
      buildPrintableReportHtml({
        title: "Informes individuales del grupo",
        generatedAt: new Date().toLocaleString("es-ES"),
        summary: [
          { label: "Alumnos", value: String(students.length) },
          { label: "Elementos evaluables", value: String(reportData.reportItems.length) },
          { label: "Media global", value: avgGrade !== null ? avgGrade.toFixed(2) : "-" },
          { label: "Asistencia", value: attendanceRate !== null ? `${attendanceRate}%` : "-" }
        ],
        tables: [
          {
            title: "Índice del grupo",
            headers: ["Alumno", "Email", "Media final", "Asistencia", "Pendientes", "Riesgo"],
            rows: indexRows
          }
        ],
        sections
      })
    );
  };

  const reportTemplates = [
    {
      name: "Informe imprimible",
      description: "Resumen del grupo listo para abrir, imprimir o guardar como PDF",
      format: "HTML",
      action: exportPrintableGroupReport
    },
    {
      name: "Informes individuales imprimibles",
      description: "Una página por alumno para tutorías, evaluación o familias",
      format: "HTML",
      action: exportPrintableStudentReports
    },
    {
      name: "Resumen académico",
      description: "Medias, pendientes, asistencia y señales de seguimiento",
      format: "CSV",
      action: exportAcademicSummary
    },
    {
      name: "Detalle de evaluación",
      description: "Una fila por alumno y elemento evaluable",
      format: "CSV",
      action: exportEvaluationDetail
    },
    {
      name: "Informe individual",
      description: "Notas, tareas, asistencia, apoyos y observaciones por alumno",
      format: "CSV",
      action: exportIndividual
    },
    {
      name: "Acta de grupo",
      description: "Tabla de calificaciones del grupo con medias por asignatura",
      format: "CSV",
      action: exportGrades
    },
    {
      name: "Resumen de asistencia",
      description: "Estadísticas y observaciones de asistencia por alumno",
      format: "CSV",
      action: exportAttendance
    },
    {
      name: "Dataset para IA",
      description: "Señales agregadas para análisis, tutoría y propuestas de intervención",
      format: "CSV",
      action: exportAiDataset
    }
  ];

  const aiReportTemplates: Array<{ name: string; description: string; kind: AiReportKind }> = [
    {
      name: "Plan de recuperación",
      description: "Objetivos, tareas pendientes y seguimiento, ideal por alumno",
      kind: "recovery"
    },
    {
      name: "Resumen de tutoría",
      description: "Síntesis del grupo, prioridades y próximos pasos",
      kind: "tutorial"
    },
    {
      name: "Plan de refuerzo",
      description: "Propuestas por alumno y asignatura a partir de notas, pendientes y apoyos",
      kind: "reinforcement"
    },
    {
      name: "Comentarios para familias",
      description: "Borradores profesionales y editables para comunicación",
      kind: "families"
    },
    {
      name: "Análisis de tareas y rúbricas",
      description: "Detecta criterios, ítems o tareas que conviene reenseñar",
      kind: "taskAnalysis"
    },
    {
      name: "Mapa de riesgo",
      description: "Clasificación del grupo por riesgo y acciones inmediatas",
      kind: "riskMap"
    },
    {
      name: "Seguimiento ACS y refuerzo",
      description: "Evidencias y apoyos para alumnado con ACS o refuerzo",
      kind: "acsSupport"
    },
    {
      name: "Diagnóstico de asignatura",
      description: "Comparativa o diagnóstico filtrado por asignatura",
      kind: "subjectDiagnosis"
    },
    {
      name: "Asistencia y rendimiento",
      description: "Patrones de asistencia, observaciones y posible impacto académico",
      kind: "attendance"
    }
  ];

  return (
    <section className="module-card">
      <div className="courses-layout">
        <aside className="courses-list-panel">
          <ContextSidebarTabs includeSubjects={false} />
        </aside>

        <section className="course-detail-panel">
          <section className="detail-section flush">
            <div className="metric-grid compact">
              <article className="metric-item">
                <strong>Alumnos</strong>
                <div>{students.length}</div>
              </article>
              <article className="metric-item">
                <strong>Elementos</strong>
                <div>{reportData.reportItems.length}</div>
              </article>
              <article className="metric-item">
                <strong>Media global</strong>
                <div>{avgGrade !== null ? avgGrade.toFixed(2) : "-"}</div>
              </article>
              <article className="metric-item">
                <strong>Asistencia</strong>
                <div>
                  {attendanceRate !== null ? `${attendanceRate}%` : "-"}
                  {totalSessions > 0 ? <small className="metric-subvalue">{totalSessions} sesiones</small> : null}
                </div>
              </article>
            </div>
          </section>

          <section className="detail-section">
            <div className="table-scroll">
              <table aria-label="Plantillas de informes disponibles">
                <thead>
                  <tr>
                    <th>Plantilla</th>
                    <th>Descripción</th>
                    <th>Formato</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {reportTemplates.map((item) => (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>{item.description}</td>
                      <td>{item.format}</td>
                      <td>
                        <button
                          type="button"
                          className="btn secondary"
                          disabled={students.length === 0}
                          onClick={item.action}
                          aria-label={`Descargar ${item.name.toLowerCase()} en ${item.format}`}
                        >
                          Descargar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {students.length === 0 ? (
              <p className="empty-state">Selecciona un curso para generar informes.</p>
            ) : null}
          </section>

          <section className="detail-section">
            <div className="detail-grid">
              <div className="detail-field">
                <label htmlFor="ai-report-student">Alumno</label>
                <select
                  id="ai-report-student"
                  className="input"
                  value={selectedAiStudentId}
                  onChange={(event) => setSelectedAiStudentId(event.target.value)}
                >
                  <option value="">Grupo completo</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {formatName(student)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="detail-field">
                <label htmlFor="ai-report-subject">Asignatura</label>
                <select
                  id="ai-report-subject"
                  className="input"
                  value={selectedAiSubjectId}
                  onChange={(event) => setSelectedAiSubjectId(event.target.value)}
                >
                  <option value="">Todas</option>
                  {subjectsForClass.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="detail-field">
                <label>Privacidad</label>
                <label className="chip-toggle">
                  <input
                    type="checkbox"
                    checked={anonymizeAiReports}
                    onChange={(event) => setAnonymizeAiReports(event.target.checked)}
                  />
                  {anonymizeAiReports ? "Datos sin nombres" : "Incluir nombres"}
                </label>
              </div>
            </div>
            <div className="table-scroll">
              <table aria-label="Informes generados con IA">
                <thead>
                  <tr>
                    <th>Informe IA</th>
                    <th>Descripción</th>
                    <th>Formato</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {aiReportTemplates.map((item) => (
                    <tr key={item.kind}>
                      <td>{item.name}</td>
                      <td>{item.description}</td>
                      <td>TXT</td>
                      <td>
                        <button
                          type="button"
                          className="btn secondary"
                          disabled={students.length === 0 || isGeneratingAiReport}
                          onClick={() => void generateAiReport(item.kind)}
                          aria-label={`Generar ${item.name.toLowerCase()} con IA`}
                        >
                          Generar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>

      <Modal
        open={isAiReportModalOpen}
        title={aiReportTitle || "Informe IA"}
        onClose={() => {
          if (!isGeneratingAiReport) {
            setIsAiReportModalOpen(false);
          }
        }}
      >
        <div className="detail-section flush">
          <p className="hint" role="status" aria-live="polite">{aiReportStatus}</p>
          {aiReportOutput ? (
            <>
              <div className="actions-cell">
                <button type="button" className="btn secondary" onClick={downloadAiReport}>
                  Descargar TXT
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => void navigator.clipboard?.writeText(aiReportOutput)}
                >
                  Copiar
                </button>
              </div>
              <pre className="ai-report-output">{aiReportOutput}</pre>
            </>
          ) : null}
        </div>
      </Modal>
    </section>
  );
}
