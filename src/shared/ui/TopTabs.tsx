import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setSelectedSubject } from "../../app/store";
import { db } from "../db/database";
import type { Subject } from "../db/types";

const items = [
  { to: "/journal", label: "Diario" },
  { to: "/gradebook", label: "Cuaderno" },
  { to: "/tasks", label: "Tareas" },
  { to: "/rubrics", label: "Evaluacion" },
  { to: "/reports", label: "Informes" }
];

export function TopTabs() {
  const dispatch = useAppDispatch();
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const selectedSubjectId = useAppSelector((state) => state.app.selectedSubjectId);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      if (!selectedClassId) {
        if (active) {
          setSubjects([]);
          dispatch(setSelectedSubject(""));
        }
        return;
      }

      const [allSubjects, links] = await Promise.all([
        db.subjects.orderBy("name").toArray(),
        db.subjectCourseLinks.where("classId").equals(selectedClassId).toArray()
      ]);
      if (!active) {
        return;
      }

      const linkedIds = new Set(links.map((item) => item.subjectId));
      const filtered = allSubjects.filter((subject) => linkedIds.has(subject.id));
      // Fallback: si la relacion curso-asignatura no refleja todo, mostramos todas.
      const visibleSubjects = filtered.length > 1 || allSubjects.length <= 1 ? filtered : allSubjects;
      setSubjects(visibleSubjects);
    };

    void load();

    return () => {
      active = false;
    };
  }, [dispatch, selectedClassId]);

  const hasSelectedSubject = useMemo(
    () => subjects.some((subject) => subject.id === selectedSubjectId),
    [selectedSubjectId, subjects]
  );

  useEffect(() => {
    if (subjects.length === 0) {
      if (selectedSubjectId) {
        dispatch(setSelectedSubject(""));
      }
      return;
    }
    if (!hasSelectedSubject) {
      dispatch(setSelectedSubject(subjects[0].id));
    }
  }, [dispatch, hasSelectedSubject, selectedSubjectId, subjects]);

  return (
    <nav className="top-tabs" aria-label="Navegacion principal">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
          {item.label}
        </NavLink>
      ))}
      <label className="top-tabs-subject">
        <select
          className="class-selector"
          value={hasSelectedSubject ? selectedSubjectId : ""}
          onChange={(event) => dispatch(setSelectedSubject(event.target.value))}
          disabled={subjects.length === 0}
          aria-label="Asignatura"
          title="Asignatura"
        >
          {subjects.length === 0 ? <option value="">Sin asignaturas</option> : null}
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}
