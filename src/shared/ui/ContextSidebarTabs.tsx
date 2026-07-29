import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setSelectedClass, setSelectedSubject } from "../../app/store";
import { db } from "../db/database";
import type { ClassGroup, Subject } from "../db/types";

type ContextSidebarTabsProps = {
  includeSubjects?: boolean;
  beforeChange?: () => boolean | void | Promise<boolean | void>;
};

export function ContextSidebarTabs({ includeSubjects = true, beforeChange }: ContextSidebarTabsProps) {
  const dispatch = useAppDispatch();
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const selectedSubjectId = useAppSelector((state) => state.app.selectedSubjectId);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    let active = true;
    db.classGroups.orderBy("name").toArray().then((groups) => {
      if (active) setClassGroups(groups);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (classGroups.length === 0) {
      if (selectedClassId) dispatch(setSelectedClass(null));
      return;
    }
    const exists = classGroups.some((classGroup) => classGroup.id === selectedClassId);
    if (!exists) {
      dispatch(setSelectedClass(classGroups[0].id));
    }
  }, [classGroups, dispatch, selectedClassId]);

  useEffect(() => {
    let active = true;
    const loadSubjects = async (): Promise<void> => {
      if (!includeSubjects || !selectedClassId) {
        if (active) setSubjects((current) => (current.length > 0 ? [] : current));
        return;
      }
      const [subjectsData, linksData] = await Promise.all([
        db.subjects.orderBy("name").toArray(),
        db.subjectCourseLinks.where("classId").equals(selectedClassId).toArray()
      ]);
      if (!active) return;
      const linkedSubjectIds = new Set(linksData.map((link) => link.subjectId));
      setSubjects(subjectsData.filter((subject) => linkedSubjectIds.has(subject.id)));
    };
    void loadSubjects();
    return () => {
      active = false;
    };
  }, [includeSubjects, selectedClassId]);

  useEffect(() => {
    if (!includeSubjects) return;
    if (!selectedClassId || subjects.length === 0) {
      if (selectedSubjectId) dispatch(setSelectedSubject(""));
      return;
    }
    const exists = subjects.some((subject) => subject.id === selectedSubjectId);
    if (!exists) {
      dispatch(setSelectedSubject(subjects[0].id));
    }
  }, [dispatch, includeSubjects, selectedClassId, selectedSubjectId, subjects]);

  const runChange = async (action: () => void): Promise<void> => {
    const canChange = await beforeChange?.();
    if (canChange === false) return;
    action();
  };

  return (
    <div className="context-sidebar-tabs">
      <div className="context-sidebar-group">
        <strong>Curso</strong>
        {classGroups.length > 0 ? (
          <div className="courses-list section-tabs context-sidebar-list" role="group" aria-label="Curso">
            {classGroups.map((classGroup) => (
              <button
                key={classGroup.id}
                type="button"
                aria-pressed={selectedClassId === classGroup.id}
                className={`section-tab ${selectedClassId === classGroup.id ? "active" : ""}`}
                onClick={() => {
                  void runChange(() => dispatch(setSelectedClass(classGroup.id)));
                }}
              >
                <span>{classGroup.name || "Curso sin nombre"}</span>
                <small>{classGroup.schoolYear}</small>
              </button>
            ))}
          </div>
        ) : (
          <p className="hint">No hay cursos creados.</p>
        )}
      </div>

      {includeSubjects && selectedClassId ? (
        <>
          <div className="context-sidebar-separator" aria-hidden="true" />
          <div className="context-sidebar-group">
            <strong>Asignatura</strong>
            {subjects.length > 0 ? (
              <div className="courses-list section-tabs context-sidebar-list" role="group" aria-label="Asignatura">
                {subjects.map((subject) => (
                  <button
                    key={subject.id}
                    type="button"
                    aria-pressed={selectedSubjectId === subject.id}
                    className={`section-tab ${selectedSubjectId === subject.id ? "active" : ""}`}
                    onClick={() => {
                      void runChange(() => dispatch(setSelectedSubject(subject.id)));
                    }}
                  >
                    <span>{subject.name || "Asignatura sin nombre"}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="hint">No hay asignaturas asociadas a este curso.</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
