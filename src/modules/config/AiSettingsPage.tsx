import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AI_PROVIDER_DEFINITIONS,
  clearAiCredential,
  testAiConnection,
  getAiCredentialPersistence,
  getAiErrorMessage,
  getAiProviderDefinition,
  listAiModelDetails,
  loadAiConfiguration,
  saveAiConfiguration,
  type AiConfiguration,
  type AiModelInfo,
  type AiProviderId
} from "../../shared/ai/runtime";

type PendingAction = "save" | "models" | "test" | null;
type NoticeTone = "neutral" | "success" | "error";

function providerOptionLabel(provider: AiProviderId): string {
  const definition = getAiProviderDefinition(provider);
  return `${definition.label} · ${definition.location === "cloud" ? "nube" : "local"}`;
}

function initialProvider(configuration: AiConfiguration): AiProviderId {
  return configuration.provider ?? "openrouter";
}

const capabilityLabels: Record<string, string> = {
  audio_input: "Entrada de audio",
  batch: "Procesamiento por lotes",
  citations: "Citas",
  code_execution: "Ejecución de código",
  context_management: "Gestión del contexto",
  effort: "Nivel de esfuerzo",
  image_input: "Entrada de imágenes",
  pdf_input: "Lectura de PDF",
  reasoning: "Razonamiento",
  structured_outputs: "Salida estructurada",
  text_input: "Entrada de texto",
  text_output: "Salida de texto",
  thinking: "Pensamiento extendido",
  tool_use: "Uso de herramientas"
};

const integerFormatter = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const priceFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4
});
const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

function formatTokenCount(value: number): string {
  return `${integerFormatter.format(value)} tokens`;
}

function formatPrice(value: number): string {
  return value === 0 ? "Gratis" : `${priceFormatter.format(value)} US$ / 1 M tokens`;
}

function formatFileSize(value: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1_024 && unitIndex < units.length - 1) {
    size /= 1_024;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: size >= 10 ? 1 : 2 }).format(size)} ${units[unitIndex]}`;
}

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function modelFacts(model: AiModelInfo): Array<{ label: string; value: string }> {
  return [
    model.owner ? { label: "Proveedor del modelo", value: model.owner } : null,
    model.contextWindow !== undefined ? { label: "Ventana de contexto", value: formatTokenCount(model.contextWindow) } : null,
    model.maxOutputTokens !== undefined ? { label: "Salida máxima", value: formatTokenCount(model.maxOutputTokens) } : null,
    model.inputPricePerMillionUsd !== undefined ? { label: "Precio de entrada", value: formatPrice(model.inputPricePerMillionUsd) } : null,
    model.outputPricePerMillionUsd !== undefined ? { label: "Precio de salida", value: formatPrice(model.outputPricePerMillionUsd) } : null,
    model.sizeBytes !== undefined ? { label: "Tamaño en disco", value: formatFileSize(model.sizeBytes) } : null,
    model.parameterSize ? { label: "Parámetros", value: model.parameterSize } : null,
    model.quantization ? { label: "Cuantización", value: model.quantization } : null,
    model.family ? { label: "Arquitectura", value: model.family } : null,
    model.format ? { label: "Formato", value: model.format.toUpperCase() } : null,
    model.createdAt ? { label: "Publicado", value: formatDate(model.createdAt) } : null,
    model.modifiedAt ? { label: "Actualizado", value: formatDate(model.modifiedAt) } : null
  ].filter((fact): fact is { label: string; value: string } => fact !== null);
}

export function AiSettingsPage() {
  const initialConfiguration = useMemo(() => loadAiConfiguration(), []);
  const initialProviderId = initialProvider(initialConfiguration);
  const initialDefinition = getAiProviderDefinition(initialProviderId);
  const [savedConfiguration, setSavedConfiguration] = useState(initialConfiguration);
  const [selectedProvider, setSelectedProvider] = useState<AiProviderId>(initialProviderId);
  const [selectedModel, setSelectedModel] = useState(
    initialConfiguration.model ?? initialDefinition.defaultModel
  );
  const [baseUrl, setBaseUrl] = useState(
    initialConfiguration.baseUrl ?? initialDefinition.defaultBaseUrl ?? ""
  );
  const [apiKey, setApiKey] = useState("");
  const [credentialPersistence, setCredentialPersistence] = useState(
    initialConfiguration.credentialPersistence
  );
  const [rememberApiKey, setRememberApiKey] = useState(
    initialConfiguration.credentialPersistence === "device"
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [ollamaHelpOpen, setOllamaHelpOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [notice, setNotice] = useState(
    initialConfiguration.provider
      ? "La configuración se aplica a informes, rúbricas y listas de cotejo."
      : "Elige un proveedor, añade sus datos y guarda la configuración."
  );
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("neutral");

  const providerDefinition = getAiProviderDefinition(selectedProvider);
  const selectedModelInfo = useMemo(
    () => models.find((model) => model.id === selectedModel.trim()),
    [models, selectedModel]
  );
  const selectedModelFacts = selectedModelInfo ? modelFacts(selectedModelInfo) : [];
  const hasSavedCredential = !providerDefinition.requiresApiKey || credentialPersistence !== "none";
  const savedMatchesDraft = savedConfiguration.provider === selectedProvider &&
    savedConfiguration.model === selectedModel.trim() &&
    (providerDefinition.location === "cloud" || savedConfiguration.baseUrl === baseUrl.trim());
  const configurationReady = savedMatchesDraft && hasSavedCredential;
  const isBusy = pendingAction !== null;

  const selectProvider = (provider: AiProviderId): void => {
    const definition = getAiProviderDefinition(provider);
    const isSavedProvider = savedConfiguration.provider === provider;
    const nextPersistence = getAiCredentialPersistence(provider);
    setSelectedProvider(provider);
    setSelectedModel(isSavedProvider ? savedConfiguration.model ?? definition.defaultModel : definition.defaultModel);
    setBaseUrl(isSavedProvider ? savedConfiguration.baseUrl ?? definition.defaultBaseUrl ?? "" : definition.defaultBaseUrl ?? "");
    setApiKey("");
    setCredentialPersistence(nextPersistence);
    setRememberApiKey(nextPersistence === "device");
    setShowApiKey(false);
    setModels([]);
    setOllamaHelpOpen(false);
    setNotice("Completa los datos del proveedor y guarda los cambios.");
    setNoticeTone("neutral");
  };

  const saveDraft = (): AiConfiguration => {
    const saved = saveAiConfiguration({
      provider: selectedProvider,
      model: selectedModel,
      ...(providerDefinition.location === "local" ? { baseUrl } : {}),
      ...(apiKey.trim() ? { apiKey } : {}),
      rememberApiKey
    });
    setSavedConfiguration(saved);
    setSelectedModel(saved.model ?? "");
    setBaseUrl(saved.baseUrl ?? "");
    setCredentialPersistence(saved.credentialPersistence);
    setApiKey("");
    setShowApiKey(false);
    return saved;
  };

  const saveConfiguration = (): void => {
    setPendingAction("save");
    try {
      const saved = saveDraft();
      setNotice(
        saved.credentialPersistence === "device"
          ? "Configuración guardada. La clave queda recordada en este perfil del navegador."
          : saved.credentialPersistence === "session"
            ? "Configuración guardada. La clave se borrará al finalizar la sesión del navegador."
            : "Configuración local guardada."
      );
      setNoticeTone("success");
    } catch (error) {
      setNotice(getAiErrorMessage(error));
      setNoticeTone("error");
    } finally {
      setPendingAction(null);
    }
  };

  const discoverModels = async (): Promise<void> => {
    setPendingAction("models");
    setNotice("Consultando los modelos disponibles…");
    setNoticeTone("neutral");
    try {
      const availableModels = await listAiModelDetails({
        provider: selectedProvider,
        ...(providerDefinition.location === "local" ? { baseUrl } : {}),
        ...(apiKey.trim() ? { apiKey } : {})
      });
      setModels(availableModels);
      if (availableModels.length === 0) {
        setNotice("El proveedor respondió, pero no devolvió ningún modelo. Puedes escribir su identificador manualmente.");
        setNoticeTone("neutral");
      } else {
        if (!selectedModel.trim()) setSelectedModel(availableModels[0]?.id ?? "");
        const modelCount = availableModels.length.toLocaleString("es-ES");
        setNotice(`Catálogo actualizado: ${modelCount} ${availableModels.length === 1 ? "modelo disponible" : "modelos disponibles"}.`);
        setNoticeTone("success");
      }
    } catch (error) {
      setModels([]);
      if (selectedProvider === "ollama") setOllamaHelpOpen(true);
      setNotice(getAiErrorMessage(error));
      setNoticeTone("error");
    } finally {
      setPendingAction(null);
    }
  };

  const testConnection = async (): Promise<void> => {
    setPendingAction("test");
    setNotice("Guardando y probando la conexión sin enviar datos académicos…");
    setNoticeTone("neutral");
    try {
      saveDraft();
      const result = await testAiConnection();
      setNotice(`Conexión correcta con ${getAiProviderDefinition(result.provider).label} · ${result.model}.`);
      setNoticeTone("success");
    } catch (error) {
      if (selectedProvider === "ollama") setOllamaHelpOpen(true);
      setNotice(getAiErrorMessage(error));
      setNoticeTone("error");
    } finally {
      setPendingAction(null);
    }
  };

  const forgetCredential = (): void => {
    clearAiCredential(selectedProvider);
    setApiKey("");
    setCredentialPersistence("none");
    setRememberApiKey(false);
    setNotice("La clave API se ha eliminado de este navegador.");
    setNoticeTone("success");
  };

  return (
    <article className="management-card ai-settings-page">
      <header className="ai-settings-heading">
        <h1>Inteligencia artificial</h1>
        <p>
          Ollama se conecta mediante la extensión Proxy; los demás proveedores, directamente desde el navegador.
          Las solicitudes no pasan por los servidores de Edunoza.
        </p>
      </header>

      <section
        className={`ai-connection-state ${configurationReady ? "ready" : "unavailable"}`}
        aria-labelledby="ai-connection-title"
      >
        <span className="ai-connection-indicator" aria-hidden="true" />
        <div>
          <h2 id="ai-connection-title">
            {configurationReady ? "IA configurada" : "Configuración pendiente"}
          </h2>
          <p>
            {configurationReady
              ? `${providerOptionLabel(selectedProvider)} · ${selectedModel}`
              : "Guarda un proveedor, un modelo y, si corresponde, su clave API."}
          </p>
        </div>
        <span className="ai-direct-badge">{selectedProvider === "ollama" ? "Conexión mediante Proxy" : "Conexión directa"}</span>
      </section>

      <form
        className="detail-section ai-configuration-form"
        onSubmit={(event) => {
          event.preventDefault();
          saveConfiguration();
        }}
      >
        <div className="ai-section-heading">
          <div>
            <h2>Proveedor y modelo</h2>
            <p className="hint">Esta selección se utiliza en todas las funciones de IA de Edunoza.</p>
          </div>
          <span>{providerDefinition.location === "cloud" ? "Servicio en la nube" : "En este dispositivo"}</span>
        </div>

        <div className="ai-provider-form">
          <label className="detail-field compact-field">
            <span>Proveedor</span>
            <select
              className="input"
              value={selectedProvider}
              disabled={isBusy}
              onChange={(event) => selectProvider(event.target.value as AiProviderId)}
            >
              {AI_PROVIDER_DEFINITIONS.map((provider) => (
                <option key={provider.id} value={provider.id}>{providerOptionLabel(provider.id)}</option>
              ))}
            </select>
          </label>

          <label className="detail-field compact-field">
            <span>Modelo</span>
            <input
              className="input"
              type="text"
              value={selectedModel}
              list="ai-model-options"
              maxLength={300}
              required
              disabled={isBusy}
              placeholder={providerDefinition.location === "local" ? "Ejemplo: llama3.2" : "Identificador del modelo"}
              onChange={(event) => setSelectedModel(event.target.value)}
              aria-describedby="ai-model-help"
            />
            <small id="ai-model-help" className="hint">
              Actualiza el catálogo para ver los modelos y sus datos, o escribe un identificador manualmente.
            </small>
            <datalist id="ai-model-options">
              {models.map((model) => (
                <option key={model.id} value={model.id} label={model.name} />
              ))}
            </datalist>
          </label>
        </div>

        {models.length > 0 ? (
          <section className="ai-model-catalog" aria-labelledby="ai-model-catalog-title">
            {selectedModelInfo ? (
              <>
                <div className="ai-model-catalog-heading">
                  <div>
                    <h3 id="ai-model-catalog-title">{selectedModelInfo.name ?? selectedModelInfo.id}</h3>
                    {selectedModelInfo.name ? <code>{selectedModelInfo.id}</code> : null}
                  </div>
                  <span>Información del proveedor</span>
                </div>
                {selectedModelInfo.description ? (
                  <p className="ai-model-description">{selectedModelInfo.description}</p>
                ) : null}
                {selectedModelFacts.length > 0 ? (
                  <dl className="ai-model-facts">
                    {selectedModelFacts.map((fact) => (
                      <div key={fact.label}>
                        <dt>{fact.label}</dt>
                        <dd>{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {selectedModelInfo.capabilities?.length ? (
                  <div className="ai-model-capabilities">
                    <h4>Capacidades declaradas</h4>
                    <ul>
                      {selectedModelInfo.capabilities.map((capability) => (
                        <li key={capability}>{capabilityLabels[capability] ?? capability.replaceAll("_", " ")}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {!selectedModelInfo.description && selectedModelFacts.length === 0 && !selectedModelInfo.capabilities?.length ? (
                  <p className="ai-model-description">El proveedor solo publica el identificador de este modelo.</p>
                ) : null}
              </>
            ) : (
              <div className="ai-model-catalog-empty">
                <h3 id="ai-model-catalog-title">Modelo escrito manualmente</h3>
                <p>Ese identificador no aparece en el catálogo actualizado. Puedes guardarlo si sabes que el proveedor lo admite.</p>
              </div>
            )}
          </section>
        ) : null}

        {providerDefinition.requiresApiKey ? (
          <div className="ai-credential-block">
            <div className="ai-credential-row">
              <div className="detail-field compact-field">
                <label htmlFor="ai-api-key">Clave API</label>
                <span className="ai-secret-input">
                  <input
                    id="ai-api-key"
                    className="input"
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    disabled={isBusy}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={2000}
                    placeholder={credentialPersistence === "none" ? "Pega aquí tu clave" : "Hay una clave guardada; déjalo vacío para conservarla"}
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={isBusy || !apiKey}
                    aria-label={showApiKey ? "Ocultar clave API" : "Mostrar clave API"}
                    onClick={() => setShowApiKey((visible) => !visible)}
                  >
                    {showApiKey ? "Ocultar" : "Mostrar"}
                  </button>
                </span>
              </div>
              <div className="ai-credential-meta">
                <a href={providerDefinition.credentialUrl} target="_blank" rel="noreferrer">
                  Abrir página de claves de {providerDefinition.label}
                </a>
                {credentialPersistence !== "none" ? (
                  <button type="button" className="ai-text-button" disabled={isBusy} onClick={forgetCredential}>
                    Eliminar la clave guardada
                  </button>
                ) : null}
              </div>
            </div>
            <label className="ai-persistence-option">
              <input
                type="checkbox"
                checked={rememberApiKey}
                disabled={isBusy}
                onChange={(event) => setRememberApiKey(event.target.checked)}
              />
              <span>
                <strong>Recordar la clave en este dispositivo</strong>
                <small>
                  Si no marcas esta opción, la clave se conserva solo durante la sesión del navegador.
                </small>
              </span>
            </label>
          </div>
        ) : (
          <div className="ai-local-provider-block">
            <label className="detail-field compact-field">
              <span>Dirección del servidor local</span>
              <input
                className="input"
                type="url"
                value={baseUrl}
                maxLength={500}
                required
                disabled={isBusy}
                onChange={(event) => setBaseUrl(event.target.value)}
              />
            </label>
            <p>
              Por seguridad solo se admiten <strong>localhost</strong> y <strong>127.0.0.1</strong>.
              {selectedProvider === "ollama" ? " Ollama se conecta mediante la extensión Proxy." : " El servidor debe permitir solicitudes desde https://edunoza.com."}
            </p>
            {selectedProvider === "ollama" ? (
              <details
                className="ai-ollama-help"
                open={ollamaHelpOpen}
                onToggle={(event) => setOllamaHelpOpen(event.currentTarget.open)}
              >
                <summary>
                  <span>
                    <strong>Cómo conectar Ollama con Edunoza</strong>
                    <small>Mantén Ollama abierto y selecciona un modelo de conversación.</small>
                  </span>
                </summary>
                <div className="ai-ollama-help-content">
                  <p>Requiere Proxy. <Link to="/config/proxy">Comprobar e instalar la extensión</Link>.</p>
                  <p>Con Ollama abierto en este dispositivo, pulsa <strong>Actualizar catálogo</strong>, selecciona un modelo de conversación y pulsa <strong>Guardar y probar</strong>.</p>
                  <p>La extensión puede leer los textos enviados a Ollama y sus respuestas. Instala únicamente una extensión de confianza. Los modelos locales se ejecutan en tu dispositivo; no selecciones un modelo remoto si necesitas mantener los datos en local.</p>
                </div>
              </details>
            ) : null}
          </div>
        )}

        <div className="ai-settings-actions">
          <button type="submit" className="btn" disabled={isBusy}>
            {pendingAction === "save" ? "Guardando…" : "Guardar configuración"}
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={isBusy}
            onClick={() => void discoverModels()}
          >
            {pendingAction === "models" ? "Actualizando…" : "Actualizar catálogo"}
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={isBusy}
            onClick={() => void testConnection()}
          >
            {pendingAction === "test" ? "Probando…" : "Guardar y probar"}
          </button>
        </div>

        <p
          className={`ai-operation-notice ${noticeTone}`}
          role={noticeTone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {notice}
        </p>
      </form>

      <section className="detail-section ai-privacy-summary" aria-labelledby="ai-privacy-title">
        <h2 id="ai-privacy-title">Antes de enviar datos</h2>
        <ul>
          <li>La prueba de conexión no incluye información académica.</li>
          <li>Los informes ocultan nombres y excluyen textos libres de forma predeterminada. Revisa los datos antes de enviarlos.</li>
          <li>Edunoza pide confirmación antes de enviar contenido académico.</li>
          <li>Con Ollama, la extensión Proxy transporta los textos y puede leerlos. Los demás proveedores reciben las solicitudes directamente desde el navegador.</li>
          <li>Una clave recordada se guarda sin cifrar en este perfil hasta que la elimines. El bloqueo de Edunoza no cifra las claves; usa la sesión en equipos compartidos.</li>
        </ul>
      </section>
    </article>
  );
}
