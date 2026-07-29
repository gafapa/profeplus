import type {
  Assessment,
  ChecklistTemplate,
  GradebookGroup,
  RubricTemplate,
  Student,
  TaskChecklistAssessment,
  TaskDailyEvaluationSetting,
  TaskDirectGrade,
  TaskGradebookConfig,
  TaskRubricAssessment
} from "../db/types";

export type GradebookContributionTask = {
  taskId: string;
  subjectId: string;
  gradebookWeight: number;
  groupId?: string;
};

export type GradebookContributionData = {
  assessmentContributionById: Map<string, number>;
  taskContributionByKey: Map<string, number>;
  groupNodeContributionById: Map<string, number>;
  groupLeafContributionById: Map<string, number>;
  groupLeafItemCountById: Map<string, number>;
  totalDistributedShare: number;
};

type GradebookScoreTask = Pick<
  TaskGradebookConfig,
  "taskId" | "subjectId" | "classId" | "rubricTemplateId" | "checklistTemplateId" | "directGradeEnabled"
>;

type ScopedTaskRow = {
  classId: string;
  subjectId: string;
};

export function taskSubjectKey(taskId: string, subjectId: string): string {
  return `${taskId}:${subjectId}`;
}

export function taskStudentKey(taskId: string, subjectId: string, studentId: string): string {
  return `${taskId}:${subjectId}:${studentId}`;
}

export function gradeCellKey(studentId: string, assessmentId: string): string {
  return `${studentId}:${assessmentId}`;
}

export function matchesTaskScope(row: ScopedTaskRow, classId: string, subjectId?: string): boolean {
  return row.classId === classId && (!subjectId || row.subjectId === subjectId);
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

export function calculateGradebookContributions(
  assessments: Assessment[],
  tasks: GradebookContributionTask[],
  groups: GradebookGroup[]
): GradebookContributionData {
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

  const tasksByParent = new Map<string, GradebookContributionTask[]>();
  for (const task of tasks) {
    const parentId = task.groupId && validGroupIds.has(task.groupId) ? task.groupId : "";
    if (!tasksByParent.has(parentId)) {
      tasksByParent.set(parentId, []);
    }
    tasksByParent.get(parentId)?.push(task);
  }

  const assessmentContributionById = new Map<string, number>();
  const taskContributionByKey = new Map<string, number>();
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

  for (const group of groups) {
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
        taskContributionByKey.set(taskSubjectKey(task.taskId, task.subjectId), 0);
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
        taskContributionByKey.set(taskSubjectKey(task.taskId, task.subjectId), equalContribution);
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
      const contribution = parentShare * (Math.max(0, Number(assessment.weight ?? 0)) / totalWeight);
      assessmentContributionById.set(assessment.id, contribution);
      leafShare += contribution;
    }
    for (const task of directTasks) {
      const contribution = parentShare * (Math.max(0, Number(task.gradebookWeight ?? 0)) / totalWeight);
      taskContributionByKey.set(taskSubjectKey(task.taskId, task.subjectId), contribution);
      leafShare += contribution;
    }
    for (const groupId of distributableGroupIds) {
      const contribution = parentShare * (Math.max(0, Number(gradebookGroupById.get(groupId)?.weight ?? 0)) / totalWeight);
      groupNodeContributionById.set(groupId, contribution);
      const nextBranch = new Set(branch);
      nextBranch.add(groupId);
      const childrenLeafShare = visit(groupId, contribution, nextBranch);
      groupLeafContributionById.set(groupId, childrenLeafShare);
      leafShare += childrenLeafShare;
    }
    return leafShare;
  };

  const totalDistributedShare = visit("", 1, new Set<string>());

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
  for (const group of groups) {
    if (!groupNodeContributionById.has(group.id)) {
      groupNodeContributionById.set(group.id, 0);
    }
    if (!groupLeafContributionById.has(group.id)) {
      groupLeafContributionById.set(group.id, 0);
    }
  }

  return {
    assessmentContributionById,
    taskContributionByKey,
    groupNodeContributionById,
    groupLeafContributionById,
    groupLeafItemCountById,
    totalDistributedShare
  };
}

export function calculateTaskScoresByStudent(input: {
  tasks: GradebookScoreTask[];
  students: Student[];
  selectedClassId: string;
  rubricTemplates: RubricTemplate[];
  checklistTemplates: ChecklistTemplate[];
  taskDailyEvaluationSettings: TaskDailyEvaluationSetting[];
  taskRubricAssessments: TaskRubricAssessment[];
  taskChecklistAssessments: TaskChecklistAssessment[];
  taskDirectGrades: TaskDirectGrade[];
}): Map<string, number> {
  const scoreMap = new Map<string, number>();
  const rubricTemplateById = new Map<string, RubricTemplate>(input.rubricTemplates.map((item) => [item.id, item]));
  const checklistTemplateById = new Map<string, ChecklistTemplate>(
    input.checklistTemplates.map((item) => [item.id, item])
  );

  for (const task of input.tasks) {
    const settings = input.taskDailyEvaluationSettings.filter((setting) => {
      return setting.taskId === task.taskId && matchesTaskScope(setting, input.selectedClassId, task.subjectId);
    });

    for (const student of input.students) {
      if (task.directGradeEnabled) {
        const directGrade = input.taskDirectGrades.find(
          (grade) =>
            grade.taskId === task.taskId &&
            grade.subjectId === task.subjectId &&
            grade.classId === input.selectedClassId &&
            grade.studentId === student.id
        );
        if (typeof directGrade?.score === "number") {
          scoreMap.set(
            taskStudentKey(task.taskId, task.subjectId, student.id),
            Number(Math.max(0, Math.min(10, directGrade.score)).toFixed(2))
          );
        }
        continue;
      }

      const sessionScores: number[] = [];
      for (const setting of settings) {
        const sessionSlotId = setting.scheduleSlotId;
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
          const rows = input.taskRubricAssessments.filter(
            (row) =>
              row.taskId === task.taskId &&
              row.studentId === student.id &&
              row.date === setting.date &&
              row.scheduleSlotId === sessionSlotId &&
              row.rubricTemplateId === rubricId &&
              matchesTaskScope(row, input.selectedClassId, task.subjectId)
          );
          if (rows.length === 0) {
            continue;
          }
          const scoreByCriterionId = new Map<string, number>();
          const validCriterionIds = new Set((template.criteria ?? []).map((criterion) => criterion.id));
          for (const row of rows) {
            if (validCriterionIds.has(row.criterionId) && !scoreByCriterionId.has(row.criterionId)) {
              scoreByCriterionId.set(row.criterionId, Number(row.score) || 0);
            }
          }
          const score = Array.from(scoreByCriterionId.values()).reduce((sum, value) => sum + value, 0);
          sessionScores.push(Math.max(0, Math.min(10, (score / maxScore) * 10)));
          continue;
        }

        if (checklistId) {
          const template = checklistTemplateById.get(checklistId);
          const totalItems = template?.items?.length ?? 0;
          if (totalItems <= 0) {
            continue;
          }
          const activeItemIds = new Set((template?.items ?? []).map((item) => item.id));
          const checkedItemIds = new Set(
            input.taskChecklistAssessments
              .filter(
                (row) =>
                  row.taskId === task.taskId &&
                  row.studentId === student.id &&
                  row.date === setting.date &&
                  row.scheduleSlotId === sessionSlotId &&
                  row.checklistTemplateId === checklistId &&
                  row.checked &&
                  activeItemIds.has(row.itemId) &&
                  matchesTaskScope(row, input.selectedClassId, task.subjectId)
              )
              .map((row) => row.itemId)
          );
          const checkedCount = checkedItemIds.size;
          sessionScores.push(Math.max(0, Math.min(10, (checkedCount / totalItems) * 10)));
        }
      }

      if (sessionScores.length > 0) {
        const averageScore = sessionScores.reduce((sum, value) => sum + value, 0) / sessionScores.length;
        scoreMap.set(taskStudentKey(task.taskId, task.subjectId, student.id), Number(averageScore.toFixed(2)));
      }
    }
  }

  return scoreMap;
}
