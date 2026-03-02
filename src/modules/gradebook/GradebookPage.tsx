import { type DragEvent, useEffect, useMemo, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import { db } from "../../shared/db/database";
import type {
  Assessment,
  ChecklistTemplate,
  GradeEntry,
  GradebookGroup,
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

type IncludedTaskRow = {
  taskId: string;
  subjectId: string;
  title: string;
  subjectName: string;
  unitName: string;
  sessionsCount: number;
  weight: number;
  instrument: string;
  groupId?: string;
};

type OrderedGroupRow = {
  id: string;
  name: string;
  depth: number;
  pathLabel: string;
  treeLabel: string;
};

function gradeCellKey(studentId: string, assessmentId: string): string {
  return `${studentId}:${assessmentId}`;
}

function taskStudentKey(taskId: string, studentId: string): string {
  return `${taskId}:${studentId}`;
}

function studentGroupKey(studentId: string, groupId: string): string {
  return `${studentId}:${groupId}`;
}

function parseWeight(rawValue: string): number | null {
  const normalized = rawValue.replace(",", ".").trim();
  if (normalized.length === 0) {
    return 0;
  }
  const parsed = Number(normalized);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }
  return Number(parsed.toFixed(2));
}

function formatContribution(share: number): string {
  return `${(Math.max(0, share) * 100).toFixed(2)}%`;
}

function buildOrderedGroupRows(groups: GradebookGroup[]): OrderedGroupRow[] {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const childrenByParent = new Map<string, GradebookGroup[]>();

  for (const group of groups) {
    const parentId = group.parentId && byId.has(group.parentId) ? group.parentId : "";
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, []);
    }
    childrenByParent.get(parentId)?.push(group);
  }

  for (const rows of childrenByParent.values()) {
    rows.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }

  const ordered: OrderedGroupRow[] = [];
  const visit = (parentId: string, depth: number, parentPath: string): void => {
    const children = childrenByParent.get(parentId) ?? [];
    for (const child of children) {
      const pathLabel = parentPath ? `${parentPath} / ${child.name}` : child.name;
      ordered.push({
        id: child.id,
        name: child.name,
        depth,
        pathLabel,
        treeLabel: `${"  ".repeat(depth)}${child.name}`
      });
      visit(child.id, depth + 1, pathLabel);
    }
  };

  visit("", 0, "");
  return ordered;
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

function IconTask() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function IconFolderPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M12 10v6" />
      <path d="M9 13h6" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function GradebookPage() {
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const selectedSubjectId = useAppSelector((state) => state.app.selectedSubjectId);
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [entries, setEntries] = useState<GradeEntry[]>([]);
  const [includedTaskConfigs, setIncludedTaskConfigs] = useState<Task[]>([]);
  const [taskDailyEvaluationSettings, setTaskDailyEvaluationSettings] = useState<TaskDailyEvaluationSetting[]>([]);
  const [taskRubricAssessments, setTaskRubricAssessments] = useState<TaskRubricAssessment[]>([]);
  const [taskChecklistAssessments, setTaskChecklistAssessments] = useState<TaskChecklistAssessment[]>([]);
  const [rubricTemplates, setRubricTemplates] = useState<RubricTemplate[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [gradebookGroups, setGradebookGroups] = useState<GradebookGroup[]>([]);

  const [pendingTaskWeightKeys, setPendingTaskWeightKeys] = useState<Set<string>>(new Set());
  const [pendingGroupWeightKeys, setPendingGroupWeightKeys] = useState<Set<string>>(new Set());

  const [gradebookNotice, setGradebookNotice] = useState("");
  const [includedTasks, setIncludedTasks] = useState<IncludedTaskRow[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [newGroupDraftByParent, setNewGroupDraftByParent] = useState<Record<string, string>>({});
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string>("");

  const loadData = async (): Promise<void> => {
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
      setGradebookGroups([]);
      setIncludedTasks([]);
      setPendingTaskWeightKeys(new Set());
      setPendingGroupWeightKeys(new Set());
      setExpandedGroupIds(new Set());
      setNewGroupDraftByParent({});
      setDraggedTaskId(null);
      setDropTargetGroupId("");
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
      checklistTemplatesData,
      gradebookGroupsData
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
      db.checklistTemplates.where("classId").equals(selectedClassId).toArray(),
      selectedSubjectId
        ? db.gradebookGroups.where("[classId+subjectId]").equals([selectedClassId, selectedSubjectId]).toArray()
        : Promise.resolve([])
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
        subjectId: task.subjectId,
        title: task.title || "Tarea sin titulo",
        subjectName: subjectsById.get(task.subjectId)?.name ?? "-",
        unitName: task.unitId ? unitsById.get(task.unitId)?.name ?? "-" : "-",
        sessionsCount: sessionsByTask.get(task.id)?.length ?? 0,
        weight: Number(task.gradebookWeight ?? 0),
        instrument: task.rubricTemplateId ? "Rubrica" : task.checklistTemplateId ? "Lista de cotejo" : "-",
        groupId: task.groupId
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
    setGradebookGroups(gradebookGroupsData);
    setIncludedTasks(visibleTasks);

    setPendingTaskWeightKeys(new Set());
    setPendingGroupWeightKeys(new Set());
  };

  useEffect(() => {
    void loadData();
  }, [selectedClassId, selectedSubjectId]);

  const orderedGroupRows = useMemo(() => buildOrderedGroupRows(gradebookGroups), [gradebookGroups]);

  useEffect(() => {
    setExpandedGroupIds((current) => {
      const validIds = new Set(orderedGroupRows.map((row) => row.id));
      const next = new Set<string>();

      for (const id of current) {
        if (validIds.has(id)) {
          next.add(id);
        }
      }

      if (current.size === 0 && orderedGroupRows.length > 0) {
        for (const row of orderedGroupRows) {
          next.add(row.id);
        }
      }

      return next;
    });
  }, [orderedGroupRows]);

  const groupChildrenByParent = useMemo(() => {
    const byId = new Set(gradebookGroups.map((group) => group.id));
    const map = new Map<string, string[]>();
    for (const group of gradebookGroups) {
      const parentKey = group.parentId && byId.has(group.parentId) ? group.parentId : "";
      if (!map.has(parentKey)) {
        map.set(parentKey, []);
      }
      map.get(parentKey)?.push(group.id);
    }
    return map;
  }, [gradebookGroups]);

  const groupSubtreeById = useMemo(() => {
    const memo = new Map<string, Set<string>>();

    const visit = (groupId: string): Set<string> => {
      const cached = memo.get(groupId);
      if (cached) {
        return cached;
      }
      const set = new Set<string>([groupId]);
      const children = groupChildrenByParent.get(groupId) ?? [];
      for (const childId of children) {
        const childSet = visit(childId);
        for (const item of childSet) {
          set.add(item);
        }
      }
      memo.set(groupId, set);
      return set;
    };

    for (const row of orderedGroupRows) {
      visit(row.id);
    }

    return memo;
  }, [groupChildrenByParent, orderedGroupRows]);

  const gradebookGroupById = useMemo(() => new Map(gradebookGroups.map((group) => [group.id, group])), [gradebookGroups]);

  const orderedGroupIdsByParent = useMemo(() => {
    const byId = new Set(gradebookGroups.map((group) => group.id));
    const rowsByParent = new Map<string, GradebookGroup[]>();
    for (const group of gradebookGroups) {
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
  }, [gradebookGroups]);

  const filteredIncludedTasks = useMemo(
    () =>
      selectedSubjectId
        ? includedTasks.filter((task) => task.subjectId === selectedSubjectId)
        : [],
    [includedTasks, selectedSubjectId]
  );

  const filteredIncludedTaskConfigs = useMemo(
    () =>
      selectedSubjectId
        ? includedTaskConfigs.filter((task) => task.subjectId === selectedSubjectId)
        : [],
    [includedTaskConfigs, selectedSubjectId]
  );

  const filteredAssessments = useMemo(
    () =>
      selectedSubjectId
        ? assessments.filter((assessment) => assessment.subjectId === selectedSubjectId)
        : [],
    [assessments, selectedSubjectId]
  );

  const tasksByGroupId = useMemo(() => {
    const byId = new Set(gradebookGroups.map((group) => group.id));
    const map = new Map<string, IncludedTaskRow[]>();

    for (const task of filteredIncludedTasks) {
      const groupKey = task.groupId && byId.has(task.groupId) ? task.groupId : "";
      if (!map.has(groupKey)) {
        map.set(groupKey, []);
      }
      map.get(groupKey)?.push(task);
    }

    for (const rows of map.values()) {
      rows.sort((a, b) => a.title.localeCompare(b.title));
    }

    return map;
  }, [filteredIncludedTasks, gradebookGroups]);

  const contributionData = useMemo(() => {
    const validGroupIds = new Set(gradebookGroups.map((group) => group.id));

    const assessmentsByParent = new Map<string, Assessment[]>();
    for (const assessment of filteredAssessments) {
      const parentId = assessment.groupId && validGroupIds.has(assessment.groupId) ? assessment.groupId : "";
      if (!assessmentsByParent.has(parentId)) {
        assessmentsByParent.set(parentId, []);
      }
      assessmentsByParent.get(parentId)?.push(assessment);
    }

    const tasksByParent = new Map<string, Task[]>();
    for (const task of filteredIncludedTaskConfigs) {
      const parentId = task.groupId && validGroupIds.has(task.groupId) ? task.groupId : "";
      if (!tasksByParent.has(parentId)) {
        tasksByParent.set(parentId, []);
      }
      tasksByParent.get(parentId)?.push(task);
    }

    const assessmentContributionById = new Map<string, number>();
    const taskContributionById = new Map<string, number>();
    const groupNodeContributionById = new Map<string, number>();
    const groupLeafContributionById = new Map<string, number>();
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

    for (const group of gradebookGroups) {
      leafItemCount(group.id, new Set<string>());
    }

    const visit = (parentId: string, parentShare: number, branch: Set<string>): number => {
      const childGroupIds = (orderedGroupIdsByParent.get(parentId) ?? []).filter((groupId) => !branch.has(groupId));
      const distributableGroupIds = childGroupIds.filter((groupId) => (groupLeafItemCountById.get(groupId) ?? 0) > 0);
      const emptyGroupIds = childGroupIds.filter((groupId) => !distributableGroupIds.includes(groupId));
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

      let leafShare = 0;

      for (const groupId of emptyGroupIds) {
        groupNodeContributionById.set(groupId, 0);
        groupLeafContributionById.set(groupId, 0);
      }

      if (parentShare <= 0 || itemsCount === 0) {
        for (const groupId of distributableGroupIds) {
          groupNodeContributionById.set(groupId, 0);
          groupLeafContributionById.set(groupId, 0);
          const nextBranch = new Set(branch);
          nextBranch.add(groupId);
          visit(groupId, 0, nextBranch);
        }
        for (const assessment of directAssessments) {
          assessmentContributionById.set(assessment.id, 0);
        }
        for (const task of directTasks) {
          taskContributionById.set(task.id, 0);
        }
        return 0;
      }

      if (totalWeight <= 0) {
        const equalContribution = parentShare / itemsCount;

        for (const assessment of directAssessments) {
          assessmentContributionById.set(assessment.id, equalContribution);
          leafShare += equalContribution;
        }

        for (const task of directTasks) {
          taskContributionById.set(task.id, equalContribution);
          leafShare += equalContribution;
        }

        for (const groupId of distributableGroupIds) {
          groupNodeContributionById.set(groupId, equalContribution);
          const nextBranch = new Set(branch);
          nextBranch.add(groupId);
          const childrenLeafShare = visit(groupId, equalContribution, nextBranch);
          groupLeafContributionById.set(groupId, childrenLeafShare);
          leafShare += childrenLeafShare;
        }

        return leafShare;
      }

      for (const assessment of directAssessments) {
        const weight = Math.max(0, Number(assessment.weight ?? 0));
        const contribution = parentShare * (weight / totalWeight);
        assessmentContributionById.set(assessment.id, contribution);
        leafShare += contribution;
      }

      for (const task of directTasks) {
        const weight = Math.max(0, Number(task.gradebookWeight ?? 0));
        const contribution = parentShare * (weight / totalWeight);
        taskContributionById.set(task.id, contribution);
        leafShare += contribution;
      }

      for (const groupId of distributableGroupIds) {
        const weight = Math.max(0, Number(gradebookGroupById.get(groupId)?.weight ?? 0));
        const groupContribution = parentShare * (weight / totalWeight);
        groupNodeContributionById.set(groupId, groupContribution);

        const nextBranch = new Set(branch);
        nextBranch.add(groupId);
        const childrenLeafShare = visit(groupId, groupContribution, nextBranch);
        groupLeafContributionById.set(groupId, childrenLeafShare);
        leafShare += childrenLeafShare;
      }

      return leafShare;
    };

    const totalDistributedShare = visit("", 1, new Set<string>());

    for (const assessment of filteredAssessments) {
      if (!assessmentContributionById.has(assessment.id)) {
        assessmentContributionById.set(assessment.id, 0);
      }
    }
    for (const task of filteredIncludedTaskConfigs) {
      if (!taskContributionById.has(task.id)) {
        taskContributionById.set(task.id, 0);
      }
    }
    for (const group of gradebookGroups) {
      if (!groupNodeContributionById.has(group.id)) {
        groupNodeContributionById.set(group.id, 0);
      }
      if (!groupLeafContributionById.has(group.id)) {
        groupLeafContributionById.set(group.id, 0);
      }
    }

    return {
      assessmentContributionById,
      taskContributionById,
      groupNodeContributionById,
      groupLeafContributionById,
      groupLeafItemCountById,
      totalDistributedShare
    };
  }, [filteredAssessments, filteredIncludedTaskConfigs, gradebookGroupById, gradebookGroups, orderedGroupIdsByParent]);

  const entriesByKey = useMemo(() => {
    const map = new Map<string, GradeEntry>();
    for (const entry of entries) {
      map.set(gradeCellKey(entry.studentId, entry.assessmentId), entry);
    }
    return map;
  }, [entries]);

  const includedTaskConfigById = useMemo(
    () => new Map(filteredIncludedTaskConfigs.map((task) => [task.id, task])),
    [filteredIncludedTaskConfigs]
  );
  const includedTaskRowById = useMemo(
    () => new Map(filteredIncludedTasks.map((task) => [task.taskId, task])),
    [filteredIncludedTasks]
  );

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

    for (const task of filteredIncludedTaskConfigs) {
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
    filteredIncludedTaskConfigs,
    rubricTemplates,
    students,
    taskChecklistAssessments,
    taskDailyEvaluationSettings,
    taskRubricAssessments
  ]);

  const partialByStudentGroup = useMemo(() => {
    const map = new Map<string, number | null>();

    for (const student of students) {
      for (const group of orderedGroupRows) {
        const subtree = groupSubtreeById.get(group.id) ?? new Set<string>([group.id]);
        let weightedSum = 0;
        let usedWeight = 0;

        for (const assessment of filteredAssessments) {
          if (!assessment.groupId || !subtree.has(assessment.groupId)) {
            continue;
          }
          const contribution = contributionData.assessmentContributionById.get(assessment.id) ?? 0;
          if (contribution <= 0) {
            continue;
          }
          const entry = entriesByKey.get(gradeCellKey(student.id, assessment.id));
          if (typeof entry?.numericValue !== "number") {
            continue;
          }
          weightedSum += entry.numericValue * contribution;
          usedWeight += contribution;
        }

        for (const task of filteredIncludedTaskConfigs) {
          const taskGroupId = task.groupId ?? "";
          if (!taskGroupId || !subtree.has(taskGroupId)) {
            continue;
          }
          const contribution = contributionData.taskContributionById.get(task.id) ?? 0;
          if (contribution <= 0) {
            continue;
          }
          const taskScore = taskScoreByTaskStudent.get(taskStudentKey(task.id, student.id));
          if (typeof taskScore !== "number") {
            continue;
          }
          weightedSum += taskScore * contribution;
          usedWeight += contribution;
        }

        map.set(studentGroupKey(student.id, group.id), usedWeight > 0 ? weightedSum / usedWeight : null);
      }
    }

    return map;
  }, [
    filteredAssessments,
    contributionData,
    entriesByKey,
    groupSubtreeById,
    filteredIncludedTaskConfigs,
    orderedGroupRows,
    students,
    taskScoreByTaskStudent
  ]);

  const createGradebookGroupAt = async (rawName: string, parentGroupId: string): Promise<boolean> => {
    if (!selectedClassId || !selectedSubjectId) {
      setGradebookNotice("Selecciona una asignatura para crear carpetas del cuaderno.");
      return false;
    }

    const name = rawName.trim();
    if (name.length < 2) {
      setGradebookNotice("La carpeta necesita nombre (minimo 2).");
      return false;
    }

    const parentId = parentGroupId || "";
    const siblings = gradebookGroups.filter((group) => (group.parentId ?? "") === parentId);
    const nextPosition = siblings.reduce((max, group) => Math.max(max, group.position), 0) + 1;

    await db.gradebookGroups.add({
      id: crypto.randomUUID(),
      classId: selectedClassId,
      subjectId: selectedSubjectId,
      name,
      parentId: parentId || undefined,
      position: nextPosition,
      weight: 0
    });

    setGradebookNotice("Carpeta creada.");
    await loadData();
    return true;
  };

  const deleteGradebookGroup = async (groupId: string): Promise<void> => {
    const hasChildren = gradebookGroups.some((group) => (group.parentId ?? "") === groupId);
    if (hasChildren) {
      setGradebookNotice("No se puede borrar la carpeta porque tiene subcarpetas.");
      return;
    }

    const usedByAssessments = filteredAssessments.some((assessment) => assessment.groupId === groupId);
    const usedByTasks = filteredIncludedTaskConfigs.some((task) => task.groupId === groupId);
    if (usedByAssessments || usedByTasks) {
      setGradebookNotice("No se puede borrar la carpeta porque esta asignada a evaluaciones o tareas.");
      return;
    }

    await db.gradebookGroups.delete(groupId);
    setGradebookNotice("Carpeta eliminada.");
    await loadData();
  };

  const updateTaskWeight = async (taskId: string, rawValue: string): Promise<void> => {
    const parsed = parseWeight(rawValue);
    if (parsed === null) {
      setGradebookNotice("El peso de tarea debe ser un numero mayor o igual a 0.");
      return;
    }

    const task = includedTaskConfigById.get(taskId);
    if (!task) {
      return;
    }

    await db.tasks.put({
      ...task,
      gradebookWeight: parsed
    });
    await loadData();
  };

  const saveTaskWeightAndClearPending = async (taskId: string, rawValue: string): Promise<void> => {
    try {
      await updateTaskWeight(taskId, rawValue);
    } finally {
      setPendingTaskWeightKeys((current) => {
        const next = new Set(current);
        next.delete(taskId);
        return next;
      });
    }
  };

  const updateTaskGroup = async (taskId: string, groupId: string): Promise<void> => {
    const task = includedTaskConfigById.get(taskId);
    if (!task) {
      return;
    }

    await db.tasks.put({
      ...task,
      groupId: groupId || undefined
    });
    await loadData();
  };

  const updateGroupWeight = async (groupId: string, rawValue: string): Promise<void> => {
    const parsed = parseWeight(rawValue);
    if (parsed === null) {
      setGradebookNotice("La ponderacion de carpeta debe ser un numero mayor o igual a 0.");
      return;
    }

    const group = gradebookGroupById.get(groupId);
    if (!group) {
      return;
    }

    await db.gradebookGroups.put({
      ...group,
      weight: parsed
    });
    await loadData();
  };

  const saveGroupWeightAndClearPending = async (groupId: string, rawValue: string): Promise<void> => {
    try {
      await updateGroupWeight(groupId, rawValue);
    } finally {
      setPendingGroupWeightKeys((current) => {
        const next = new Set(current);
        next.delete(groupId);
        return next;
      });
    }
  };

  const toggleGroupExpanded = (groupId: string): void => {
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const beginCreateSubgroup = (parentId: string): void => {
    setNewGroupDraftByParent((current) => ({
      ...current,
      [parentId]: current[parentId] ?? ""
    }));
  };

  const cancelCreateSubgroup = (parentId: string): void => {
    setNewGroupDraftByParent((current) => {
      const next = { ...current };
      delete next[parentId];
      return next;
    });
  };

  const updateSubgroupDraft = (parentId: string, value: string): void => {
    setNewGroupDraftByParent((current) => ({
      ...current,
      [parentId]: value
    }));
    setGradebookNotice("");
  };

  const submitCreateSubgroup = async (parentId: string): Promise<void> => {
    const draft = newGroupDraftByParent[parentId] ?? "";
    const created = await createGradebookGroupAt(draft, parentId);
    if (!created) {
      return;
    }
    setNewGroupDraftByParent((current) => {
      const next = { ...current };
      delete next[parentId];
      return next;
    });
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      if (parentId) {
        next.add(parentId);
      }
      return next;
    });
  };

  const handleTaskDragStart = (taskId: string): void => {
    setDraggedTaskId(taskId);
  };

  const handleTaskDragEnd = (): void => {
    setDraggedTaskId(null);
    setDropTargetGroupId("");
  };

  const handleGroupDragOver = (event: DragEvent<HTMLDivElement>, groupId: string): void => {
    event.preventDefault();
    if (!draggedTaskId) {
      return;
    }
    setDropTargetGroupId(groupId);
  };

  const handleGroupDragLeave = (groupId: string): void => {
    if (dropTargetGroupId === groupId) {
      setDropTargetGroupId("");
    }
  };

  const handleTaskDropToGroup = async (targetGroupId: string): Promise<void> => {
    if (!draggedTaskId) {
      return;
    }
    const task = includedTaskRowById.get(draggedTaskId);
    if (!task) {
      setDraggedTaskId(null);
      setDropTargetGroupId("");
      return;
    }

    const currentGroupId = task.groupId ?? "";
    if (currentGroupId === targetGroupId) {
      setDraggedTaskId(null);
      setDropTargetGroupId("");
      return;
    }

    await updateTaskGroup(draggedTaskId, targetGroupId);
    setDraggedTaskId(null);
    setDropTargetGroupId("");
    setGradebookNotice("Tarea movida.");
  };

  const renderCreateGroupInline = (parentId: string) => {
    if (!(parentId in newGroupDraftByParent)) {
      return null;
    }
    const draft = newGroupDraftByParent[parentId] ?? "";
    return (
      <li key={`draft-${parentId || "root"}`} className="gradebook-tree-item">
        <div className="gradebook-tree-row create">
          <input
            className="input"
            value={draft}
            onChange={(event) => updateSubgroupDraft(parentId, event.target.value)}
            placeholder={parentId ? "Nombre de subcarpeta" : "Nombre de carpeta"}
          />
          <button
            className="icon-btn"
            type="button"
            onClick={() => void submitCreateSubgroup(parentId)}
            title="Guardar carpeta"
            aria-label="Guardar carpeta"
          >
            <IconCheck />
          </button>
          <button
            className="icon-btn"
            type="button"
            onClick={() => cancelCreateSubgroup(parentId)}
            title="Cancelar"
            aria-label="Cancelar"
          >
            <IconClose />
          </button>
        </div>
      </li>
    );
  };

  const renderTaskNode = (task: IncludedTaskRow) => {
    const taskContribution = contributionData.taskContributionById.get(task.taskId) ?? 0;
    return (
      <li key={`task-${task.taskId}`} className="gradebook-tree-item">
        <div
          className={`gradebook-tree-row task ${draggedTaskId === task.taskId ? "dragging" : ""}`}
          draggable
          onDragStart={() => handleTaskDragStart(task.taskId)}
          onDragEnd={handleTaskDragEnd}
        >
          <span className="gradebook-tree-node-main">
            <span className="gradebook-tree-node-name">{task.title}</span>
            <span className="gradebook-tree-node-meta">
              {task.subjectName} | {task.unitName} | {task.sessionsCount} sesiones
            </span>
          </span>
          <input
            className="input grade-input"
            type="number"
            min={0}
            step={0.1}
            defaultValue={task.weight.toString()}
            onChange={() => {
              setPendingTaskWeightKeys((current) => {
                const next = new Set(current);
                next.add(task.taskId);
                return next;
              });
            }}
            onBlur={(event) => void saveTaskWeightAndClearPending(task.taskId, event.target.value)}
          />
          <span className="pill">{task.instrument}</span>
          <span className="pill">Aporta {formatContribution(taskContribution)}</span>
          <span className="gradebook-tree-actions">
            <span className="gradebook-tree-node-icon" aria-hidden="true" title="Tarea">
              <IconTask />
            </span>
          </span>
        </div>
      </li>
    );
  };

  const renderGroupNode = (groupId: string) => {
    const group = gradebookGroupById.get(groupId);
    if (!group) {
      return null;
    }
    const childGroupIds = orderedGroupIdsByParent.get(groupId) ?? [];
    const tasks = tasksByGroupId.get(groupId) ?? [];
    const isExpanded = expandedGroupIds.has(groupId);
    const isDropTarget = dropTargetGroupId === groupId;
    const hasChildren = childGroupIds.length > 0 || tasks.length > 0 || groupId in newGroupDraftByParent;
    const groupWeight = Number(group.weight ?? 0);
    const groupLeafContribution = contributionData.groupLeafContributionById.get(groupId) ?? 0;
    const groupLeafItems = contributionData.groupLeafItemCountById.get(groupId) ?? 0;
    const isEmptyGroup = groupLeafItems === 0;

    return (
      <li key={`group-${groupId}`} className="gradebook-tree-item">
        <div
          className={`gradebook-tree-row group ${isDropTarget ? "drop-target" : ""}`}
          onDragOver={(event) => handleGroupDragOver(event, groupId)}
          onDragLeave={() => handleGroupDragLeave(groupId)}
          onDrop={(event) => {
            event.preventDefault();
            void handleTaskDropToGroup(groupId);
          }}
        >
          <span className="gradebook-tree-node-main">
            <span className="gradebook-tree-node-name">{group.name}</span>
            <span className="gradebook-tree-node-meta">
              {childGroupIds.length} subcarpetas | {tasks.length} tareas
            </span>
          </span>
          <input
            className="input grade-input"
            type="number"
            min={0}
            step={0.1}
            defaultValue={groupWeight.toString()}
            onChange={() => {
              setPendingGroupWeightKeys((current) => {
                const next = new Set(current);
                next.add(groupId);
                return next;
              });
            }}
            onBlur={(event) => void saveGroupWeightAndClearPending(groupId, event.target.value)}
            title="Ponderacion de carpeta"
            aria-label="Ponderacion de carpeta"
          />
          {isEmptyGroup ? (
            <span className="aporte-empty-dot" title="Carpeta vacia: no aporta" aria-label="Carpeta vacia: no aporta" />
          ) : null}
          <span className="pill">Aporta {formatContribution(groupLeafContribution)}</span>
            <span className="gradebook-tree-actions">
              <span className="gradebook-tree-node-icon" aria-hidden="true" title="Carpeta">
                <IconFolder />
              </span>
            <button
              type="button"
              className="gradebook-tree-toggle"
              onClick={() => toggleGroupExpanded(groupId)}
              aria-label={isExpanded ? "Contraer carpeta" : "Expandir carpeta"}
              title={isExpanded ? "Contraer carpeta" : "Expandir carpeta"}
              disabled={!hasChildren}
            >
              {isExpanded ? <IconChevronDown /> : <IconChevronRight />}
            </button>
            <button
              className="icon-btn"
              type="button"
              onClick={() => beginCreateSubgroup(groupId)}
              title="Nueva subcarpeta"
              aria-label="Nueva subcarpeta"
            >
              <IconFolderPlus />
            </button>
            <button
              type="button"
              className="icon-btn danger"
              onClick={() => void deleteGradebookGroup(groupId)}
              title="Eliminar carpeta"
              aria-label="Eliminar carpeta"
            >
              <IconTrash />
            </button>
          </span>
        </div>

        {isExpanded ? (
          <ul className="gradebook-tree-list nested">
            {renderCreateGroupInline(groupId)}
            {childGroupIds.map((childId) => renderGroupNode(childId))}
            {tasks.map((task) => renderTaskNode(task))}
          </ul>
        ) : null}
      </li>
    );
  };

  const groupDraftDirty = Object.values(newGroupDraftByParent).some((value) => value.trim().length > 0);
  const hasUnsavedChanges =
    pendingTaskWeightKeys.size > 0 ||
    pendingGroupWeightKeys.size > 0 ||
    groupDraftDirty;

  useUnsavedChangesGuard(hasUnsavedChanges);

  return (
    <section className="module-card">
      <h2>Cuaderno de calificaciones</h2>

      <section className="detail-section" style={{ marginTop: 10 }}>
        <h5>Arbol de carpetas y tareas del cuaderno</h5>
        <p className="hint">
          Arrastra una tarea sobre una carpeta para moverla. Tambien puedes crear carpetas y subcarpetas directamente
          en el arbol.
        </p>
        {gradebookNotice ? <p className="hint">{gradebookNotice}</p> : null}
        <div className="gradebook-tree">
          <div
            className={`gradebook-tree-row group root ${dropTargetGroupId === "" ? "drop-target" : ""}`}
            onDragOver={(event) => handleGroupDragOver(event, "")}
            onDragLeave={() => handleGroupDragLeave("")}
            onDrop={(event) => {
              event.preventDefault();
              void handleTaskDropToGroup("");
            }}
          >
            <span className="gradebook-tree-node-main">
              <span className="gradebook-tree-node-name">Cuaderno</span>
              <span className="gradebook-tree-node-meta">
                {(orderedGroupIdsByParent.get("") ?? []).length} carpetas raiz
              </span>
            </span>
            <span className="gradebook-tree-actions">
              <span className="gradebook-tree-node-icon" aria-hidden="true" title="Cuaderno">
                <IconFolder />
              </span>
              <button
                className="icon-btn"
                type="button"
                onClick={() => beginCreateSubgroup("")}
                title="Nueva carpeta en Cuaderno"
                aria-label="Nueva carpeta en Cuaderno"
              >
                <IconFolderPlus />
              </button>
            </span>
          </div>

          <ul className="gradebook-tree-list root">
            {renderCreateGroupInline("")}
            {(orderedGroupIdsByParent.get("") ?? []).map((groupId) => renderGroupNode(groupId))}
            {(tasksByGroupId.get("") ?? []).map((task) => renderTaskNode(task))}
          </ul>

          {filteredIncludedTasks.length === 0 ? (
            <p className="hint">No hay tareas marcadas para incluir en el cuaderno.</p>
          ) : null}
        </div>
      </section>

      <section className="detail-section" style={{ marginTop: 10 }}>
        <h5>Notas parciales por carpeta</h5>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Alumno</th>
                {orderedGroupRows.map((group) => (
                  <th key={group.id}>
                    {group.pathLabel}
                    <br />
                    <small>
                      Aporta {formatContribution(contributionData.groupLeafContributionById.get(group.id) ?? 0)}
                    </small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={`partial-${student.id}`}>
                  <td>{getStudentFullName(student)}</td>
                  {orderedGroupRows.map((group) => {
                    const value = partialByStudentGroup.get(studentGroupKey(student.id, group.id));
                    return (
                      <td key={`${student.id}:${group.id}`}>
                        <span className="pill">{typeof value === "number" ? value.toFixed(2) : "-"}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {students.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(2, orderedGroupRows.length + 1)}>No hay alumnos en esta clase.</td>
                </tr>
              ) : null}
              {students.length > 0 && orderedGroupRows.length === 0 ? (
                <tr>
                  <td colSpan={2}>Crea carpetas para ver las notas parciales y subcarpetas.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
