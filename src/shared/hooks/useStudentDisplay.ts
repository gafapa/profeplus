import { useMemo } from "react";
import { useAppSelector } from "../../app/hooks";
import type { Student } from "../db/types";
import { compareStudentsByField, formatStudentName } from "../utils/student";

/**
 * Exposes student display and sorting preferences.
 *
 * - `formatName(student)` formats a name using the selected preference.
 * - `compareFn` provides the comparator used by Array.sort().
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
