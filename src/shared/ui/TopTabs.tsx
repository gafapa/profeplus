import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setSelectedClass, setSelectedSubject } from "../../app/store";
import { db } from "../db/database";
import type { ClassGroup, Subject } from "../db/types";

const allItems = [
  { to: "/today",                   label: "Hoy",          description: "Impartir y registrar clases", icon: "today",      tone: "today" },
  { to: "/planner",                 label: "Planificador", description: "Preparar y programar sesiones", icon: "planner",    tone: "planner" },
  { to: "/journal/work",            label: "Evaluar",      description: "Calificar tareas y evidencias", icon: "tasks",      tone: "work" },
  { to: "/journal/attendance",      label: "Asistencia",   description: "Revisar el historial de asistencia", icon: "journal",    tone: "attendance" },
  { to: "/gradebook",               label: "Cuaderno",     description: "Organizar y calcular notas", icon: "gradebook",  tone: "gradebook" },
  { to: "/management/courses",      label: "Cursos",       icon: "courses" },
  { to: "/management/periods",      label: "Periodos",     icon: "gradebook" },
  { to: "/management/students",     label: "Alumnos",      icon: "students" },
  { to: "/management/tutor",        label: "Tutoría",      description: "Seguimientos, familias y apoyos", icon: "tutor" },
  { to: "/management/subjects",     label: "Asignaturas",  icon: "subjects" },
  { to: "/management/units",        label: "Unidades",     icon: "units" },
  { to: "/management/tasks",        label: "Tareas",       icon: "tasks" },
  { to: "/management/schedule",     label: "Horario",      icon: "schedule" },
  { to: "/reports",                 label: "Informes",     icon: "reports",    tone: "reports" },
];

const rightItems = [
  { to: "/config", label: "Configuración", icon: "config" }
];

function TopTabIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "today":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v3M18 4v3M4 8h16v12H4zM8 12h4M8 16h8" /><path d="m16 12 1.2 1.2 2.8-3" /></svg>;
    case "journal":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v16H7zM10 4v16M13 8h2M13 12h2" /></svg>;
    case "gradebook":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5zM8 9h8M8 13h3M14 13h2M8 17h8" /></svg>;
    case "courses":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M6 7v11h12V7M8 11h8M8 15h5" /></svg>;
    case "students":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20a6 6 0 0 1 12 0M17 10a2.5 2.5 0 1 0 0-5M16 15a5 5 0 0 1 5 5" /></svg>;
    case "tutor":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v11H8l-3 3zM8 9h8M8 12h5" /><path d="M17 18v3M14 21h6" /></svg>;
    case "subjects":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h9a4 4 0 0 1 4 4v10H9a4 4 0 0 1-4-4zM9 9h5M9 13h6" /></svg>;
    case "units":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14v5H5zM5 13h6v5H5zM13 13h6v5h-6z" /></svg>;
    case "tasks":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h12v14H6zM9 10l1 1 3-3M9 16l1 1 3-3M15 10h1M15 16h1" /></svg>;
    case "schedule":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v3M18 4v3M4 8h16v12H4zM8 12h3M13 12h3M8 16h3" /></svg>;
    case "planner":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v3M18 4v3M4 8h16v12H4zM8 12h3M13 12h3M8 16h8" /><path d="m15 5 2 2 4-4" /></svg>;
    case "reports":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V5h14v14zM9 16V9M12 16v-4M15 16v-7" /></svg>;
    case "config":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 12h3M17 12h3M12 4v3M12 17v3M6.6 6.6l2.1 2.1M15.3 15.3l2.1 2.1M17.4 6.6l-2.1 2.1M8.7 15.3l-2.1 2.1" /></svg>;
    default:
      return null;
  }
}

export function TopTabs() {
  const dispatch   = useAppDispatch();
  const location   = useLocation();
  const selectedClassId   = useAppSelector((s) => s.app.selectedClassId);
  const selectedSubjectId = useAppSelector((s) => s.app.selectedSubjectId);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [subjects,    setSubjects]    = useState<Subject[]>([]);

  const isManagementRoute = location.pathname.startsWith("/management");
  const isJournalRoute = location.pathname.startsWith("/journal");
  const isConfigRoute = location.pathname.startsWith("/config");
  // These pages manage context locally.
  const usesLocalContextSelector =
    isConfigRoute ||
    isJournalRoute ||
    location.pathname.startsWith("/gradebook") ||
    location.pathname.startsWith("/today") ||
    location.pathname.startsWith("/planner") ||
    location.pathname.startsWith("/reports") ||
    location.pathname.startsWith("/management/units") ||
    location.pathname.startsWith("/management/tasks");
  const showSelectors = !isManagementRoute && !usesLocalContextSelector;

  // Reload courses on mount and after returning from management pages.
  useEffect(() => {
    let active = true;
    db.classGroups.orderBy("name").toArray().then((groups) => {
      if (active) setClassGroups(groups);
    });
    return () => { active = false; };
  }, [isManagementRoute]);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      if (!showSelectors) {
        if (active) setSubjects((current) => (current.length > 0 ? [] : current));
        return;
      }
      if (!selectedClassId) {
        if (active) {
          setSubjects((current) => (current.length > 0 ? [] : current));
          if (selectedSubjectId) dispatch(setSelectedSubject(""));
        }
        return;
      }
      const [allSubjects, links] = await Promise.all([
        db.subjects.orderBy("name").toArray(),
        db.subjectCourseLinks.where("classId").equals(selectedClassId).toArray(),
      ]);
      if (!active) return;
      const linkedIds = new Set(links.map((l) => l.subjectId));
      setSubjects(allSubjects.filter((s) => linkedIds.has(s.id)));
    };
    void load();
    return () => { active = false; };
  }, [dispatch, selectedClassId, selectedSubjectId, showSelectors]);

  const hasSelectedSubject = useMemo(
    () => subjects.some((s) => s.id === selectedSubjectId),
    [selectedSubjectId, subjects],
  );

  useEffect(() => {
    if (!showSelectors) return;
    if (subjects.length === 0) {
      if (selectedSubjectId) dispatch(setSelectedSubject(""));
      return;
    }
    if (!hasSelectedSubject) dispatch(setSelectedSubject(subjects[0].id));
  }, [dispatch, hasSelectedSubject, selectedSubjectId, showSelectors, subjects]);

  return (
    <nav className="top-tabs" aria-label="Navegación principal">
      <div className="main-module-tabs section-tabs" aria-label="Módulos">
        {allItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            aria-label={item.description ? `${item.label}: ${item.description}` : item.label}
            title={item.description}
            className={({ isActive }) =>
              `section-tab compact ${item.tone ? `featured ${item.tone}` : ""} ${isActive ? "active" : ""}`
            }
          >
            <TopTabIcon icon={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Context selectors */}
      {showSelectors && (
        <div className="top-tabs-selectors" aria-label="Selección principal">
          {classGroups.length > 0 ? (
            <div className="top-context-tabs section-tabs" role="group" aria-label="Curso">
              {classGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  aria-pressed={selectedClassId === group.id}
                  className={`section-tab compact ${selectedClassId === group.id ? "active" : ""}`}
                  onClick={() => dispatch(setSelectedClass(group.id))}
                  title={group.name}
                >
                  <span>{group.name || "Curso sin nombre"}</span>
                  <small>{group.schoolYear}</small>
                </button>
              ))}
            </div>
          ) : (
            <span className="top-context-empty">Sin cursos</span>
          )}

          {selectedClassId ? (
            subjects.length > 0 ? (
              <div className="top-context-tabs section-tabs" role="group" aria-label="Asignatura">
                {subjects.map((subject) => (
                  <button
                    key={subject.id}
                    type="button"
                    aria-pressed={hasSelectedSubject && selectedSubjectId === subject.id}
                    className={`section-tab compact ${
                      hasSelectedSubject && selectedSubjectId === subject.id ? "active" : ""
                    }`}
                    onClick={() => dispatch(setSelectedSubject(subject.id))}
                    title={subject.name}
                  >
                    <span>{subject.name || "Asignatura sin nombre"}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="top-context-empty">Sin asignaturas</span>
            )
          ) : null}
        </div>
      )}
      <div className="right-module-tabs section-tabs" aria-label="Configuración">
        {rightItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `section-tab compact ${isActive ? "active" : ""}`}
          >
            <TopTabIcon icon={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
