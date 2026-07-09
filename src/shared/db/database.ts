import Dexie, { type Table } from "dexie";
import type {
  Assessment,
  AppPreferences,
  AttendanceEntry,
  ChecklistTemplate,
  ClassGroup,
  GradebookGroup,
  GradeEntry,
  Task,
  TaskChecklistAssessment,
  TaskDailyEvaluationSetting,
  TaskRubricAssessment,
  TaskSession,
  TaskStudentComment,
  TaskSubjectLink,
  TaskGradebookConfig,
  TaskDirectGrade,
  RubricTemplate,
  ScheduleDay,
  ScheduleSettings,
  UnitBlock,
  SubjectCourseLink,
  SubjectStudentLink,
  Subject,
  Student,
  StudentFollowUp
} from "./types";

class ProfePlusDB extends Dexie {
  subjects!: Table<Subject, string>;
  classGroups!: Table<ClassGroup, string>;
  students!: Table<Student, string>;
  assessments!: Table<Assessment, string>;
  gradebookGroups!: Table<GradebookGroup, string>;
  gradeEntries!: Table<GradeEntry, string>;
  attendanceEntries!: Table<AttendanceEntry, string>;
  rubricTemplates!: Table<RubricTemplate, string>;
  checklistTemplates!: Table<ChecklistTemplate, string>;
  subjectCourseLinks!: Table<SubjectCourseLink, string>;
  subjectStudentLinks!: Table<SubjectStudentLink, string>;
  scheduleDays!: Table<ScheduleDay, string>;
  scheduleSettings!: Table<ScheduleSettings, string>;
  unitBlocks!: Table<UnitBlock, string>;
  tasks!: Table<Task, string>;
  taskSubjectLinks!: Table<TaskSubjectLink, string>;
  taskGradebookConfigs!: Table<TaskGradebookConfig, string>;
  taskSessions!: Table<TaskSession, string>;
  taskStudentComments!: Table<TaskStudentComment, string>;
  taskDailyEvaluationSettings!: Table<TaskDailyEvaluationSetting, string>;
  taskRubricAssessments!: Table<TaskRubricAssessment, string>;
  taskChecklistAssessments!: Table<TaskChecklistAssessment, string>;
  taskDirectGrades!: Table<TaskDirectGrade, string>;
  appPreferences!: Table<AppPreferences, string>;
  studentFollowUps!: Table<StudentFollowUp, string>;

  constructor() {
    super("profeplus-db-v6");
    this.version(2).stores({
      subjects: "id,name",
      classGroups: "id,name,schoolYear",
      students: "id,classId,fullName",
      assessments:
        "id,classId,subjectId,title,period,groupId,[classId+groupId],[classId+subjectId]",
      gradebookGroups:
        "id,classId,subjectId,parentId,position,[classId+parentId],[classId+subjectId],[classId+subjectId+parentId]",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries:
        "id,classId,studentId,date,status,scheduleSlotId,[classId+date],[classId+date+scheduleSlotId]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      unitBlocks: "id,subjectId,position,name,[subjectId+position]",
      tasks: "id,sendToGradebook",
      taskSubjectLinks: "id,taskId,subjectId,unitId,[taskId+subjectId],[subjectId+taskId]",
      taskGradebookConfigs:
        "id,taskId,subjectId,classId,gradebookWeight,groupId,rubricTemplateId,checklistTemplateId,[classId+subjectId],[taskId+subjectId+classId],[taskId+classId]",
      taskSessions:
        "id,taskId,subjectId,classId,date,scheduleSlotId,[taskId+date],[subjectId+date],[subjectId+classId],[taskId+classId],[subjectId+date+scheduleSlotId]",
      taskStudentComments:
        "id,taskId,date,scheduleSlotId,studentId,[taskId+studentId],[taskId+date+scheduleSlotId],[taskId+date+scheduleSlotId+studentId]",
      taskDailyEvaluationSettings:
        "id,taskId,date,scheduleSlotId,rubricTemplateId,checklistTemplateId,[taskId+date],[taskId+date+scheduleSlotId]",
      taskRubricAssessments:
        "id,taskId,date,scheduleSlotId,studentId,rubricTemplateId,criterionId,levelId,[taskId+date],[taskId+date+scheduleSlotId],[taskId+date+studentId],[taskId+date+scheduleSlotId+studentId],[taskId+date+scheduleSlotId+studentId+criterionId]",
      taskChecklistAssessments:
        "id,taskId,date,scheduleSlotId,studentId,checklistTemplateId,itemId,checked,[taskId+date],[taskId+date+scheduleSlotId],[taskId+date+studentId],[taskId+date+scheduleSlotId+studentId],[taskId+date+scheduleSlotId+studentId+itemId]",
      rubricTemplates: "id,classId,taskId,name,[classId+taskId]",
      checklistTemplates: "id,classId,taskId,name,[classId+taskId]",
      subjectCourseLinks: "id,subjectId,classId,[subjectId+classId]",
      subjectStudentLinks: "id,subjectId,studentId,[subjectId+studentId]",
      scheduleDays: "id,dayOfWeek,enabled",
      scheduleSettings: "id",
      appPreferences: "id"
    });
    this.version(3).stores({
      subjects: "id,name",
      classGroups: "id,name,schoolYear",
      students: "id,classId,fullName",
      assessments:
        "id,classId,subjectId,title,period,groupId,[classId+groupId],[classId+subjectId]",
      gradebookGroups:
        "id,classId,subjectId,parentId,position,[classId+parentId],[classId+subjectId],[classId+subjectId+parentId]",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries:
        "id,classId,studentId,date,status,scheduleSlotId,[classId+date],[classId+date+scheduleSlotId]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      unitBlocks: "id,subjectId,position,name,[subjectId+position]",
      tasks: "id,sendToGradebook",
      taskSubjectLinks: "id,taskId,subjectId,unitId,[taskId+subjectId],[subjectId+taskId]",
      taskGradebookConfigs:
        "id,taskId,subjectId,classId,gradebookWeight,groupId,rubricTemplateId,checklistTemplateId,directGradeEnabled,[classId+subjectId],[taskId+subjectId+classId],[taskId+classId]",
      taskSessions:
        "id,taskId,subjectId,classId,date,scheduleSlotId,[taskId+date],[subjectId+date],[subjectId+classId],[taskId+classId],[subjectId+date+scheduleSlotId]",
      taskStudentComments:
        "id,taskId,date,scheduleSlotId,studentId,[taskId+studentId],[taskId+date+scheduleSlotId],[taskId+date+scheduleSlotId+studentId]",
      taskDailyEvaluationSettings:
        "id,taskId,date,scheduleSlotId,rubricTemplateId,checklistTemplateId,[taskId+date],[taskId+date+scheduleSlotId]",
      taskRubricAssessments:
        "id,taskId,date,scheduleSlotId,studentId,rubricTemplateId,criterionId,levelId,[taskId+date],[taskId+date+scheduleSlotId],[taskId+date+studentId],[taskId+date+scheduleSlotId+studentId],[taskId+date+scheduleSlotId+studentId+criterionId]",
      taskChecklistAssessments:
        "id,taskId,date,scheduleSlotId,studentId,checklistTemplateId,itemId,checked,[taskId+date],[taskId+date+scheduleSlotId],[taskId+date+studentId],[taskId+date+scheduleSlotId+studentId],[taskId+date+scheduleSlotId+studentId+itemId]",
      taskDirectGrades:
        "id,taskId,subjectId,classId,studentId,[taskId+studentId],[taskId+subjectId+classId],[classId+studentId]",
      rubricTemplates: "id,classId,taskId,name,[classId+taskId]",
      checklistTemplates: "id,classId,taskId,name,[classId+taskId]",
      subjectCourseLinks: "id,subjectId,classId,[subjectId+classId]",
      subjectStudentLinks: "id,subjectId,studentId,[subjectId+studentId]",
      scheduleDays: "id,dayOfWeek,enabled",
      scheduleSettings: "id",
      appPreferences: "id"
    });
    this.version(4).stores({
      lessonPlans: null
    });
    this.version(5)
      .stores({
        taskStudentComments:
          "id,taskId,subjectId,classId,date,scheduleSlotId,studentId,[taskId+studentId],[taskId+classId+subjectId],[taskId+classId+subjectId+date+scheduleSlotId],[taskId+classId+subjectId+date+scheduleSlotId+studentId]",
        taskDailyEvaluationSettings:
          "id,taskId,subjectId,classId,date,scheduleSlotId,rubricTemplateId,checklistTemplateId,[taskId+date],[taskId+date+scheduleSlotId],[taskId+classId+subjectId+date+scheduleSlotId]",
        taskRubricAssessments:
          "id,taskId,subjectId,classId,date,scheduleSlotId,studentId,rubricTemplateId,criterionId,levelId,[taskId+date],[taskId+date+scheduleSlotId],[taskId+date+studentId],[taskId+date+scheduleSlotId+studentId],[taskId+date+scheduleSlotId+studentId+criterionId],[taskId+classId+subjectId+date+scheduleSlotId]",
        taskChecklistAssessments:
          "id,taskId,subjectId,classId,date,scheduleSlotId,studentId,checklistTemplateId,itemId,checked,[taskId+date],[taskId+date+scheduleSlotId],[taskId+date+studentId],[taskId+date+scheduleSlotId+studentId],[taskId+date+scheduleSlotId+studentId+itemId],[taskId+classId+subjectId+date+scheduleSlotId]"
      })
      .upgrade(async (transaction) => {
        const sessions = (await transaction.table("taskSessions").toArray()) as TaskSession[];
        const students = (await transaction.table("students").toArray()) as Student[];
        const studentClassById = new Map(students.map((student) => [student.id, student.classId]));
        const sessionsByTaskDateSlot = new Map<string, TaskSession[]>();

        for (const session of sessions) {
          const key = `${session.taskId}:${session.date}:${session.scheduleSlotId ?? ""}`;
          const current = sessionsByTaskDateSlot.get(key) ?? [];
          current.push(session);
          sessionsByTaskDateSlot.set(key, current);
        }

        const sessionScope = (
          taskId: string,
          date?: string,
          scheduleSlotId?: string,
          preferredClassId?: string
        ): Pick<TaskSession, "classId" | "subjectId"> | null => {
          if (!date) {
            return null;
          }
          const rows = sessionsByTaskDateSlot.get(`${taskId}:${date}:${scheduleSlotId ?? ""}`) ?? [];
          const scopedRows = preferredClassId ? rows.filter((session) => session.classId === preferredClassId) : rows;
          return scopedRows.length === 1 ? scopedRows[0] : null;
        };

        const patchRows = async <T extends { id: string }>(
          tableName: string,
          patchRow: (row: T) => T
        ): Promise<void> => {
          const table = transaction.table(tableName);
          const rows = (await table.toArray()) as T[];
          await table.bulkPut(rows.map(patchRow));
        };

        await patchRows<TaskDailyEvaluationSetting>("taskDailyEvaluationSettings", (row) => {
          if (row.classId && row.subjectId) {
            return row;
          }
          const scope = sessionScope(row.taskId, row.date, row.scheduleSlotId, row.classId);
          return scope ? { ...row, classId: row.classId ?? scope.classId, subjectId: row.subjectId ?? scope.subjectId } : row;
        });

        await patchRows<TaskStudentComment>("taskStudentComments", (row) => {
          if (row.classId && row.subjectId) {
            return row;
          }
          const scope = sessionScope(row.taskId, row.date, row.scheduleSlotId, row.classId ?? studentClassById.get(row.studentId));
          return scope ? { ...row, classId: row.classId ?? scope.classId, subjectId: row.subjectId ?? scope.subjectId } : row;
        });

        await patchRows<TaskRubricAssessment>("taskRubricAssessments", (row) => {
          if (row.classId && row.subjectId) {
            return row;
          }
          const scope = sessionScope(row.taskId, row.date, row.scheduleSlotId, row.classId ?? studentClassById.get(row.studentId));
          return scope ? { ...row, classId: row.classId ?? scope.classId, subjectId: row.subjectId ?? scope.subjectId } : row;
        });

        await patchRows<TaskChecklistAssessment>("taskChecklistAssessments", (row) => {
          if (row.classId && row.subjectId) {
            return row;
          }
          const scope = sessionScope(row.taskId, row.date, row.scheduleSlotId, row.classId ?? studentClassById.get(row.studentId));
          return scope ? { ...row, classId: row.classId ?? scope.classId, subjectId: row.subjectId ?? scope.subjectId } : row;
        });
      });
    this.version(6).stores({});
    this.version(7).stores({
      studentFollowUps: "id,studentId,classId,date,kind,resolved,[studentId+date],[classId+date]"
    });
  }
}

export const db = new ProfePlusDB();
