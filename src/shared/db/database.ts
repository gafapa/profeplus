import Dexie, { type Table } from "dexie";
import type {
  Assessment,
  AppPreferences,
  AttendanceEntry,
  ChecklistTemplate,
  ClassGroup,
  GradebookGroup,
  GradeEntry,
  LessonPlan,
  Task,
  TaskChecklistAssessment,
  TaskDailyEvaluationSetting,
  TaskRubricAssessment,
  TaskSession,
  TaskStudentComment,
  TaskSubjectLink,
  TaskGradebookConfig,
  RubricTemplate,
  ScheduleDay,
  ScheduleSettings,
  UnitBlock,
  SubjectCourseLink,
  SubjectStudentLink,
  Subject,
  Student
} from "./types";

class ProfePlusDB extends Dexie {
  subjects!: Table<Subject, string>;
  classGroups!: Table<ClassGroup, string>;
  students!: Table<Student, string>;
  assessments!: Table<Assessment, string>;
  gradebookGroups!: Table<GradebookGroup, string>;
  gradeEntries!: Table<GradeEntry, string>;
  attendanceEntries!: Table<AttendanceEntry, string>;
  lessonPlans!: Table<LessonPlan, string>;
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
  appPreferences!: Table<AppPreferences, string>;

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
  }
}

export const db = new ProfePlusDB();
