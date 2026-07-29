import { NavLink } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="not-found-page" aria-labelledby="not-found-title">
      <h1 id="not-found-title">Página no encontrada</h1>
      <p>La dirección no corresponde a ninguna sección de ProfePlus.</p>
      <NavLink className="btn primary" to="/today">
        Volver a Hoy
      </NavLink>
    </section>
  );
}
