/** Moodle wire-independent contracts. Authentication secrets are never persisted. */
export type MoodleSite = { siteUrl: string; siteName: string; userId: number; fullName: string; functions: string[] };
export type MoodleCourse = { id: number; fullName: string; shortName: string };
export type MoodleGroup = { id: number; courseId: number; name: string; memberIds: number[] };
export type MoodleUser = { id: number; firstName: string; lastName: string; fullName: string; email?: string };
export type MoodleActivity = { id: number; courseId: number; instanceId: number; module: string; title: string; url: string; dueDate?: number; gradeMax?: number; advancedGrading?: boolean; teamSubmission?: boolean };
export type MoodleGrade = { activityId: number; userId: number; grade: number | null; modifiedAt: number; attemptNumber?: number; locked?: boolean; overridden?: boolean };
export type MoodleSubmission = { activityId: number; userId: number; status: string; modifiedAt: number };
export type MoodleCourseSnapshot = { course: MoodleCourse; groups: MoodleGroup[]; students: MoodleUser[]; activities: MoodleActivity[]; grades: MoodleGrade[]; submissions: MoodleSubmission[]; warnings: string[]; fetchedAt: string };
export type MoodleConnection = { id: string; server: string; userId: number; siteName: string; userName: string; functions: string[]; createdAt: string; updatedAt: string };
export type MoodleBindingKind = "course" | "student" | "activity";
export type MoodleBinding = { id: string; connectionId: string; courseId: number; remoteGroupId?: number; classId: string; subjectId: string; kind: MoodleBindingKind; remoteId: number; localId: string; remoteLabel: string; localBaseline: Record<string, string | number | null>; remoteBaseline: Record<string, string | number | null>; updatedAt: string };
export type MoodleOperation = { id: string; connectionId: string; createdAt: string; kind: "link" | "update" | "grades"; summary: string; count: number };
export type MoodleScope = { courseId: number; remoteGroupId?: number; classId: string; subjectId: string };
export type MoodleMappingChoice = { kind: "student" | "activity"; remoteId: number; action: "link" | "create" | "ignore" | "unlink"; localId?: string };
export type MoodleResolution = "remote" | "local";
