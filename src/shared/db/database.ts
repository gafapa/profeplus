import Dexie, { type Table } from "dexie";
import type {
  Assessment,
  AttendanceEntry,
  ChecklistTemplate,
  ClassGroup,
  GradeEntry,
  LessonPlan,
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
  }
}

export const db = new ProfePlusDB();
