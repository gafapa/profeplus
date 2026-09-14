import { moodleProxyFetch, normalizeMoodleUrl, type ProxyTransport } from "./client";

/** Authentication only; the academic API remains strictly read-only. */
export async function obtainMoodleToken(
  server: string,
  username: string,
  password: string,
  service: string,
  options: { transport?: ProxyTransport; signal?: AbortSignal } = {}
): Promise<string> {
  const endpoint = new URL("login/token.php", normalizeMoodleUrl(server)).href;
  if (!username.trim() || !password) throw new Error("Introduce tu usuario y contraseña de Moodle.");
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(service.trim())) throw new Error("Introduce el nombre corto del servicio web de Moodle.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  const interrupted = () => new Error("La solicitud del token se interrumpió o agotó el tiempo de espera. Vuelve a intentarlo cuando lo necesites.");
  if (options.signal?.aborted) throw interrupted();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = globalThis.setTimeout(abort, 45_000);
  const aborted = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => reject(interrupted()), { once: true });
  });
  try {
    let response;
    try {
      response = await Promise.race([
        (options.transport ?? moodleProxyFetch)({
          url: endpoint,
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Accept: "application/json" },
          body: new URLSearchParams({ username: username.trim(), password, service: service.trim() }).toString(),
          responseType: "text"
        }, controller.signal),
        aborted
      ]);
    } catch {
      if (controller.signal.aborted) throw interrupted();
      throw new Error("No se pudo solicitar el token. Revisa Proxy y la dirección HTTPS de Moodle; puedes usar un token manual.");
    }
    if (controller.signal.aborted) throw interrupted();
    if (response.finalUrl !== endpoint || response.status !== 200 || new TextEncoder().encode(response.bodyText).length > 64 * 1024) {
      throw new Error("Moodle no devolvió una respuesta de acceso válida. Revisa la dirección y utiliza un token manual si el centro exige acceso por navegador.");
    }
    let result: unknown;
    try { result = JSON.parse(response.bodyText); } catch {
      throw new Error("Moodle no devolvió un token. Si utiliza inicio de sesión institucional, solicita un token al administrador.");
    }
    if (typeof result !== "object" || result === null || Array.isArray(result)) throw new Error("La respuesta de acceso de Moodle no es válida.");
    const record = result as Record<string, unknown>;
    // Never display server-supplied messages: they may contain credentials or HTML.
    if (record.error || record.errorcode || record.exception) {
      if (record.errorcode === "invalidlogin") throw new Error("Moodle no aceptó el usuario o la contraseña. Revísalos; si usas acceso institucional o doble factor, utiliza un token manual.");
      throw new Error("Moodle no permite obtener el token con este acceso. Comprueba con el administrador que el servicio está habilitado y autorizado para tu cuenta, o utiliza un token manual.");
    }
    if (typeof record.token !== "string" || !/^[a-zA-Z0-9]{1,256}$/.test(record.token)) {
      throw new Error("Moodle no devolvió un token válido. Puedes introducir un token manual.");
    }
    // Discard privatetoken and all unrelated response fields.
    return record.token;
  } finally {
    globalThis.clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
