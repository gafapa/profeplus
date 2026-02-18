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
  startDate: string;
  endDate: string;
  sessionCount: number;
  position: number;
};

export type ScheduleBlock = {
  id: string;
  startTime: string;
  endTime: string;
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

export type ClassGroup = {
  id: string;
  name: string;
  courseId?: string;
  subjectId?: string;
  section?: string;
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
  photoDataUrl?: string;
  email?: string;
};

export type Assessment = {
  id: string;
  classId: string;
  title: string;
  weight: number;
  period: string;
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

export type RubricTemplate = {
  id: string;
  classId: string;
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

export type SubjectStudentOverride = {
  id: string;
  subjectId: string;
  studentId: string;
  included: boolean;
};
