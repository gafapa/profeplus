import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  setStudentNameFormat,
  setStudentSortBy,
  setWeekStartsOn,
  type StudentNameFormat,
  type StudentSortBy,
  type WeekStartsOn
} from "../../app/store";

export function ManagementPreferencesPage() {
  const dispatch = useAppDispatch();
  const studentSortBy = useAppSelector((state) => state.app.studentSortBy);
  const studentNameFormat = useAppSelector((state) => state.app.studentNameFormat);
  const weekStartsOn = useAppSelector((state) => state.app.weekStartsOn);

  return (
    <article className="management-card">
      <p className="hint">
        Estas preferencias se guardan en la copia de seguridad.
      </p>

      <section className="detail-section">
        <h5>Ordenar listados de alumnos por</h5>
        <div className="inline-form">
          {(
            [
              { value: "lastName", label: "Apellidos" },
              { value: "firstName", label: "Nombre" }
            ] as { value: StudentSortBy; label: string }[]
          ).map(({ value, label }) => (
            <label key={value} className="pref-radio-label">
              <input
                type="radio"
                name="studentSortBy"
                value={value}
                checked={studentSortBy === value}
                onChange={() => dispatch(setStudentSortBy(value))}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h5>Mostrar nombre del alumno como</h5>
        <div className="inline-form">
          {(
            [
              { value: "firstLast", label: "Nombre Apellidos  (Ana García)" },
              { value: "lastFirst", label: "Apellidos, Nombre  (García, Ana)" }
            ] as { value: StudentNameFormat; label: string }[]
          ).map(({ value, label }) => (
            <label key={value} className="pref-radio-label">
              <input
                type="radio"
                name="studentNameFormat"
                value={value}
                checked={studentNameFormat === value}
                onChange={() => dispatch(setStudentNameFormat(value))}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h5>Empezar la semana en</h5>
        <div className="inline-form">
          {(
            [
              { value: "monday", label: "Lunes" },
              { value: "sunday", label: "Domingo" }
            ] as { value: WeekStartsOn; label: string }[]
          ).map(({ value, label }) => (
            <label key={value} className="pref-radio-label">
              <input
                type="radio"
                name="weekStartsOn"
                value={value}
                checked={weekStartsOn === value}
                onChange={() => dispatch(setWeekStartsOn(value))}
              />
              {label}
            </label>
          ))}
        </div>
      </section>
    </article>
  );
}
