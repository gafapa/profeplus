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
  Subject,
  SubjectCourseLink,
  Task,
  TaskChecklistAssessment,
  TaskDailyEvaluationSetting,
  TaskGradebookConfig,
  TaskRubricAssessment,
  TaskSubjectLink
} from "../../shared/db/types";
import { useStudentDisplay } from "../../shared/hooks/useStudentDisplay";
import { ContextSidebarTabs } from "../../shared/ui/ContextSidebarTabs";

type ReportTaskRow = {
  taskId: string;
  subjectId: string;
  subjectName: string;
  title: string;
  gradebookWeight: number;
  groupId?: string;
  rubricTemplateId?: string;
  checklistTemplateId?: string;
};

type ReportItem = {
  key: string;
  type: "assessment" | "task";
  sourceId: string;
  subjectId: string;
  subjectName: string;
  title: string;
  contribution: number;
  weight: number;
};

type AttendanceSummary = {
  present: number;
  late: number;
  absent: number;
  total: number;
  rate: number;
};

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

function downloadJson(filename: string, data: unknown): void {
  downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8;" }));
}

function formatDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function gradeCellKey(studentId: string, assessmentId: string): string {
  return `${studentId}:${assessmentId}`;
}

function taskStudentKey(taskId: string, studentId: string): string {
  return `${taskId}:${studentId}`;
}

function studentSubjectKey(studentId: string, subjectId: string): string {
  return `${studentId}:${subjectId}`;
}

function taskSubjectKey(taskId: string, subjectId: string): string {
  return `${taskId}:${subjectId}`;
}

function formatOptionalNumber(value: number | null | undefined): string {
  return typeof value === "number" ? value.toFixed(2) : "";
}

function calculateAttendanceSummary(attendance: AttendanceEntry[], studentId: string): AttendanceSummary {
  const rows = attendance.filter((entry) => entry.studentId === studentId);
  const present = rows.filter((entry) => entry.status === "present").length;
  const late = rows.filter((entry) => entry.status === "late").length;
  const absent = rows.filter((entry) => entry.status === "absent").length;
  const total = present + late + absent;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
  return { present, late, absent, total, rate };
}

function buildOrderedGroupIdsByParent(groups: GradebookGroup[]): Map<string, string[]> {
  const byId = new Set(groups.map((group) => group.id));
  const rowsByParent = new Map<string, GradebookGroup[]>();

  for (const group of groups) {
    const parentKey = group.parentId && byId.has(group.parentId) ? group.parentId : "";
    if (!rowsByParent.has(parentKey)) {
      rowsByParent.set(parentKey, []);
    }
    rowsByParent.get(parentKey)?.push(group);
  }

  const map = new Map<string, string[]>();
  for (const [parentId, rows] of rowsByParent.entries()) {
    rows.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    map.set(
      parentId,
      rows.map((group) => group.id)
    );
  }

  return map;
}

function calculateContributions(
  assessments: Assessment[],
  tasks: ReportTaskRow[],
  groups: GradebookGroup[]
): {
  assessmentContributionById: Map<string, number>;
  taskContributionByKey: Map<string, number>;
} {
  const validGroupIds = new Set(groups.map((group) => group.id));
  const gradebookGroupById = new Map(groups.map((group) => [group.id, group]));
  const orderedGroupIdsByParent = buildOrderedGroupIdsByParent(groups);

  const assessmentsByParent = new Map<string, Assessment[]>();
  for (const assessment of assessments) {
    const parentId = assessment.groupId && validGroupIds.has(assessment.groupId) ? assessment.groupId : "";
    if (!assessmentsByParent.has(parentId)) {
      assessmentsByParent.set(parentId, []);
    }
    assessmentsByParent.get(parentId)?.push(assessment);
  }

  const tasksByParent = new Map<string, ReportTaskRow[]>();
  for (const task of tasks) {
    const parentId = task.groupId && validGroupIds.has(task.groupId) ? task.groupId : "";
    if (!tasksByParent.has(parentId)) {
      tasksByParent.set(parentId, []);
    }
    tasksByParent.get(parentId)?.push(task);
  }

  const assessmentContributionById = new Map<string, number>();
  const taskContributionByKey = new Map<string, number>();
  const groupLeafItemCountById = new Map<string, number>();

  const leafItemCount = (groupId: string, branch: Set<string>): number => {
    const cached = groupLeafItemCountById.get(groupId);
    if (typeof cached === "number") {
      return cached;
    }

    if (branch.has(groupId)) {
      groupLeafItemCountById.set(groupId, 0);
      return 0;
    }

    const nextBranch = new Set(branch);
    nextBranch.add(groupId);
    const directAssessmentsCount = (assessmentsByParent.get(groupId) ?? []).length;
    const directTasksCount = (tasksByParent.get(groupId) ?? []).length;
    const childCount = (orderedGroupIdsByParent.get(groupId) ?? []).reduce((sum, childId) => {
      return sum + leafItemCount(childId, nextBranch);
    }, 0);
    const total = directAssessmentsCount + directTasksCount + childCount;
    groupLeafItemCountById.set(groupId, total);
    return total;
  };

  for (const group of groups) {
    leafItemCount(group.id, new Set<string>());
  }

  const visit = (parentId: string, parentShare: number, branch: Set<string>): void => {
    const childGroupIds = (orderedGroupIdsByParent.get(parentId) ?? []).filter((groupId) => !branch.has(groupId));
    const distributableGroupIds = childGroupIds.filter((groupId) => (groupLeafItemCountById.get(groupId) ?? 0) > 0);
    const directAssessments = assessmentsByParent.get(parentId) ?? [];
    const directTasks = tasksByParent.get(parentId) ?? [];
    const itemsCount = distributableGroupIds.length + directAssessments.length + directTasks.length;

    let totalWeight = 0;
    for (const groupId of distributableGroupIds) {
      totalWeight += Math.max(0, Number(gradebookGroupById.get(groupId)?.weight ?? 0));
    }
    for (const assessment of directAssessments) {
      totalWeight += Math.max(0, Number(assessment.weight ?? 0));
    }
    for (const task of directTasks) {
      totalWeight += Math.max(0, Number(task.gradebookWeight ?? 0));
    }

    if (parentShare <= 0 || itemsCount === 0) {
      for (const groupId of distributableGroupIds) {
        const nextBranch = new Set(branch);
        nextBranch.add(groupId);
        visit(groupId, 0, nextBranch);
      }
      for (const assessment of directAssessments) {
        assessmentContributionById.set(assessment.id, 0);
      }
      for (const task of directTasks) {
        taskContributionByKey.set(taskSubjectKey(task.taskId, task.subjectId), 0);
      }
      return;
    }

    const contributionForWeight = (weight: number): number =>
      totalWeight > 0 ? parentShare * (Math.max(0, weight) / totalWeight) : parentShare / itemsCount;

    for (const assessment of directAssessments) {
      assessmentContributionById.set(assessment.id, contributionForWeight(Number(assessment.weight ?? 0)));
    }
    for (const task of directTasks) {
      taskContributionByKey.set(
        taskSubjectKey(task.taskId, task.subjectId),
        contributionForWeight(Number(task.gradebookWeight ?? 0))
      );
    }
    for (const groupId of distributableGroupIds) {
      const contribution = contributionForWeight(Number(gradebookGroupById.get(groupId)?.weight ?? 0));
      const nextBranch = new Set(branch);
      nextBranch.add(groupId);
      visit(groupId, contribution, nextBranch);
    }
  };

  visit("", 1, new Set<string>());

  for (const assessment of assessments) {
    if (!assessmentContributionById.has(assessment.id)) {
      assessmentContributionById.set(assessment.id, 0);
    }
  }
  for (const task of tasks) {
    const key = taskSubjectKey(task.taskId, task.subjectId);
    if (!taskContributionByKey.has(key)) {
      taskContributionByKey.set(key, 0);
    }
  }

  return { assessmentContributionById, taskContributionByKey };
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
  const [taskDailySettings, setTaskDailySettings] = useState<TaskDailyEvaluationSetting[]>([]);
  const [taskRubricAssessments, setTaskRubricAssessments] = useState<TaskRubricAssessment[]>([]);
  const [taskChecklistAssessments, setTaskChecklistAssessments] = useState<TaskChecklistAssessment[]>([]);
  const [rubricTemplates, setRubricTemplates] = useState<RubricTemplate[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [gradebookGroups, setGradebookGroups] = useState<GradebookGroup[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [entries, setEntries] = useState<GradeEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);

  useEffect(() => {
    let active = true;

    const clearData = (): void => {
      setStudents([]);
      setSubjects([]);
      setSubjectLinks([]);
      setTasks([]);
      setTaskLinks([]);
      setTaskConfigs([]);
      setTaskDailySettings([]);
      setTaskRubricAssessments([]);
      setTaskChecklistAssessments([]);
      setRubricTemplates([]);
      setChecklistTemplates([]);
      setGradebookGroups([]);
      setAssessments([]);
      setEntries([]);
      setAttendance([]);
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
        taskDailySettingsData,
        taskRubricAssessmentsData,
        taskChecklistAssessmentsData,
        rubricTemplatesData,
        checklistTemplatesData,
        gradebookGroupsData,
        assessmentsData,
        entriesData,
        attendanceData
      ] = await Promise.all([
        db.students.where("classId").equals(selectedClassId).toArray(),
        db.subjects.orderBy("name").toArray(),
        db.subjectCourseLinks.where("classId").equals(selectedClassId).toArray(),
        db.tasks.filter((task) => Boolean(task.sendToGradebook)).toArray(),
        db.taskSubjectLinks.toArray(),
        db.taskGradebookConfigs.where("classId").equals(selectedClassId).toArray(),
        db.taskDailyEvaluationSettings.toArray(),
        db.taskRubricAssessments.toArray(),
        db.taskChecklistAssessments.toArray(),
        db.rubricTemplates.where("classId").equals(selectedClassId).toArray(),
        db.checklistTemplates.where("classId").equals(selectedClassId).toArray(),
        db.gradebookGroups.where("classId").equals(selectedClassId).toArray(),
        db.assessments.where("classId").equals(selectedClassId).toArray(),
        db.gradeEntries.where("classId").equals(selectedClassId).toArray(),
        db.attendanceEntries.where("classId").equals(selectedClassId).toArray()
      ]);

      if (!active) return;

      setStudents(studentsData.sort(compareFn));
      setSubjects(subjectsData);
      setSubjectLinks(subjectLinksData);
      setTasks(tasksData);
      setTaskLinks(taskLinksData);
      setTaskConfigs(taskConfigsData);
      setTaskDailySettings(taskDailySettingsData);
      setTaskRubricAssessments(taskRubricAssessmentsData);
      setTaskChecklistAssessments(taskChecklistAssessmentsData);
      setRubricTemplates(rubricTemplatesData);
      setChecklistTemplates(checklistTemplatesData);
      setGradebookGroups(gradebookGroupsData);
      setAssessments(assessmentsData);
      setEntries(entriesData);
      setAttendance(attendanceData);
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
        checklistTemplateId: config?.checklistTemplateId
      });
    }

    return rows.sort((a, b) => a.subjectName.localeCompare(b.subjectName) || a.title.localeCompare(b.title));
  }, [subjectLinks, subjects, taskConfigs, taskLinks, tasks]);

  const visibleTaskIds = useMemo(() => new Set(reportTasks.map((task) => task.taskId)), [reportTasks]);

  const entriesByKey = useMemo(() => {
    const map = new Map<string, GradeEntry>();
    for (const entry of entries) {
      map.set(gradeCellKey(entry.studentId, entry.assessmentId), entry);
    }
    return map;
  }, [entries]);

  const taskScoreByTaskStudent = useMemo(() => {
    const scoreMap = new Map<string, number>();
    const rubricTemplateById = new Map(rubricTemplates.map((item) => [item.id, item]));
    const checklistTemplateById = new Map(checklistTemplates.map((item) => [item.id, item]));
    const settingsByTask = new Map<string, TaskDailyEvaluationSetting[]>();

    for (const setting of taskDailySettings) {
      if (!visibleTaskIds.has(setting.taskId)) continue;
      if (!settingsByTask.has(setting.taskId)) {
        settingsByTask.set(setting.taskId, []);
      }
      settingsByTask.get(setting.taskId)?.push(setting);
    }

    for (const task of reportTasks) {
      const settings = settingsByTask.get(task.taskId) ?? [];
      for (const student of students) {
        const sessionScores: number[] = [];
        for (const setting of settings) {
          const sessionSlotId = setting.scheduleSlotId ?? "";
          const rubricId = task.rubricTemplateId || setting.rubricTemplateId || "";
          const checklistId = task.checklistTemplateId || setting.checklistTemplateId || "";

          if (rubricId) {
            const template = rubricTemplateById.get(rubricId);
            if (!template) continue;
            const maxScore = (template.criteria ?? []).reduce((sum, criterion) => {
              const criterionMax = Math.max(...(criterion.levels ?? []).map((level) => Number(level.score) || 0), 0);
              return sum + criterionMax;
            }, 0);
            if (maxScore <= 0) continue;

            const rows = taskRubricAssessments.filter(
              (row) =>
                row.taskId === task.taskId &&
                row.studentId === student.id &&
                row.date === setting.date &&
                (row.scheduleSlotId ?? "") === sessionSlotId
            );
            if (rows.length === 0) continue;
            const score = rows.reduce((sum, row) => sum + (Number(row.score) || 0), 0);
            sessionScores.push(Math.max(0, Math.min(10, (score / maxScore) * 10)));
            continue;
          }

          if (checklistId) {
            const template = checklistTemplateById.get(checklistId);
            const totalItems = template?.items?.length ?? 0;
            if (totalItems <= 0) continue;
            const checkedCount = taskChecklistAssessments.filter(
              (row) =>
                row.taskId === task.taskId &&
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
          scoreMap.set(taskStudentKey(task.taskId, student.id), Number(averageScore.toFixed(2)));
        }
      }
    }

    return scoreMap;
  }, [
    checklistTemplates,
    reportTasks,
    students,
    taskChecklistAssessments,
    taskDailySettings,
    taskRubricAssessments,
    rubricTemplates,
    visibleTaskIds
  ]);

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
          const score = taskScoreByTaskStudent.get(taskStudentKey(task.taskId, student.id));
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
    const score = taskScoreByTaskStudent.get(taskStudentKey(item.sourceId, studentId));
    return typeof score === "number" ? score : null;
  };

  const exportGrades = (): void => {
    const header = [
      "Alumno",
      ...reportData.reportItems.map((item) => `${item.subjectName} - ${item.title}`),
      "Media cuaderno"
    ];
    const rows: string[][] = [header];

    for (const student of students) {
      rows.push([
        formatName(student),
        ...reportData.reportItems.map((item) => formatOptionalNumber(getItemScore(item, student.id))),
        formatOptionalNumber(reportData.finalGradeByStudent.get(student.id))
      ]);
    }

    downloadCsv(`acta-grupo-${formatDate()}.csv`, rows);
  };

  const exportAttendance = (): void => {
    const header = ["Alumno", "Presentes", "Retrasos", "Ausencias", "Total sesiones", "% Asistencia"];
    const rows: string[][] = [header];

    for (const student of students) {
      const summary = attendanceByStudent.get(student.id) ?? { present: 0, late: 0, absent: 0, total: 0, rate: 0 };
      rows.push([
        formatName(student),
        String(summary.present),
        String(summary.late),
        String(summary.absent),
        String(summary.total),
        `${summary.rate}%`
      ]);
    }

    downloadCsv(`asistencia-${formatDate()}.csv`, rows);
  };

  const exportIndividual = (): void => {
    const rows: string[][] = [
      ["Alumno", "Tipo", "Asignatura", "Elemento", "Nota", "Aporta"],
      ...students.flatMap((student) => {
        const itemRows = reportData.reportItems.map((item) => [
          formatName(student),
          item.type === "assessment" ? "Evaluación" : "Tarea",
          item.subjectName,
          item.title,
          formatOptionalNumber(getItemScore(item, student.id)) || "-",
          `${(item.contribution * 100).toFixed(2)}%`
        ]);
        const subjectRows = subjectsForClass.map((subject) => [
          formatName(student),
          "Media asignatura",
          subject.name,
          "Cuaderno",
          formatOptionalNumber(reportData.subjectGradeByStudentSubject.get(studentSubjectKey(student.id, subject.id))) || "-",
          ""
        ]);
        const attendanceSummary = attendanceByStudent.get(student.id) ?? { present: 0, late: 0, absent: 0, total: 0, rate: 0 };
        const summaryRows = [
          [
            formatName(student),
            "Media final",
            "",
            "Cuaderno",
            formatOptionalNumber(reportData.finalGradeByStudent.get(student.id)) || "-",
            ""
          ],
          [
            formatName(student),
            "Asistencia",
            "",
            `${attendanceSummary.total} sesiones`,
            `${attendanceSummary.rate}%`,
            ""
          ]
        ];
        return [...itemRows, ...subjectRows, ...summaryRows];
      })
    ];

    downloadCsv(`informe-individual-${formatDate()}.csv`, rows);
  };

  const exportJson = (): void => {
    const payload = {
      generatedAt: new Date().toISOString(),
      classId: selectedClassId,
      subjects: subjectsForClass.map((subject) => ({ id: subject.id, name: subject.name })),
      items: reportData.reportItems,
      students: students.map((student) => {
        const attendanceSummary = attendanceByStudent.get(student.id) ?? { present: 0, late: 0, absent: 0, total: 0, rate: 0 };
        return {
          id: student.id,
          name: formatName(student),
          finalGrade: reportData.finalGradeByStudent.get(student.id),
          subjectGrades: subjectsForClass.map((subject) => ({
            subjectId: subject.id,
            subjectName: subject.name,
            grade: reportData.subjectGradeByStudentSubject.get(studentSubjectKey(student.id, subject.id)) ?? null
          })),
          itemScores: reportData.reportItems.map((item) => ({
            itemKey: item.key,
            score: getItemScore(item, student.id)
          })),
          attendance: attendanceSummary
        };
      })
    };

    downloadJson(`informes-${formatDate()}.json`, payload);
  };

  const reportTemplates = [
    {
      name: "Informe individual",
      description: "Notas, tareas y asistencia por alumno",
      format: "CSV",
      action: exportIndividual
    },
    {
      name: "Acta de grupo",
      description: "Tabla de calificaciones del grupo",
      format: "CSV",
      action: exportGrades
    },
    {
      name: "Resumen de asistencia",
      description: "Estadísticas de asistencia por alumno",
      format: "CSV",
      action: exportAttendance
    },
    {
      name: "Datos completos",
      description: "Notas, tareas, medias y asistencia en bruto",
      format: "JSON",
      action: exportJson
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
        </section>
      </div>
    </section>
  );
}
