import { NavLink, Outlet } from "react-router-dom";
import { ManagementProvider, useManagement } from "./ManagementContext";

function ManagementShell() {
  const { notice, isBusy } = useManagement();

  return (
    <section className="module-card management-shell">
      <h2>Gestión académica</h2>
      {notice ? <p className="notice">{notice}</p> : null}
      {isBusy ? (
        <div className="management-progress" role="status" aria-label="Procesando acción">
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
