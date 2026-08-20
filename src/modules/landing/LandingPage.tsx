import { NavLink } from "react-router-dom";
import { trackAnalyticsEvent } from "../../shared/analytics/analytics";
import { ProductFeedback } from "../../shared/feedback/ProductFeedback";

function ProductMark() {
  return (
    <span className="landing-product-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <path d="M10 12h20a8 8 0 0 1 8 8v18H18a8 8 0 0 1-8-8z" />
        <path d="M18 20h12M18 27h8M35 8v12M29 14h12" />
      </svg>
    </span>
  );
}

export function LandingPage() {
  return (
    <div className="landing-page">
      <a className="skip-link" href="#landing-main">Saltar al contenido principal</a>
      <header className="landing-header">
        <NavLink className="landing-brand" to="/" aria-label="ProfePlus, inicio">
          <ProductMark />
          <span>ProfePlus</span>
        </NavLink>
        <nav aria-label="Presentación">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#privacidad">Privacidad</a>
          <NavLink
            className="landing-header-action"
            to="/today"
            onClick={() => trackAnalyticsEvent("landing_workspace_open")}
          >
            Abrir mi espacio
          </NavLink>
        </nav>
      </header>

      <main id="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <h1 id="landing-title">Tu jornada docente, ordenada sin entregar los datos de tu aula.</h1>
            <p>
              Planifica, pasa lista, registra evidencias y prepara informes en un espacio privado que funciona desde tu navegador.
            </p>
            <div className="landing-hero-actions">
              <NavLink
                className="landing-primary-action"
                to="/today"
                onClick={() => trackAnalyticsEvent("landing_workspace_open")}
              >
                Empezar sin cuenta
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
              </NavLink>
              <a className="landing-secondary-action" href="#como-funciona">Ver el flujo completo</a>
            </div>
            <ul className="landing-trust-list" aria-label="Compromisos principales">
              <li><span aria-hidden="true">✓</span> Sin registro</li>
              <li><span aria-hidden="true">✓</span> Copias cifradas</li>
              <li><span aria-hidden="true">✓</span> Funciona sin conexión</li>
            </ul>
          </div>

          <section className="landing-product-demo" aria-label="Demostración simulada de la jornada">
            <div className="landing-demo-topbar">
              <span>Ejemplo simulado</span>
              <strong>Hoy · 10:15</strong>
            </div>
            <div className="landing-demo-session">
              <div>
                <span>3.º ESO B · Biología</span>
                <h2>Ecosistemas y cadenas tróficas</h2>
              </div>
              <span className="landing-demo-state">En curso</span>
            </div>
            <div className="landing-demo-body">
              <div className="landing-demo-register">
                <strong>Registro de clase</strong>
                <p>Trabajo por equipos completado. Repasar productores y consumidores al inicio de la próxima sesión.</p>
                <span>Guardado localmente</span>
              </div>
              <div className="landing-demo-attendance" aria-label="Asistencia de ejemplo">
                <div><strong>Ana L.</strong><span className="present">P</span></div>
                <div><strong>Diego M.</strong><span className="late">R</span></div>
                <div><strong>Lucía R.</strong><span className="present">P</span></div>
              </div>
            </div>
            <div className="landing-demo-save"><span>Asistencia y registro listos</span><strong>Clase guardada</strong></div>
          </section>
        </section>

        <section className="landing-proof-strip" aria-label="Características verificables">
          <span><strong>Local-first</strong>Los registros permanecen en tu dispositivo.</span>
          <span><strong>Una jornada</strong>Asistencia, trabajo y notas en el mismo flujo.</span>
          <span><strong>Recuperable</strong>Exportación cifrada y restauración validada.</span>
        </section>

        <section className="landing-workflow" id="como-funciona" aria-labelledby="workflow-title">
          <div className="landing-section-heading">
            <h2 id="workflow-title">Del horario al informe, sin duplicar el trabajo</h2>
            <p>Cada dato tiene un lugar principal y reaparece donde lo necesitas.</p>
          </div>
          <ol className="landing-workflow-line">
            <li><span>Preparar</span><strong>Planifica la semana y asigna tareas a cada sesión.</strong><small>Planificador · Unidades · Tareas</small></li>
            <li><span>Impartir</span><strong>Pasa lista y registra lo que ocurrió realmente.</strong><small>Hoy · Aula · Agenda</small></li>
            <li><span>Evaluar</span><strong>Recoge evidencias y consolida calificaciones.</strong><small>Evaluación · Cuaderno</small></li>
            <li><span>Dar seguimiento</span><strong>Conecta asistencia, tutoría e informes.</strong><small>Seguimiento · Familias · Informes</small></li>
          </ol>
        </section>

        <section className="landing-privacy" id="privacidad" aria-labelledby="privacy-title">
          <div className="landing-privacy-copy">
            <h2 id="privacy-title">Privacidad que se entiende antes de empezar</h2>
            <p>
              ProfePlus no necesita una cuenta ni un servidor académico. Los datos se guardan en el perfil de tu navegador y solo salen cuando tú exportas, compartes o autorizas una función externa.
            </p>
            <NavLink className="landing-secondary-action" to="/config/database">Ver copias y recuperación</NavLink>
          </div>
          <dl className="landing-privacy-facts">
            <div><dt>Datos académicos</dt><dd>Solo en este navegador</dd></div>
            <div><dt>Analítica</dt><dd>Eventos generales, sin contenido ni identificadores</dd></div>
            <div><dt>Copias</dt><dd>AES-256-GCM con contraseña elegida por ti</dd></div>
            <div><dt>IA</dt><dd>Confirmación explícita antes de enviar información</dd></div>
          </dl>
        </section>

        <section className="landing-close" aria-labelledby="landing-close-title">
          <div>
            <h2 id="landing-close-title">Empieza con tu próxima clase.</h2>
            <p>No necesitas registrarte. El asistente te ayudará a preparar el primer curso.</p>
          </div>
          <NavLink
            className="landing-primary-action"
            to="/today"
            onClick={() => trackAnalyticsEvent("landing_workspace_open")}
          >
            Abrir ProfePlus
          </NavLink>
        </section>
      </main>

      <footer className="landing-footer">
        <span>ProfePlus · Cuaderno docente local-first</span>
        <ProductFeedback placement="inline" />
      </footer>
    </div>
  );
}
