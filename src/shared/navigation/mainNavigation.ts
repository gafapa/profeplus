export type NavigationIcon =
  | "today"
  | "journal"
  | "gradebook"
  | "courses"
  | "students"
  | "tutor"
  | "subjects"
  | "units"
  | "tasks"
  | "schedule"
  | "planner"
  | "reports"
  | "search"
  | "config";

export type NavigationItem = {
  to: string;
  label: string;
  icon: NavigationIcon;
};

export type NavigationArea = {
  id: "today" | "planning" | "assessment" | "follow-up" | "organization";
  to: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: NavigationIcon;
  items: NavigationItem[];
};

export const navigationAreas: NavigationArea[] = [
  {
    id: "today",
    to: "/today",
    label: "Hoy",
    shortLabel: "Hoy",
    description: "Impartir y registrar las clases del día",
    icon: "today",
    items: [
      { to: "/today", label: "Jornada", icon: "today" },
      { to: "/agenda", label: "Agenda", icon: "schedule" },
      { to: "/search", label: "Buscar", icon: "search" }
    ]
  },
  {
    id: "planning",
    to: "/planner",
    label: "Planificar",
    shortLabel: "Plan",
    description: "Preparar sesiones, unidades y tareas",
    icon: "planner",
    items: [
      { to: "/planner", label: "Semana", icon: "planner" },
      { to: "/management/units", label: "Unidades", icon: "units" },
      { to: "/management/tasks", label: "Tareas", icon: "tasks" }
    ]
  },
  {
    id: "assessment",
    to: "/journal/work",
    label: "Evaluar",
    shortLabel: "Evaluar",
    description: "Registrar evidencias y calcular resultados",
    icon: "tasks",
    items: [
      { to: "/journal/work", label: "Evaluación", icon: "tasks" },
      { to: "/gradebook", label: "Cuaderno", icon: "gradebook" },
      { to: "/management/periods", label: "Periodos", icon: "gradebook" }
    ]
  },
  {
    id: "follow-up",
    to: "/journal/attendance",
    label: "Seguimiento",
    shortLabel: "Seguir",
    description: "Revisar asistencia, tutoría e informes",
    icon: "tutor",
    items: [
      { to: "/journal/attendance", label: "Asistencia", icon: "journal" },
      { to: "/management/tutor", label: "Tutoría", icon: "tutor" },
      { to: "/reports", label: "Informes", icon: "reports" }
    ]
  },
  {
    id: "organization",
    to: "/management/courses",
    label: "Organización",
    shortLabel: "Gestión",
    description: "Gestionar la estructura académica",
    icon: "courses",
    items: [
      { to: "/management/courses", label: "Grupos", icon: "courses" },
      { to: "/management/students", label: "Alumnado", icon: "students" },
      { to: "/classroom", label: "Aula", icon: "students" },
      { to: "/management/subjects", label: "Asignaturas", icon: "subjects" },
      { to: "/management/schedule", label: "Horario", icon: "schedule" }
    ]
  }
];

export const settingsNavigationItem: NavigationItem = {
  to: "/config",
  label: "Configuración",
  icon: "config"
};

export function matchesNavigationPath(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function findActiveNavigationArea(pathname: string): NavigationArea | null {
  return (
    navigationAreas.find((area) =>
      area.items.some((item) => matchesNavigationPath(pathname, item.to))
    ) ?? null
  );
}
