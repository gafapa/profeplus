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
  tone: "today" | "planner" | "work" | "attendance" | "organization";
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
    tone: "today",
    items: [{ to: "/today", label: "Jornada", icon: "today" }]
  },
  {
    id: "planning",
    to: "/planner",
    label: "Planificar",
    shortLabel: "Plan",
    description: "Preparar sesiones, unidades y tareas",
    icon: "planner",
    tone: "planner",
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
    tone: "work",
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
    tone: "attendance",
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
    tone: "organization",
    items: [
      { to: "/management/courses", label: "Cursos", icon: "courses" },
      { to: "/management/students", label: "Alumnos", icon: "students" },
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
