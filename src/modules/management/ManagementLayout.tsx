import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ManagementProvider, useManagement } from "./ManagementContext";

function ManagementShell() {
  const { notice, isBusy } = useManagement();
  const navigate = useNavigate();

  return (
    <section className="module-card management-shell">
      <div className="management-shell-header">
        <h2>Gestion academica</h2>
        <button
          type="button"
          className="icon-btn management-close-btn"
          onClick={() => navigate("/gradebook")}
          title="Cerrar gestion academica"
          aria-label="Cerrar gestion academica"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>
      </div>
      {notice ? <p className="notice">{notice}</p> : null}
      {isBusy ? (
        <div className="management-progress" role="status" aria-label="Procesando acciÃ³n">
          <div className="management-progress-bar" />
        </div>
      ) : null}

      <nav className="management-nav">
        <NavLink
          to="/management/courses"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Cursos
        </NavLink>
        <NavLink
          to="/management/students"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Alumnos
        </NavLink>
        <NavLink
          to="/management/subjects"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Asignaturas
        </NavLink>
        <NavLink
          to="/management/units"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Unidades
        </NavLink>
        <NavLink
          to="/management/schedule"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Horario
        </NavLink>
        <NavLink
          to="/management/database"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Base de datos
        </NavLink>
      </nav>

      <Outlet />
    </section>
  );
}

export function ManagementLayout() {
  return (
    <ManagementProvider>
      <ManagementShell />
    </ManagementProvider>
  );
}

