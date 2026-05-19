export type Subject = {
  id: string;
  name: string;
  teachingHours?: string;
  scheduleSlotIds?: string[];
};

export type UnitBlock = {
  id: string;
  subjectId: string;
  name: string;
  description: string;
  sessionCount: number;
  position: number;
};


export type ScheduleBlock = {
  id: string;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
};

export type ScheduleDay = {
  id: string;
  dayOfWeek: number;
  dayName: string;
  enabled: boolean;
  blocks: ScheduleBlock[];
};

export type ScheduleSettings = {
  id: string;
  defaultBlockDurationMinutes: number;
};

export type AppPreferences = {
  id: string;
  studentSortBy: "lastName" | "firstName";
  studentNameFormat: "firstLast" | "lastFirst";
  weekStartsOn: "monday" | "sunday";
};

export type ClassGroup = {
  id: string;
  name: string;
  level: string;
  schoolYear: string;
  comments?: string;
};

export type Student = {
  id: string;
  classId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  comments?: string;
  photoDataUrl?: string;
  email?: string;
};

export type Assessment = {
  id: string;
  classId: string;
  subjectId: string;
  title: string;
  weight: number;
  period: string;
  groupId?: string;
  competency?: string;
};

export type GradeEntry = {
  id: string;
  classId: string;
  assessmentId: string;
  studentId: string;
  numericValue?: number;
  textValue?: string;
  colorTag?: string;
  iconTag?: string;
  comment?: string;
};

export type AttendanceEntry = {
  id: string;
  classId: string;
  studentId: string;
  date: string;
  scheduleSlotId?: string;
  status: "present" | "late" | "absent";
  note?: string;
};

export type LessonPlan = {
  id: string;
  classId: string;
  date: string;
  unit: string;
  objective: string;
  activity: string;
  resources?: string;
  homework?: string;
  status?: "planned" | "taught";
};

/** Reusable task definition. Subject, unit, and gradebook settings live in related tables. */
export type Task = {
  id: string;
  title: string;
  description: string;
  sessionCount: number;
  sendToGradebook: boolean;
};

/** Links a task to a subject and optionally to a unit. */
export type TaskSubjectLink = {
  id: string;
  taskId: string;
  subjectId: string;
  unitId?: string;
};

export type TaskGradebookConfig = {
  id: string;
  taskId: string;
  subjectId: string;
  classId: string;
  gradebookWeight: number;
  groupId?: string;
  rubricTemplateId?: string;
  checklistTemplateId?: string;
};

export type GradebookGroup = {
  id: string;
  classId: string;
  subjectId: string;
  name: string;
  parentId?: string;
  position: number;
  weight?: number;
};

export type TaskSession = {
  id: string;
  taskId: string;
  subjectId: string;
  /** Curso para el que se planifica esta sesión (la misma tarea puede tener sesiones distintas por curso). */
  classId: string;
  date: string;
  scheduleSlotId: string;
};

export type TaskStudentComment = {
  id: string;
  taskId: string;
  date?: string;
  scheduleSlotId?: string;
  studentId: string;
  comment: string;
};

export type TaskDailyEvaluationSetting = {
  id: string;
  taskId: string;
  date: string;
  scheduleSlotId?: string;
  generalComment?: string;
  rubricTemplateId?: string;
  checklistTemplateId?: string;
};

export type TaskRubricAssessment = {
  id: string;
  taskId: string;
  date: string;
  scheduleSlotId?: string;
  studentId: string;
  rubricTemplateId: string;
  criterionId: string;
  levelId: string;
  score: number;
};

export type TaskChecklistAssessment = {
  id: string;
  taskId: string;
  date: string;
  scheduleSlotId?: string;
  studentId: string;
  checklistTemplateId: string;
  itemId: string;
  checked: boolean;
};

export type RubricTemplate = {
  id: string;
  classId: string;
  taskId?: string;
  name: string;
  description?: string;
  criteria?: RubricCriterion[];
  levels?: RubricLevel[];
  criteriaCount?: number;
  levelCount?: number;
};

export type RubricCriterion = {
  id: string;
  name: string;
  description?: string;
  levels?: RubricLevel[];
};

export type RubricLevel = {
  id: string;
  name: string;
  score: number;
};

export type ChecklistTemplate = {
  id: string;
  classId: string;
  taskId?: string;
  name: string;
  description?: string;
  items?: ChecklistItem[];
};

export type ChecklistItem = {
  id: string;
  text: string;
};

export type SubjectCourseLink = {
  id: string;
  subjectId: string;
  classId: string;
};

export type SubjectStudentLink = {
  id: string;
  subjectId: string;
  studentId: string;
};
