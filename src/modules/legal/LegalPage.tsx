import { useEffect, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ProductMark } from "../landing/LandingPage";

const LAST_UPDATED = "3 de septiembre de 2026";

const legalNavigation = [
  { path: "/legal", label: "Información legal" },
  { path: "/aviso-legal", label: "Aviso legal" },
  { path: "/privacidad", label: "Privacidad" },
  { path: "/cookies", label: "Almacenamiento local" },
  { path: "/condiciones", label: "Condiciones de uso" }
] as const;

type LegalDocument = {
  title: string;
  summary: string;
  content: ReactNode;
};

function ContactLink() {
  return <a href="mailto:pablo@gallegofalcon.com">pablo@gallegofalcon.com</a>;
}

function LegalIdentity() {
  return (
    <dl className="legal-identity-list">
      <div><dt>Titular</dt><dd>Pablo Gallego Falcón</dd></div>
      <div><dt>NIF</dt><dd>35320739F</dd></div>
      <div><dt>Domicilio</dt><dd>Conchidos, Cerponzóns nº 8, 36152 Pontevedra, España</dd></div>
      <div><dt>Contacto</dt><dd><ContactLink /></dd></div>
      <div><dt>Sitio web</dt><dd><a href="https://edunoza.com">https://edunoza.com</a></dd></div>
    </dl>
  );
}

function LegalIndex() {
  return (
    <>
      <section>
        <h2>Un servicio sencillo, también en lo legal</h2>
        <p>
          Edunoza es una aplicación gratuita, sin publicidad, sin cuentas de usuario y sin pagos.
          Los datos académicos se guardan en el navegador del docente y no en los servidores de
          Edunoza.
        </p>
      </section>
      <nav className="legal-document-list" aria-label="Documentos legales disponibles">
        <NavLink to="/aviso-legal">
          <span>01</span><strong>Aviso legal</strong>
          <small>Quién es el titular del sitio y las reglas generales de acceso.</small>
        </NavLink>
        <NavLink to="/privacidad">
          <span>02</span><strong>Privacidad</strong>
          <small>Qué información técnica se trata y qué ocurre con los datos académicos.</small>
        </NavLink>
        <NavLink to="/cookies">
          <span>03</span><strong>Almacenamiento local</strong>
          <small>Cookies, IndexedDB, preferencias y funcionamiento sin conexión.</small>
        </NavLink>
        <NavLink to="/condiciones">
          <span>04</span><strong>Condiciones de uso</strong>
          <small>Uso gratuito, responsabilidades, copias de seguridad y servicios externos.</small>
        </NavLink>
      </nav>
      <section>
        <h2>Identificación del titular</h2>
        <LegalIdentity />
      </section>
    </>
  );
}

function LegalNotice() {
  return (
    <>
      <section>
        <h2>1. Titular del sitio</h2>
        <p>
          En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la
          información y de comercio electrónico, se facilita la siguiente información:
        </p>
        <LegalIdentity />
        <p>
          El titular actúa como persona física. No existe una sociedad mercantil detrás de Edunoza,
          ni resultan aplicables datos de inscripción en el Registro Mercantil, autorización
          administrativa previa o colegio profesional.
        </p>
      </section>
      <section>
        <h2>2. Objeto</h2>
        <p>
          Edunoza ofrece gratuitamente herramientas de organización docente para planificar clases,
          registrar asistencia y evidencias, gestionar la evaluación y preparar informes. El acceso
          no exige registro, contratación ni pago, y el servicio no muestra publicidad.
        </p>
      </section>
      <section>
        <h2>3. Propiedad intelectual</h2>
        <p>
          El diseño, el código, la marca y los contenidos propios de Edunoza están protegidos por la
          normativa de propiedad intelectual e industrial. Su disponibilidad pública no concede una
          licencia para copiarlos, transformarlos o explotarlos salvo en los casos permitidos por la
          ley o por una autorización expresa.
        </p>
        <p>
          El docente conserva los derechos y la responsabilidad sobre los contenidos y datos que
          introduce en su navegador.
        </p>
      </section>
      <section>
        <h2>4. Responsabilidad</h2>
        <p>
          Se trabaja para mantener Edunoza disponible, seguro y correcto, pero no se garantiza una
          disponibilidad ininterrumpida ni la ausencia absoluta de errores. El usuario debe conservar
          copias de seguridad cifradas cuando la pérdida de su información pueda afectarle.
        </p>
        <p>
          Nada de lo indicado limita los derechos irrenunciables que reconozca la legislación
          aplicable ni excluye responsabilidades que legalmente no puedan excluirse.
        </p>
      </section>
      <section>
        <h2>5. Legislación aplicable</h2>
        <p>
          Este sitio se rige por la legislación española. Cualquier controversia se someterá a los
          juzgados y tribunales que correspondan conforme a las normas imperativas aplicables.
        </p>
      </section>
    </>
  );
}

function PrivacyPolicy() {
  return (
    <>
      <section>
        <h2>1. Responsable</h2>
        <LegalIdentity />
        <p>No se ha designado delegado de protección de datos.</p>
      </section>
      <section>
        <h2>2. Datos académicos guardados en tu dispositivo</h2>
        <p>
          Los cursos, estudiantes, asistencia, calificaciones, anotaciones y demás información
          académica se almacenan localmente en el perfil de tu navegador. Edunoza no recibe ni guarda
          esos datos en sus servidores y el titular no puede consultarlos.
        </p>
        <p>
          El docente o el centro que decide introducir datos personales del alumnado determina la
          finalidad de ese tratamiento y debe contar con una base jurídica válida, aplicar
          minimización de datos y respetar las normas y políticas de su centro. Edunoza no crea
          cuentas para estudiantes.
        </p>
      </section>
      <section>
        <h2>3. Información tratada al visitar el sitio</h2>
        <div className="legal-table-scroll" tabIndex={0} role="region" aria-label="Tratamientos de datos personales" >
          <table>
            <caption>Tratamientos realizados por el titular de Edunoza</caption>
            <thead>
              <tr><th scope="col">Datos</th><th scope="col">Finalidad y base jurídica</th><th scope="col">Conservación</th></tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Registros técnicos</th>
                <td data-label="Finalidad y base jurídica">
                  Dirección IP, fecha y hora, recurso solicitado, respuesta, protocolo, agente de
                  usuario y, si el navegador lo envía, referencia. Se tratan para proteger el sitio,
                  mantenerlo disponible y diagnosticar incidencias, sobre la base del interés legítimo
                  del titular (art. 6.1.f del RGPD).
                </td>
                <td data-label="Conservación">Un máximo de 30 días, salvo que una incidencia de seguridad exija conservarlos durante su investigación.</td>
              </tr>
              <tr>
                <th scope="row">Eventos generales de producto</th>
                <td data-label="Finalidad y base jurídica">
                  Nombre fijo de una acción general, como abrir una sección o exportar una copia. No
                  incluye contenido académico, búsquedas, identificadores persistentes ni texto libre.
                  Sirve para conocer si las funciones principales resultan útiles, con base en el
                  interés legítimo del titular. Se respetan las señales Do Not Track y Global Privacy Control.
                </td>
                <td data-label="Conservación">Un máximo de 30 días en los registros del servidor.</td>
              </tr>
              <tr>
                <th scope="row">Consultas por correo</th>
                <td data-label="Finalidad y base jurídica">
                  Dirección, nombre y contenido que decidas enviar para responder a tu solicitud. La
                  base es el interés legítimo en atenderla, las medidas precontractuales que solicites
                  o una obligación legal, según corresponda.
                </td>
                <td data-label="Conservación">Mientras se atiende la consulta y, después, durante los plazos necesarios para atender posibles responsabilidades legales.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          No se elaboran perfiles ni se toman decisiones automatizadas con efectos jurídicos o
          similares sobre los visitantes.
        </p>
      </section>
      <section>
        <h2>4. Destinatarios y alojamiento</h2>
        <p>
          La infraestructura principal se aloja en Oracle Cloud Infrastructure, región
          <span lang="en"> eu-frankfurt-1</span>, Alemania. Los proveedores técnicos acceden a la
          información solo cuando sea necesario para prestar y proteger sus servicios y bajo sus
          obligaciones contractuales. También podrá comunicarse información a una autoridad cuando
          exista una obligación legal.
        </p>
        <p>
          El alojamiento principal está en el Espacio Económico Europeo. Si un proveedor necesitara
          realizar un acceso internacional, deberá aplicar las garantías exigidas por el capítulo V
          del RGPD, como una decisión de adecuación o cláusulas contractuales tipo.
        </p>
      </section>
      <section>
        <h2>5. Funciones externas elegidas por el usuario</h2>
        <p>
          Edunoza permite exportar archivos, compartir texto mediante las funciones del navegador y
          conectarse con un proveedor de inteligencia artificial elegido por el usuario.
          Los datos solo salen del navegador cuando el usuario inicia esas acciones. Las funciones de
          IA muestran una confirmación antes de enviar información y, desde ese momento, se aplican
          también las condiciones, la conservación, la localización del tratamiento y la política del
          proveedor elegido. Las solicitudes de IA no pasan por los servidores de Edunoza.
        </p>
        <p>
          Para Ollama, Edunoza utiliza la extensión Proxy del navegador, que puede acceder al texto
          enviado y a las respuestas. Usa una extensión de confianza. Los modelos locales se ejecutan
          en tu dispositivo; los modelos remotos de Ollama pueden enviar datos a servicios externos.
        </p>
        <p>
          Las claves API se conservan por defecto durante la sesión del navegador. El usuario puede
          elegir recordarlas en el almacenamiento local de ese perfil hasta que las elimine. No se
          incluyen en copias de seguridad, analítica ni comunicaciones con el titular de Edunoza.
        </p>
        <p>
          Opcionalmente puedes guardar copias cifradas en tu propio Nextcloud mediante la extensión
          Proxy. El cifrado se realiza en el navegador antes de enviar el archivo. La extensión recibe
          las credenciales de Nextcloud y el archivo cifrado, pero no la contraseña de cifrado. Las
          contraseñas de esta función se mantienen solo mientras está abierta su pantalla, sin
          guardarlas en Edunoza. El servidor elegido conserva el archivo y sus metadatos según sus
          propias condiciones. Tú decides cuándo crear, descargar o eliminar esas copias; no hay
          sincronización automática ni envío de las copias a los servidores de Edunoza.
        </p>
        <p>
          La conexión opcional con Moodle utiliza la extensión Proxy, que recibe el token de acceso
          y los datos intercambiados con el Moodle elegido. Si eliges obtener el token con usuario y
          contraseña, Proxy también recibe esas credenciales y las envía a Moodle; Edunoza no guarda
          la contraseña y la retira del formulario al enviarla. Moodle puede generar el token y registrar
          ese acceso. El token se guarda en este perfil del navegador para reutilizarlo; no se guardan
          el usuario de inicio de sesión ni la contraseña. Desconectar o salir cierra la sesión activa,
          pero conserva el token. Puedes borrarlo con «Borrar token guardado» o al olvidar la conexión.
          El token no se incluye en copias ni se revoca automáticamente en Moodle. Las
          correspondencias entre registros se guardan localmente y se incluyen en las copias cifradas,
          sin el token. El acceso a Moodle es de solo lectura: tú decides qué registros vincular y
          qué información incorporar a Edunoza. Desconectar conserva los datos académicos; olvidar la vinculación elimina sus
          correspondencias. Los datos intercambiados no pasan por los servidores de Edunoza.
        </p>
      </section>
      <section>
        <h2>6. Tus derechos</h2>
        <p>
          Puedes solicitar acceso, rectificación, supresión, oposición, limitación o portabilidad de
          los datos tratados por el titular escribiendo a <ContactLink /> e indicando el derecho que
          deseas ejercer. Podrá pedirse la información imprescindible para verificar tu identidad.
        </p>
        <p>
          También puedes presentar una reclamación ante la
          {" "}<a href="https://www.aepd.es/">Agencia Española de Protección de Datos</a>.
          Los datos académicos locales deben gestionarse desde el propio navegador o ante el docente
          o centro responsable, ya que el titular de Edunoza no dispone de ellos.
        </p>
      </section>
      <section>
        <h2>7. Cambios en esta política</h2>
        <p>
          Esta información se actualizará cuando cambien el servicio, sus tratamientos o la normativa.
          La fecha de la versión vigente aparece al inicio de la página.
        </p>
      </section>
    </>
  );
}

function StoragePolicy() {
  return (
    <>
      <section>
        <h2>1. Edunoza no utiliza cookies</h2>
        <p>
          El sitio no instala cookies propias o de terceros y no emplea almacenamiento para publicidad,
          seguimiento entre sitios ni elaboración de perfiles. Por ese motivo no se muestra un panel
          de consentimiento de cookies.
        </p>
      </section>
      <section>
        <h2>2. Almacenamiento técnico en el navegador</h2>
        <p>
          Para prestar la aplicación solicitada y permitir que funcione sin cuenta y sin un servidor
          académico, Edunoza usa estas tecnologías locales:
        </p>
        <div className="legal-table-scroll" tabIndex={0} role="region" aria-label="Tecnologías de almacenamiento local">
          <table>
            <caption>Almacenamiento utilizado por Edunoza</caption>
            <thead>
              <tr><th scope="col">Tecnología</th><th scope="col">Uso</th><th scope="col">Duración</th></tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">IndexedDB</th>
                <td data-label="Uso">Datos académicos, configuración y recursos que introduces para utilizar el cuaderno docente.</td>
                <td data-label="Duración">Hasta que los eliminas desde Edunoza o borras los datos del sitio en el navegador.</td>
              </tr>
              <tr>
                <th scope="row">localStorage</th>
                <td data-label="Uso">Preferencias de interfaz, configuración opcional del bloqueo local, estado de copias, pasos de bienvenida, borradores académicos locales recuperables durante siete días y, solo si lo eliges expresamente, la clave del proveedor de IA. Los borradores no confirmados no se incluyen en las copias y se descartan al restaurar o eliminar la base de datos.</td>
                <td data-label="Duración">Hasta que cambias la opción correspondiente o borras los datos del sitio.</td>
              </tr>
              <tr>
                <th scope="row">sessionStorage</th>
                <td data-label="Uso">Estados temporales de seguridad, avisos descartados y, por defecto, la clave del proveedor de IA durante la sesión.</td>
                <td data-label="Duración">Normalmente hasta cerrar la pestaña o finalizar la sesión del navegador.</td>
              </tr>
              <tr>
                <th scope="row">Cache Storage y service worker</th>
                <td data-label="Uso">Archivos estáticos de la aplicación necesarios para cargarla con rapidez y trabajar sin conexión.</td>
                <td data-label="Duración">Hasta que el navegador los sustituye o elimina, o hasta que borras los datos del sitio.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Estas tecnologías son propias y necesarias para proporcionar las funciones que el usuario
          solicita o para recordar opciones funcionales elegidas por él. No se usan para seguir su
          actividad fuera de Edunoza.
        </p>
      </section>
      <section>
        <h2>3. Cómo controlarlo</h2>
        <p>
          Puedes eliminar el almacenamiento de Edunoza desde la configuración de privacidad o datos
          del sitio de tu navegador. Al hacerlo se borrarán también los datos académicos locales. Antes
          de eliminarlos, exporta una copia cifrada desde <strong>Configuración → Base de datos</strong>
          si deseas poder recuperarlos.
        </p>
      </section>
      <section>
        <h2>4. Cambios futuros</h2>
        <p>
          Si en el futuro se incorporase una tecnología no necesaria que requiriese consentimiento,
          no se activaría antes de ofrecer información clara y una opción real de aceptar o rechazar.
        </p>
      </section>
    </>
  );
}

function TermsOfUse() {
  return (
    <>
      <section>
        <h2>1. Aceptación y finalidad</h2>
        <p>
          Estas condiciones regulan el acceso a Edunoza. Al utilizar la aplicación aceptas estas reglas.
          El servicio está pensado para docentes adultos que organizan su actividad profesional.
        </p>
      </section>
      <section>
        <h2>2. Servicio gratuito</h2>
        <p>
          Edunoza se ofrece gratuitamente, sin publicidad, suscripción, cuenta de usuario ni compras
          dentro de la aplicación. No existe una contratación de pago ni un proceso de renovación o
          desistimiento asociado al uso actual del servicio.
        </p>
      </section>
      <section>
        <h2>3. Uso responsable de datos académicos</h2>
        <p>
          El usuario decide qué información introduce y es responsable de usarla lícitamente, limitarla
          a lo necesario, proteger el dispositivo y cumplir las políticas de su centro educativo. No
          deben introducirse datos cuando no exista una base jurídica adecuada o cuando las normas del
          centro no permitan almacenarlos en ese dispositivo.
        </p>
      </section>
      <section>
        <h2>4. Conservación y copias de seguridad</h2>
        <p>
          Los datos académicos permanecen en el navegador. Pueden perderse al borrar sus datos, cambiar
          de perfil o dispositivo, desinstalar el navegador o sufrir una avería. El usuario debe exportar
          periódicamente copias cifradas, conservar su contraseña de forma segura y verificar que puede
          restaurarlas.
        </p>
      </section>
      <section>
        <h2>5. Exportaciones, compartición e inteligencia artificial</h2>
        <p>
          Cuando el usuario exporta, comparte o autoriza el envío directo a un servicio de IA, decide
          trasladar esa información fuera de Edunoza. Debe revisar el contenido, evitar datos
          innecesarios y comprobar que el destinatario y el proveedor externo son adecuados para su
          contexto educativo. También debe proteger y rotar sus claves API, especialmente si decide
          recordarlas en el perfil del navegador.
        </p>
      </section>
      <section>
        <h2>6. Usos prohibidos</h2>
        <p>
          No está permitido utilizar el sitio para fines ilícitos, vulnerar derechos de terceros,
          intentar acceder sin autorización a sistemas o datos, introducir código malicioso, eludir
          medidas de seguridad o degradar deliberadamente la disponibilidad del servicio.
        </p>
      </section>
      <section>
        <h2>7. Disponibilidad y cambios</h2>
        <p>
          El servicio puede actualizarse, interrumpirse por mantenimiento o cambiar para corregir
          errores, mejorar su seguridad o adaptar sus funciones. Cuando sea razonable, los cambios
          relevantes se comunicarán en el propio sitio.
        </p>
      </section>
      <section>
        <h2>8. Derechos y responsabilidad</h2>
        <p>
          El usuario mantiene sus derechos sobre la información que introduce. Las limitaciones de
          responsabilidad descritas en el aviso legal no afectan a los derechos irrenunciables ni a
          las responsabilidades que no puedan excluirse conforme a la ley.
        </p>
      </section>
      <section>
        <h2>9. Ley aplicable</h2>
        <p>
          Se aplica la legislación española y serán competentes los juzgados y tribunales que
          determinen las normas imperativas aplicables.
        </p>
      </section>
    </>
  );
}

const legalDocuments: Record<string, LegalDocument> = {
  "/legal": {
    title: "Información legal",
    summary: "Todo lo necesario para entender quién presta Edunoza, cómo funciona y qué ocurre con tus datos.",
    content: <LegalIndex />
  },
  "/aviso-legal": {
    title: "Aviso legal",
    summary: "Información del titular, finalidad del sitio, propiedad intelectual y marco de responsabilidad.",
    content: <LegalNotice />
  },
  "/privacidad": {
    title: "Política de privacidad",
    summary: "Los datos académicos son locales. Aquí explicamos los únicos tratamientos técnicos que sí realiza el sitio.",
    content: <PrivacyPolicy />
  },
  "/cookies": {
    title: "Política de almacenamiento local",
    summary: "Edunoza no utiliza cookies. El almacenamiento del navegador hace posible trabajar sin cuenta y sin servidor académico.",
    content: <StoragePolicy />
  },
  "/condiciones": {
    title: "Condiciones de uso",
    summary: "Condiciones claras para utilizar gratuitamente un cuaderno docente que conserva la información en tu dispositivo.",
    content: <TermsOfUse />
  }
};

export const LEGAL_PATHS = new Set(Object.keys(legalDocuments));

export function LegalPage() {
  const { pathname } = useLocation();
  const document = legalDocuments[pathname] ?? legalDocuments["/legal"];

  useEffect(() => {
    const previousTitle = window.document.title;
    const description = window.document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;

    window.document.title = `${document.title} · Edunoza`;
    if (description) description.content = document.summary;

    return () => {
      window.document.title = previousTitle;
      if (description && previousDescription !== undefined) description.content = previousDescription;
    };
  }, [document]);

  return (
    <div className="legal-page">
      <a className="skip-link" href="#legal-main">Saltar al contenido principal</a>
      <header className="legal-header">
        <NavLink className="landing-brand" to="/" aria-label="Edunoza, inicio">
          <ProductMark />
          <span>Edunoza</span>
        </NavLink>
        <NavLink className="legal-workspace-link" to="/today">Abrir mi espacio</NavLink>
      </header>

      <div className="legal-layout">
        <aside className="legal-sidebar">
          <span className="legal-sidebar-label">Documentos</span>
          <nav aria-label="Navegación legal">
            {legalNavigation.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end
                className={({ isActive }) => isActive ? "active" : undefined}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="legal-main" id="legal-main">
          <header className="legal-title-block">
            <h1>{document.title}</h1>
            <p>{document.summary}</p>
            <small>Última actualización: {LAST_UPDATED}</small>
          </header>
          <article className="legal-article">{document.content}</article>
        </main>
      </div>

      <footer className="legal-footer">
        <span>© 2026 Pablo Gallego Falcón · Edunoza</span>
        <nav aria-label="Enlaces legales del pie">
          {legalNavigation.slice(1).map((item) => <NavLink key={item.path} to={item.path}>{item.label}</NavLink>)}
        </nav>
      </footer>
    </div>
  );
}
