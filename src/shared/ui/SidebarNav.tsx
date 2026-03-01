import { NavLink } from "react-router-dom";

const items = [
  { to: "/journal", label: "Diario" },
  { to: "/management", label: "Gestión" },
  { to: "/gradebook", label: "Cuaderno" },
  { to: "/tasks", label: "Tareas" },
  { to: "/rubrics", label: "Evaluación" },
  { to: "/reports", label: "Informes" }
];

export function SidebarNav() {
  return (
    <aside className="sidebar">
      <ul className="nav-list">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
}
