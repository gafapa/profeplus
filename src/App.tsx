import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { GradebookPage } from "./modules/gradebook/GradebookPage";
import { AttendancePage } from "./modules/attendance/AttendancePage";
import { TasksPage } from "./modules/planner/PlannerPage";
import { RubricsPage } from "./modules/rubrics/RubricsPage";
import { ReportsPage } from "./modules/reports/ReportsPage";
import { AIAssistantPage } from "./modules/ai-assistant/AIAssistantPage";
import { ManagementLayout } from "./modules/management/ManagementLayout";
import { ManagementCoursesPage } from "./modules/management/ManagementCoursesPage";
import { ManagementStudentsPage } from "./modules/management/ManagementStudentsPage";
import { ManagementSubjectsPage } from "./modules/management/ManagementSubjectsPage";
import { ManagementUnitsPage } from "./modules/management/ManagementUnitsPage";
import { ManagementSchedulePage } from "./modules/management/ManagementSchedulePage";
import { ManagementDatabasePage } from "./modules/management/ManagementDatabasePage";
import { TopTabs } from "./shared/ui/TopTabs";
import { db } from "./shared/db/database";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import { setSelectedClass } from "./app/store";

function App() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const isManagementRoute = location.pathname.startsWith("/management");

  useEffect(() => {
    let active = true;

    const load = async () => {
      const groups = await db.classGroups.orderBy("name").toArray();
      if (!active) {
        return;
      }

      if (isManagementRoute) {
        dispatch(setSelectedClass(null));
        return;
      }

      const selectedExists = groups.some((group) => group.id === selectedClassId);
      if (!selectedExists && groups.length > 0) {
        dispatch(setSelectedClass(groups[0].id));
      }
      if (groups.length === 0) {
        dispatch(setSelectedClass(null));
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [dispatch, isManagementRoute, selectedClassId]);

  return (
    <div className="app-shell">
      <div className="acet-beam-bg" aria-hidden="true" />
      <header className="topbar">
        <div className="brand-block">
          <h1>ProfePlus</h1>
          <p>Panel docente inteligente</p>
        </div>
        <div className="topbar-actions">
          <NavLink
            to="/ai"
            className={({ isActive }) => `topbar-settings ${isActive ? "active" : ""}`}
            aria-label="Configuración IA"
            title="Configuración IA"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6.5" y="7.5" width="11" height="9" rx="2.5" />
              <circle cx="10" cy="12" r="1" />
              <circle cx="14" cy="12" r="1" />
              <path d="M12 4v2M9 18h6M5 12H3M21 12h-2" />
            </svg>
          </NavLink>
          <NavLink
            to="/management"
            className={({ isActive }) => `topbar-settings ${isActive ? "active" : ""}`}
            aria-label="Configuración"
            title="Configuración"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M12 2.8v2.1M12 19.1v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
              <circle cx="12" cy="12" r="7.2" />
            </svg>
          </NavLink>
        </div>
      </header>

      {isManagementRoute ? null : <TopTabs />}

      <main className="main-panel">
        <Routes>
          <Route path="/" element={<Navigate replace to="/gradebook" />} />
          <Route path="/management" element={<ManagementLayout />}>
            <Route index element={<Navigate replace to="/management/courses" />} />
            <Route path="courses" element={<ManagementCoursesPage />} />
            <Route path="students" element={<ManagementStudentsPage />} />
            <Route path="subjects" element={<ManagementSubjectsPage />} />
            <Route path="units" element={<ManagementUnitsPage />} />
            <Route path="schedule" element={<ManagementSchedulePage />} />
            <Route path="database" element={<ManagementDatabasePage />} />
          </Route>
          <Route path="/gradebook" element={<GradebookPage />} />
          <Route path="/journal" element={<AttendancePage />} />
          <Route path="/attendance" element={<Navigate replace to="/journal" />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/planner" element={<Navigate replace to="/tasks" />} />
          <Route path="/rubrics" element={<RubricsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/ai" element={<AIAssistantPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
