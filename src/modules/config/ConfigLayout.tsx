import { NavLink, Outlet } from "react-router-dom";
import { ManagementProvider, useManagement } from "../management/ManagementContext";

function ConfigShell() {
  const { notice, isBusy } = useManagement();

  return (
    <section className="module-card">
      {notice ? <p className="notice">{notice}</p> : null}
      {isBusy ? (
        <div className="management-progress" role="status" aria-label="Procesando">
          <div className="management-progress-bar" />
        </div>
      ) : null}

      <div className="courses-layout">
        <aside className="courses-list-panel">
          <nav className="courses-list section-tabs" aria-label="Secciones de configuración">
            <NavLink
              to="/config/preferences"
              className={({ isActive }) => `section-tab ${isActive ? "active" : ""}`}
            >
              <span>Preferencias</span>
            </NavLink>
            <NavLink
              to="/config/database"
              className={({ isActive }) => `section-tab ${isActive ? "active" : ""}`}
            >
              <span>Base de datos</span>
            </NavLink>
          </nav>
        </aside>

        <section className="course-detail-panel">
          <Outlet />
        </section>
      </div>
    </section>
  );
}

export function ConfigLayout() {
  return (
    <ManagementProvider>
      <ConfigShell />
    </ManagementProvider>
  );
}
