import { NavLink } from "react-router-dom";

const items = [
  { to: "/journal", label: "Diario" },
  { to: "/gradebook", label: "Cuaderno" },
  { to: "/tasks", label: "Tareas" },
  { to: "/rubrics", label: "Evaluación" },
  { to: "/reports", label: "Informes" }
];

export function TopTabs() {
  return (
    <nav className="top-tabs" aria-label="Navegación principal">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
