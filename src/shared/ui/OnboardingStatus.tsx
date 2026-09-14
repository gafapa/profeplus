import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { db } from "../db/database";
import { buildOnboardingChecklist, type OnboardingChecklistItem } from "../onboarding/checklist";
import { TeacherOnboarding } from "../../modules/management/TeacherOnboarding";
import { trackAnalyticsEventOnce } from "../analytics/analytics";

export function OnboardingStatus() {
  const [items, setItems] = useState<OnboardingChecklistItem[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const subscription = liveQuery(async () => {
      const [courses, students, scheduleDays, subjects, subjectCourseLinks, taskSessions] = await Promise.all([
        db.classGroups.toArray(), db.students.toArray(), db.scheduleDays.toArray(),
        db.subjects.toArray(), db.subjectCourseLinks.toArray(), db.taskSessions.toArray()
      ]);
      return buildOnboardingChecklist({ courses, students, scheduleDays, subjects, subjectCourseLinks, taskSessions });
    }).subscribe({
      next: checklist => {
        setItems(checklist);
        setReady(true);
        if (checklist.every(item => item.complete)) trackAnalyticsEventOnce("onboarding_completed");
      },
      error: () => setReady(false)
    });
    return () => subscription.unsubscribe();
  }, []);
  return <TeacherOnboarding items={items} isReady={ready} />;
}
