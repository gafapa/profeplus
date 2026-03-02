import Dexie, { type Table } from "dexie";
import type {
  Assessment,
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
  gradebookGroups!: Table<GradebookGroup, string>;
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
    this.version(15).stores({
      courses: "id,name,schoolYear",
      subjects: "id,name",
      unitBlocks: "id,subjectId,position,name,[subjectId+position]",
      classGroups: "id,name,schoolYear,courseId,subjectId",
      students: "id,classId,fullName",
      assessments: "id,classId,title,period,groupId,[classId+groupId]",
      gradebookGroups: "id,classId,parentId,position,[classId+parentId]",
      gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
      attendanceEntries:
        "id,classId,studentId,date,status,scheduleSlotId,[classId+date],[classId+date+scheduleSlotId]",
      lessonPlans: "id,classId,date,unit,[classId+date]",
      tasks:
        "id,subjectId,unitId,sendToGradebook,gradebookWeight,groupId,rubricTemplateId,checklistTemplateId",
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
    this.version(16)
      .stores({
        courses: "id,name,schoolYear",
        subjects: "id,name",
        unitBlocks: "id,subjectId,position,name,[subjectId+position]",
        classGroups: "id,name,schoolYear,courseId,subjectId",
        students: "id,classId,fullName",
        assessments: "id,classId,subjectId,title,period,groupId,[classId+groupId],[classId+subjectId]",
        gradebookGroups:
          "id,classId,subjectId,parentId,position,[classId+parentId],[classId+subjectId],[classId+subjectId+parentId]",
        gradeEntries: "id,classId,assessmentId,studentId,[classId+studentId]",
        attendanceEntries:
          "id,classId,studentId,date,status,scheduleSlotId,[classId+date],[classId+date+scheduleSlotId]",
        lessonPlans: "id,classId,date,unit,[classId+date]",
        tasks:
          "id,subjectId,unitId,sendToGradebook,gradebookWeight,groupId,rubricTemplateId,checklistTemplateId",
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
      })
      .upgrade(async (trans) => {
        const groupsTable = trans.table("gradebookGroups");
        const tasksTable = trans.table("tasks");
        const assessmentsTable = trans.table("assessments");
        const subjectCourseLinksTable = trans.table("subjectCourseLinks");

        const [allGroupsRaw, allTasksRaw, allAssessmentsRaw, allLinksRaw] = await Promise.all([
          groupsTable.toArray(),
          tasksTable.toArray(),
          assessmentsTable.toArray(),
          subjectCourseLinksTable.toArray()
        ]);

        const allGroups = (allGroupsRaw as GradebookGroup[]).filter((group) => !group.subjectId);
        if (allGroups.length === 0) {
          return;
        }

        const allTasks = allTasksRaw as Task[];
        const allAssessments = allAssessmentsRaw as Assessment[];
        const allLinks = allLinksRaw as SubjectCourseLink[];

        const legacyByClass = new Map<string, GradebookGroup[]>();
        for (const group of allGroups) {
          if (!legacyByClass.has(group.classId)) {
            legacyByClass.set(group.classId, []);
          }
          legacyByClass.get(group.classId)?.push(group);
        }

        const linkedSubjectsByClass = new Map<string, Set<string>>();
        for (const link of allLinks) {
          if (!linkedSubjectsByClass.has(link.classId)) {
            linkedSubjectsByClass.set(link.classId, new Set<string>());
          }
          linkedSubjectsByClass.get(link.classId)?.add(link.subjectId);
        }

        const nextGroupsToPut: GradebookGroup[] = [];
        const nextGroupsToAdd: GradebookGroup[] = [];
        const nextTasksById = new Map<string, Task>();
        const nextAssessmentsById = new Map<string, Assessment>();

        for (const [classId, classGroups] of legacyByClass.entries()) {
          if (classGroups.length === 0) {
            continue;
          }

          const classGroupIds = new Set(classGroups.map((group) => group.id));
          const subjectIds = new Set<string>();

          for (const task of allTasks) {
            if (task.groupId && classGroupIds.has(task.groupId) && task.subjectId) {
              subjectIds.add(task.subjectId);
            }
          }

          for (const assessment of allAssessments) {
            if (assessment.groupId && classGroupIds.has(assessment.groupId) && assessment.subjectId) {
              subjectIds.add(assessment.subjectId);
            }
          }

          if (subjectIds.size === 0) {
            const linkedSubjects = Array.from(linkedSubjectsByClass.get(classId) ?? []);
            if (linkedSubjects.length > 0) {
              linkedSubjects.sort((a, b) => a.localeCompare(b));
              subjectIds.add(linkedSubjects[0]);
            }
          }

          if (subjectIds.size === 0) {
            continue;
          }

          const orderedSubjectIds = Array.from(subjectIds).sort((a, b) => a.localeCompare(b));
          const primarySubjectId = orderedSubjectIds[0];

          const classGroupById = new Map(classGroups.map((group) => [group.id, group]));
          const depthMemo = new Map<string, number>();
          const getDepth = (groupId: string, chain = new Set<string>()): number => {
            const cached = depthMemo.get(groupId);
            if (typeof cached === "number") {
              return cached;
            }
            if (chain.has(groupId)) {
              depthMemo.set(groupId, 0);
              return 0;
            }
            const group = classGroupById.get(groupId);
            const parentId = group?.parentId;
            if (!parentId || !classGroupById.has(parentId)) {
              depthMemo.set(groupId, 0);
              return 0;
            }
            const nextChain = new Set(chain);
            nextChain.add(groupId);
            const depth = getDepth(parentId, nextChain) + 1;
            depthMemo.set(groupId, depth);
            return depth;
          };

          const sortedGroups = [...classGroups].sort((a, b) => {
            const depthDiff = getDepth(a.id) - getDepth(b.id);
            if (depthDiff !== 0) {
              return depthDiff;
            }
            return a.position - b.position || a.name.localeCompare(b.name);
          });

          const groupIdMapBySubject = new Map<string, Map<string, string>>();
          const primaryMap = new Map<string, string>();
          for (const group of sortedGroups) {
            primaryMap.set(group.id, group.id);
            nextGroupsToPut.push({
              ...group,
              subjectId: primarySubjectId
            });
          }
          groupIdMapBySubject.set(primarySubjectId, primaryMap);

          for (const subjectId of orderedSubjectIds.slice(1)) {
            const map = new Map<string, string>();
            for (const group of sortedGroups) {
              const clonedId = crypto.randomUUID();
              map.set(group.id, clonedId);
              const parentId = group.parentId && map.has(group.parentId) ? map.get(group.parentId) : undefined;
              nextGroupsToAdd.push({
                ...group,
                id: clonedId,
                subjectId,
                parentId
              });
            }
            groupIdMapBySubject.set(subjectId, map);
          }

          for (const task of allTasks) {
            if (!task.groupId || !classGroupIds.has(task.groupId)) {
              continue;
            }
            const subjectMap = groupIdMapBySubject.get(task.subjectId);
            const nextGroupId = subjectMap?.get(task.groupId);
            if (nextGroupId === task.groupId) {
              continue;
            }
            nextTasksById.set(task.id, {
              ...task,
              groupId: nextGroupId || undefined
            });
          }

          for (const assessment of allAssessments) {
            if (!assessment.groupId || !classGroupIds.has(assessment.groupId)) {
              continue;
            }
            const subjectMap = assessment.subjectId ? groupIdMapBySubject.get(assessment.subjectId) : undefined;
            const nextGroupId = subjectMap?.get(assessment.groupId);
            if (nextGroupId === assessment.groupId) {
              continue;
            }
            nextAssessmentsById.set(assessment.id, {
              ...assessment,
              groupId: nextGroupId || undefined
            });
          }
        }

        if (nextGroupsToPut.length > 0) {
          await groupsTable.bulkPut(nextGroupsToPut);
        }
        if (nextGroupsToAdd.length > 0) {
          await groupsTable.bulkAdd(nextGroupsToAdd);
        }
        if (nextTasksById.size > 0) {
          await tasksTable.bulkPut(Array.from(nextTasksById.values()));
        }
        if (nextAssessmentsById.size > 0) {
          await assessmentsTable.bulkPut(Array.from(nextAssessmentsById.values()));
        }
      });
  }
}

export const db = new ProfePlusDB();
