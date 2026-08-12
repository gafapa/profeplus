import { NavLink } from "react-router-dom";

interface NoContextBannerProps {
  noClass: boolean;
  noSubject: boolean;
}

/**
 * Guides the teacher to management when no course or subject is selected.
 */
export function NoContextBanner({ noClass, noSubject }: NoContextBannerProps) {
  if (!noClass && !noSubject) return null;

  return (
    <div
      className={`no-context-banner${noClass ? " setup" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="no-context-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
      </span>
      <div className="no-context-text">
        {noClass ? (
          <>
            <strong>Necesitas crear un grupo para usar esta pantalla.</strong>
            <span>Cuando lo guardes, podrás añadir el alumnado, el horario y las asignaturas.</span>
          </>
        ) : (
          <>
            <strong>Este curso necesita una asignatura activa.</strong>
            <span>Selecciona, añade o vincula una asignatura al curso para empezar a trabajar.</span>
          </>
        )}
      </div>
      <NavLink
        to={noClass ? "/management/courses?onboarding=1" : "/management/subjects"}
        className="no-context-cta"
      >
        {noClass ? "Crear el primer grupo" : "Gestionar asignaturas"}
      </NavLink>
    </div>
  );
}
