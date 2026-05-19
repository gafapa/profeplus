import { useMemo } from "react";
import { useAppSelector } from "../../app/hooks";
import type { Student } from "../db/types";
import { compareStudentsByField, formatStudentName } from "../utils/student";

/**
 * Hook que expone las preferencias de visualización y ordenación de alumnos.
 *
 * - `formatName(student)` → formatea según la preferencia "Nombre Apellido" / "Apellido, Nombre"
 * - `compareFn`           → comparador para Array.sort() según la preferencia de orden
 */
export function useStudentDisplay() {
  const sortBy = useAppSelector((state) => state.app.studentSortBy);
  const nameFormat = useAppSelector((state) => state.app.studentNameFormat);

  const compareFn = useMemo(() => compareStudentsByField(sortBy), [sortBy]);

  const formatName = useMemo(
    () =>
      (student: Student): string =>
        formatStudentName(student, nameFormat),
    [nameFormat]
  );

  return { formatName, compareFn };
}
