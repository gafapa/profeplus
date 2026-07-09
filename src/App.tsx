import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import { hydrateAppPreferences, setSelectedClass } from "./app/store";
import { AttendancePage } from "./modules/attendance/AttendancePage";
import { ConfigLayout } from "./modules/config/ConfigLayout";
import { GradebookPage } from "./modules/gradebook/GradebookPage";
import { ManagementCoursesPage } from "./modules/management/ManagementCoursesPage";
import { ManagementDatabasePage } from "./modules/management/ManagementDatabasePage";
import { ManagementLayout } from "./modules/management/ManagementLayout";
import { ManagementPreferencesPage } from "./modules/management/ManagementPreferencesPage";
import { ManagementSchedulePage } from "./modules/management/ManagementSchedulePage";
import { ManagementStudentsPage } from "./modules/management/ManagementStudentsPage";
import { ManagementSubjectsPage } from "./modules/management/ManagementSubjectsPage";
import { ManagementTasksPage } from "./modules/management/ManagementTasksPage";
import { ManagementUnitsPage } from "./modules/management/ManagementUnitsPage";
import { PlannerPage } from "./modules/planner/PlannerPage";
import { ReportsPage } from "./modules/reports/ReportsPage";
import { enableAiExtensionOverlay } from "./shared/ai/extensionOverlay";
import { db } from "./shared/db/database";
import { NoContextBanner } from "./shared/ui/NoContextBanner";
import { TopTabs } from "./shared/ui/TopTabs";
import packageJson from "../package.json";

function App() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const studentSortBy = useAppSelector((state) => state.app.studentSortBy);
  const studentNameFormat = useAppSelector((state) => state.app.studentNameFormat);
  const weekStartsOn = useAppSelector((state) => state.app.weekStartsOn);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  const isConfigRoute = location.pathname.startsWith("/config");
  const isManagementRoute = location.pathname.startsWith("/management");

  useEffect(() => {
    enableAiExtensionOverlay();
  }, []);

  useEffect(() => {
    let active = true;
    db.appPreferences.get("default").then((preferences) => {
      if (!active) return;
      if (preferences) {
        dispatch(hydrateAppPreferences(preferences));
      }
      setPreferencesLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [dispatch]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    void db.appPreferences.put({
      id: "default",
      studentSortBy,
      studentNameFormat,
      weekStartsOn
    });
  }, [preferencesLoaded, studentNameFormat, studentSortBy, weekStartsOn]);

  useEffect(() => {
    if (isConfigRoute || isManagementRoute) return;

    let active = true;
    const load = async () => {
      const groups = await db.classGroups.orderBy("name").toArray();
      if (!active) return;
      const selectedExists = groups.some((group) => group.id === selectedClassId);
      if (!selectedExists && groups.length > 0) dispatch(setSelectedClass(groups[0].id));
      if (groups.length === 0) dispatch(setSelectedClass(null));
    };

    void load();
    return () => {
      active = false;
    };
  }, [dispatch, isConfigRoute, isManagementRoute, selectedClassId]);

  return (
    <div className="app-shell">
      <div className="acet-beam-bg" aria-hidden="true" />

      <TopTabs />

      {!isConfigRoute && !isManagementRoute && (
        <NoContextBanner
          noClass={!selectedClassId}
          noSubject={false}
        />
      )}

      <main className="main-panel">
        <Routes>
          <Route path="/" element={<Navigate replace to="/gradebook" />} />

          <Route path="/management" element={<ManagementLayout />}>
            <Route index element={<Navigate replace to="/management/courses" />} />
            <Route path="courses" element={<ManagementCoursesPage />} />
            <Route path="students" element={<ManagementStudentsPage />} />
            <Route path="subjects" element={<ManagementSubjectsPage />} />
            <Route path="tasks" element={<ManagementTasksPage />} />
            <Route path="units" element={<ManagementUnitsPage />} />
            <Route path="schedule" element={<ManagementSchedulePage />} />
          </Route>

          <Route path="/config" element={<ConfigLayout />}>
            <Route index element={<Navigate replace to="/config/preferences" />} />
            <Route path="preferences" element={<ManagementPreferencesPage />} />
            <Route path="database" element={<ManagementDatabasePage />} />
          </Route>

          <Route path="/gradebook" element={<GradebookPage />} />
          <Route path="/journal" element={<Navigate replace to="/journal/attendance" />} />
          <Route path="/journal/attendance" element={<AttendancePage mode="attendance" />} />
          <Route path="/journal/work" element={<AttendancePage mode="work" />} />
          <Route path="/attendance" element={<Navigate replace to="/journal/attendance" />} />
          <Route path="/tasks" element={<Navigate replace to="/management/tasks" />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/rubrics" element={<Navigate replace to="/management/tasks" />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </main>
      <footer className="status-bar" aria-label="Estado de la aplicación">
        <span>ProfePlus</span>
        <span>v{packageJson.version}</span>
      </footer>
    </div>
  );
}

export default App;
