import Dexie, { type Table } from "dexie";
import type {
  Assessment,
  AttendanceEntry,
  ChecklistTemplate,
  ClassGroup,
  GradeEntry,
  LessonPlan,
  Task,
  TaskChecklistAssessment,
  TaskDailyEvaluationSetting,
  TaskRubricAssessment,
  TaskSession,
  TaskStudentComment,
  RubricTemplate,
  ScheduleDay,
  ScheduleSettings,
  UnitBlock,
  SubjectCourseLink,
  SubjectStudentLink,
  SubjectStudentOverride,
  Subject,
  Student
} from "./types";

class ProfePlusDB extends Dexie {
  subjects!: Table<Subject, string>;
  classGroups!: Table<ClassGroup, string>;
  students!: Table<Student, string>;
  assessments!: Table<Assessment, string>;
  gradeEntries!: Table<GradeEntry, string>;
  attendanceEntries!: Table<AttendanceEntry, string>;
  lessonPlans!: Table<LessonPlan, string>;
  rubricTemplates!: Table<RubricTemplate, string>;
  checklistTemplates!: Table<ChecklistTemplate, string>;
  subjectCourseLinks!: Table<SubjectCourseLink, string>;
  subjectStudentLinks!: Table<SubjectStudentLink, string>;
  subjectStudentOverrides!: Table<SubjectStudentOverride, string>;
  scheduleDays!: Table<ScheduleDay, string>;
  scheduleSettings!: Table<ScheduleSettings, string>;
  unitBlocks!: Table<UnitBlock, string>;
  tasks!: Table<Task, string>;
  taskSessions!: Table<TaskSession, string>;
  taskStudentComments!: Table<TaskStudentComment, string>;
  taskDailyEvaluationSettings!: Table<TaskDailyEvaluationSetting, string>;
  taskRubricAssessments!: Table<TaskRubricAssessment, string>;
  taskChecklistAssessments!: Table<TaskChecklistAssessment, string>;

  constructor() {
    super("profeplus-db");
    this.version(1).stores({
      classGroups: "id,name,schoolYear",
      students: "id,classId,fullName",
      assessments: "id,classId,title,period",
      gradeEntries: "id,classId,assessmentId,studentId",
      attendanceEntries: "id,classId,studentId,date,status",
      lessonPlans: "id,classId,date,unit",
      rubricTemplates: "id,classId,name"
    });
    this.version(2).stores({
      classGroups: "id,name,schoolYear",
      students: "id,classId,fullName",
      assessments: "id,classId,title,period",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries: "id,classId,studentId,date,status,[classId+date]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      rubricTemplates: "id,classId,name"
    });
    this.version(3).stores({
      courses: "id,name,schoolYear",
      subjects: "id,name",
      classGroups: "id,name,schoolYear,courseId,subjectId",
      students: "id,classId,fullName",
      assessments: "id,classId,title,period",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries: "id,classId,studentId,date,status,[classId+date]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      rubricTemplates: "id,classId,name"
    });
    this.version(4).stores({
      courses: "id,name,schoolYear",
      subjects: "id,name",
      classGroups: "id,name,schoolYear,courseId,subjectId",
      students: "id,classId,fullName",
      assessments: "id,classId,title,period",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries: "id,classId,studentId,date,status,[classId+date]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      rubricTemplates: "id,classId,name",
      subjectCourseLinks: "id,subjectId,classId,[subjectId+classId]",
      subjectStudentOverrides: "id,subjectId,studentId,[subjectId+studentId]"
    });
    this.version(5).stores({
      courses: "id,name,schoolYear",
      subjects: "id,name",
      classGroups: "id,name,schoolYear,courseId,subjectId",
      students: "id,classId,fullName",
      assessments: "id,classId,title,period",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries: "id,classId,studentId,date,status,[classId+date]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      rubricTemplates: "id,classId,name",
      subjectCourseLinks: "id,subjectId,classId,[subjectId+classId]",
      subjectStudentLinks: "id,subjectId,studentId,[subjectId+studentId]",
      subjectStudentOverrides: "id,subjectId,studentId,[subjectId+studentId]"
    });
    this.version(6).stores({
      courses: "id,name,schoolYear",
      subjects: "id,name",
      classGroups: "id,name,schoolYear,courseId,subjectId",
      students: "id,classId,fullName",
      assessments: "id,classId,title,period",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries: "id,classId,studentId,date,status,[classId+date]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      rubricTemplates: "id,classId,name",
      subjectCourseLinks: "id,subjectId,classId,[subjectId+classId]",
      subjectStudentLinks: "id,subjectId,studentId,[subjectId+studentId]",
      subjectStudentOverrides: "id,subjectId,studentId,[subjectId+studentId]",
      scheduleDays: "id,dayOfWeek,enabled"
    });
    this.version(7).stores({
      courses: "id,name,schoolYear",
      subjects: "id,name",
      classGroups: "id,name,schoolYear,courseId,subjectId",
      students: "id,classId,fullName",
      assessments: "id,classId,title,period",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries: "id,classId,studentId,date,status,[classId+date]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      rubricTemplates: "id,classId,name",
      subjectCourseLinks: "id,subjectId,classId,[subjectId+classId]",
      subjectStudentLinks: "id,subjectId,studentId,[subjectId+studentId]",
      subjectStudentOverrides: "id,subjectId,studentId,[subjectId+studentId]",
      scheduleDays: "id,dayOfWeek,enabled",
      scheduleSettings: "id"
    });
    this.version(8).stores({
      courses: "id,name,schoolYear",
      subjects: "id,name",
      classGroups: "id,name,schoolYear,courseId,subjectId",
      students: "id,classId,fullName",
      assessments: "id,classId,title,period",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries:
        "id,classId,studentId,date,status,scheduleSlotId,[classId+date],[classId+date+scheduleSlotId]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      rubricTemplates: "id,classId,name",
      subjectCourseLinks: "id,subjectId,classId,[subjectId+classId]",
      subjectStudentLinks: "id,subjectId,studentId,[subjectId+studentId]",
      subjectStudentOverrides: "id,subjectId,studentId,[subjectId+studentId]",
      scheduleDays: "id,dayOfWeek,enabled",
      scheduleSettings: "id"
    });
    this.version(9).stores({
      courses: "id,name,schoolYear",
      subjects: "id,name",
      unitBlocks: "id,subjectId,position,name,[subjectId+position]",
      classGroups: "id,name,schoolYear,courseId,subjectId",
      students: "id,classId,fullName",
      assessments: "id,classId,title,period",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries:
        "id,classId,studentId,date,status,scheduleSlotId,[classId+date],[classId+date+scheduleSlotId]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      rubricTemplates: "id,classId,name",
      subjectCourseLinks: "id,subjectId,classId,[subjectId+classId]",
      subjectStudentLinks: "id,subjectId,studentId,[subjectId+studentId]",
      subjectStudentOverrides: "id,subjectId,studentId,[subjectId+studentId]",
      scheduleDays: "id,dayOfWeek,enabled",
      scheduleSettings: "id"
    });
    this.version(10).stores({
      courses: "id,name,schoolYear",
      subjects: "id,name",
      unitBlocks: "id,subjectId,position,name,[subjectId+position]",
      classGroups: "id,name,schoolYear,courseId,subjectId",
      students: "id,classId,fullName",
      assessments: "id,classId,title,period",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries:
        "id,classId,studentId,date,status,scheduleSlotId,[classId+date],[classId+date+scheduleSlotId]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      rubricTemplates: "id,classId,name",
      checklistTemplates: "id,classId,name",
      subjectCourseLinks: "id,subjectId,classId,[subjectId+classId]",
      subjectStudentLinks: "id,subjectId,studentId,[subjectId+studentId]",
      subjectStudentOverrides: "id,subjectId,studentId,[subjectId+studentId]",
      scheduleDays: "id,dayOfWeek,enabled",
      scheduleSettings: "id"
    });
    this.version(11).stores({
      courses: "id,name,schoolYear",
      subjects: "id,name",
      unitBlocks: "id,subjectId,position,name,[subjectId+position]",
      classGroups: "id,name,schoolYear,courseId,subjectId",
      students: "id,classId,fullName",
      assessments: "id,classId,title,period",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries:
        "id,classId,studentId,date,status,scheduleSlotId,[classId+date],[classId+date+scheduleSlotId]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      tasks: "id,subjectId,unitId,sendToGradebook",
      taskSessions:
        "id,taskId,subjectId,date,scheduleSlotId,[taskId+date],[subjectId+date],[subjectId+date+scheduleSlotId]",
      taskStudentComments: "id,taskId,studentId,[taskId+studentId]",
      rubricTemplates: "id,classId,name",
      checklistTemplates: "id,classId,name",
      subjectCourseLinks: "id,subjectId,classId,[subjectId+classId]",
      subjectStudentLinks: "id,subjectId,studentId,[subjectId+studentId]",
      subjectStudentOverrides: "id,subjectId,studentId,[subjectId+studentId]",
      scheduleDays: "id,dayOfWeek,enabled",
      scheduleSettings: "id"
    });
    this.version(12).stores({
      courses: "id,name,schoolYear",
      subjects: "id,name",
      unitBlocks: "id,subjectId,position,name,[subjectId+position]",
      classGroups: "id,name,schoolYear,courseId,subjectId",
      students: "id,classId,fullName",
      assessments: "id,classId,title,period",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries:
        "id,classId,studentId,date,status,scheduleSlotId,[classId+date],[classId+date+scheduleSlotId]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      tasks: "id,subjectId,unitId,sendToGradebook",
      taskSessions:
        "id,taskId,subjectId,date,scheduleSlotId,[taskId+date],[subjectId+date],[subjectId+date+scheduleSlotId]",
      taskStudentComments: "id,taskId,studentId,[taskId+studentId]",
      taskDailyEvaluationSettings: "id,taskId,date,[taskId+date]",
      taskRubricAssessments:
        "id,taskId,date,studentId,rubricTemplateId,criterionId,levelId,[taskId+date],[taskId+date+studentId],[taskId+date+studentId+criterionId]",
      taskChecklistAssessments:
        "id,taskId,date,studentId,checklistTemplateId,itemId,checked,[taskId+date],[taskId+date+studentId],[taskId+date+studentId+itemId]",
      rubricTemplates: "id,classId,name",
      checklistTemplates: "id,classId,name",
      subjectCourseLinks: "id,subjectId,classId,[subjectId+classId]",
      subjectStudentLinks: "id,subjectId,studentId,[subjectId+studentId]",
      subjectStudentOverrides: "id,subjectId,studentId,[subjectId+studentId]",
      scheduleDays: "id,dayOfWeek,enabled",
      scheduleSettings: "id"
    });
    this.version(13).stores({
      courses: "id,name,schoolYear",
      subjects: "id,name",
      unitBlocks: "id,subjectId,position,name,[subjectId+position]",
      classGroups: "id,name,schoolYear,courseId,subjectId",
      students: "id,classId,fullName",
      assessments: "id,classId,title,period",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries:
        "id,classId,studentId,date,status,scheduleSlotId,[classId+date],[classId+date+scheduleSlotId]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      tasks: "id,subjectId,unitId,sendToGradebook,rubricTemplateId,checklistTemplateId",
      taskSessions:
        "id,taskId,subjectId,date,scheduleSlotId,[taskId+date],[subjectId+date],[subjectId+date+scheduleSlotId]",
      taskStudentComments:
        "id,taskId,date,scheduleSlotId,studentId,[taskId+studentId],[taskId+date+scheduleSlotId],[taskId+date+scheduleSlotId+studentId]",
      taskDailyEvaluationSettings:
        "id,taskId,date,scheduleSlotId,[taskId+date],[taskId+date+scheduleSlotId]",
      taskRubricAssessments:
        "id,taskId,date,scheduleSlotId,studentId,rubricTemplateId,criterionId,levelId,[taskId+date],[taskId+date+scheduleSlotId],[taskId+date+studentId],[taskId+date+scheduleSlotId+studentId],[taskId+date+scheduleSlotId+studentId+criterionId]",
      taskChecklistAssessments:
        "id,taskId,date,scheduleSlotId,studentId,checklistTemplateId,itemId,checked,[taskId+date],[taskId+date+scheduleSlotId],[taskId+date+studentId],[taskId+date+scheduleSlotId+studentId],[taskId+date+scheduleSlotId+studentId+itemId]",
      rubricTemplates: "id,classId,name",
      checklistTemplates: "id,classId,name",
      subjectCourseLinks: "id,subjectId,classId,[subjectId+classId]",
      subjectStudentLinks: "id,subjectId,studentId,[subjectId+studentId]",
      subjectStudentOverrides: "id,subjectId,studentId,[subjectId+studentId]",
      scheduleDays: "id,dayOfWeek,enabled",
      scheduleSettings: "id"
    });
    this.version(14).stores({
      courses: "id,name,schoolYear",
      subjects: "id,name",
      unitBlocks: "id,subjectId,position,name,[subjectId+position]",
      classGroups: "id,name,schoolYear,courseId,subjectId",
      students: "id,classId,fullName",
      assessments: "id,classId,title,period",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries:
        "id,classId,studentId,date,status,scheduleSlotId,[classId+date],[classId+date+scheduleSlotId]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      tasks:
        "id,subjectId,unitId,sendToGradebook,gradebookWeight,rubricTemplateId,checklistTemplateId",
      taskSessions:
        "id,taskId,subjectId,date,scheduleSlotId,[taskId+date],[subjectId+date],[subjectId+date+scheduleSlotId]",
      taskStudentComments:
        "id,taskId,date,scheduleSlotId,studentId,[taskId+studentId],[taskId+date+scheduleSlotId],[taskId+date+scheduleSlotId+studentId]",
      taskDailyEvaluationSettings:
        "id,taskId,date,scheduleSlotId,[taskId+date],[taskId+date+scheduleSlotId]",
      taskRubricAssessments:
        "id,taskId,date,scheduleSlotId,studentId,rubricTemplateId,criterionId,levelId,[taskId+date],[taskId+date+scheduleSlotId],[taskId+date+studentId],[taskId+date+scheduleSlotId+studentId],[taskId+date+scheduleSlotId+studentId+criterionId]",
      taskChecklistAssessments:
        "id,taskId,date,scheduleSlotId,studentId,checklistTemplateId,itemId,checked,[taskId+date],[taskId+date+scheduleSlotId],[taskId+date+studentId],[taskId+date+scheduleSlotId+studentId],[taskId+date+scheduleSlotId+studentId+itemId]",
      rubricTemplates: "id,classId,taskId,name,[classId+taskId]",
      checklistTemplates: "id,classId,taskId,name,[classId+taskId]",
      subjectCourseLinks: "id,subjectId,classId,[subjectId+classId]",
      subjectStudentLinks: "id,subjectId,studentId,[subjectId+studentId]",
      subjectStudentOverrides: "id,subjectId,studentId,[subjectId+studentId]",
      scheduleDays: "id,dayOfWeek,enabled",
      scheduleSettings: "id"
    });
  }
}

export const db = new ProfePlusDB();
