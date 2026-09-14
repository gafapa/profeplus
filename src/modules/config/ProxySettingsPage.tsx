import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { proxyMessage } from "../../shared/backup/nextcloud";
import "./ProxySettingsPage.css";

export function ProxySettingsPage() {
  const [state, setState] = useState<"idle" | "checking" | "available" | "missing">("idle");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const checkExtension = async () => {
    if (controller.current) return;
    const operation = new AbortController();
    controller.current = operation;
    setState("checking");
    try {
      await proxyMessage("bridge-ping", undefined, operation.signal);
      if (!operation.signal.aborted) setState("available");
    } catch {
      if (!operation.signal.aborted) setState("missing");
    } finally {
      if (controller.current === operation) controller.current = null;
    }
  };

  return <article className="management-card proxy-settings-page">
    <header className="ai-settings-heading">
      <h1>Extensión Proxy</h1>
      <p>Conecta Edunoza con Nextcloud, Moodle y Ollama. Las copias en este dispositivo funcionan sin la extensión.</p>
    </header>
    <section aria-labelledby="proxy-check-heading">
      <h2 id="proxy-check-heading">Comprobar la extensión</h2>
      <p>Esta comprobación solo contacta con la extensión en este navegador: no envía credenciales ni datos académicos.</p>
      <button type="button" className="btn" disabled={state === "checking"} onClick={() => void checkExtension()}>
        {state === "checking" ? "Comprobando…" : "Comprobar extensión"}
      </button>
      <p role="status" aria-live="polite">
        {state === "idle" && "Pulsa el botón para comprobar si Proxy responde."}
        {state === "checking" && "Esperando respuesta de Proxy…"}
        {state === "available" && "Extensión Proxy detectada. Esto no comprueba los permisos ni la conexión con cada servicio; pruébalos en su pantalla."}
        {state === "missing" && "No se detecta Proxy. Instálala o comprueba que está activada y autorizada para Edunoza; después vuelve a comprobar."}
      </p>
    </section>
    <section aria-labelledby="proxy-install-heading">
      <h2 id="proxy-install-heading">Instalación y permisos</h2>
      <ol>
        <li><a href="https://proxy.gallego.top/" target="_blank" rel="noopener noreferrer">Descargar Proxy (se abre en otra pestaña)</a> e instalarla siguiendo las instrucciones de su página.</li>
        <li>En las opciones de la extensión, autoriza <strong>edunoza.com</strong> y los métodos que necesites según el servicio. Si usas varios, conserva los permisos de todos.</li>
        <li>Recarga Edunoza y pulsa «Comprobar extensión». Después prueba la conexión desde la pantalla del servicio.</li>
      </ol>
      <dl>
        <dt><Link to="/config/database/nextcloud">Nextcloud</Link></dt>
        <dd>Permite GET, PROPFIND, MKCOL y PUT hacia tu servidor HTTPS. No necesita acceso a la red local.</dd>
        <dt><Link to="/config/moodle">Moodle</Link></dt>
        <dd>Permite POST hacia la dirección HTTPS de Moodle. Las consultas son de solo lectura; POST no significa que se modifiquen datos.</dd>
        <dt><Link to="/config/ai">Ollama</Link></dt>
        <dd>Permite GET y POST y activa el acceso a la red local para Edunoza. Mantén Ollama abierto en este dispositivo; no necesitas configurar OLLAMA_ORIGINS ni exponerlo a Internet.</dd>
      </dl>
    </section>
    <details>
      <summary>Límites y problemas de conexión</summary>
      <p>Proxy limita por defecto los envíos a 1 MiB. Para copias o informes mayores, ajusta el límite de petición al tamaño necesario, hasta 10 MiB, y el de respuesta a al menos 10 MiB. El tiempo de espera puede ampliarse hasta 120 segundos.</p>
      <p>Si acabas de instalar o actualizar la extensión, recarga Edunoza. Si se detecta pero falla un servicio, revisa sus permisos, la dirección del servidor y las credenciales en la pantalla correspondiente.</p>
    </details>
    <details>
      <summary>Qué puede leer la extensión</summary>
      <p>Instala únicamente una extensión de confianza. Proxy puede leer el token y las respuestas de Moodle y, si eliges obtener el token con usuario y contraseña, también esas credenciales. Además, puede leer los textos y respuestas de Ollama.</p>
      <p>En Nextcloud recibe las credenciales y el archivo ya cifrado, pero nunca la contraseña de cifrado. La comprobación de esta pestaña no accede a esos servicios.</p>
    </details>
  </article>;
}
