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
    <div className="no-context-banner" role="status" aria-live="polite">
      <span className="no-context-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
      </span>
      <div className="no-context-text">
        {noClass ? (
          <>
            <strong>No hay ningún curso creado.</strong>
            <span>Crea un curso en Gestión para poder usar el panel docente.</span>
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
        {noClass ? "Empezar preparación" : "Gestionar asignaturas"}
      </NavLink>
    </div>
  );
}
