import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setAiModel } from "../../app/store";
import { DEFAULT_WEBLLM_MODEL, WEBLLM_MODELS } from "./webllmModels";

const WEBLLM_MODELS_SOURCES = [
  "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@latest/lib/index.js",
  "https://raw.githubusercontent.com/mlc-ai/web-llm/main/src/config.ts"
];

type AvailableModel = {
  id: string;
  sizeGB?: number;
};

function extractModelsFromText(sourceText: string): AvailableModel[] {
  const matches = Array.from(sourceText.matchAll(/model_id:\s*"([^"]+)"/g));
  const modelById = new Map<string, AvailableModel>();

  for (let i = 0; i < matches.length; i += 1) {
    const modelId = matches[i]?.[1]?.trim();
    if (!modelId) {
      continue;
    }
    const start = matches[i]?.index ?? 0;
    const end = matches[i + 1]?.index ?? sourceText.length;
    const chunk = sourceText.slice(start, end);
    const vramMatch = chunk.match(/vram_required_MB:\s*([0-9.]+)/);
    const vramMB = vramMatch ? Number(vramMatch[1]) : undefined;
    const sizeGB = Number.isFinite(vramMB) && vramMB ? vramMB / 1024 : undefined;

    modelById.set(modelId, {
      id: modelId,
      sizeGB
    });
  }

  return Array.from(modelById.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function formatModelLabel(model: AvailableModel): string {
  if (!model.sizeGB) {
    return `${model.id} (N/D)`;
  }
  return `${model.id} (~${model.sizeGB.toFixed(2)} GB)`;
}

export function AIAssistantPage() {
  const dispatch = useAppDispatch();
  const aiModel = useAppSelector((state) => state.app.aiModel);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>(
    WEBLLM_MODELS.map((id) => ({ id }))
  );
  const [modelSearch, setModelSearch] = useState("");
  const [isLoadingModelList, setIsLoadingModelList] = useState(false);
  const [status, setStatus] = useState("");

  const searchTerm = modelSearch.trim().toLowerCase();
  const filteredModels = searchTerm
    ? availableModels.filter((model) => model.id.toLowerCase().includes(searchTerm))
    : availableModels;
  const selectedModel = availableModels.find((model) => model.id === aiModel);
  const modelsToShow =
    selectedModel && !filteredModels.some((model) => model.id === selectedModel.id)
      ? [selectedModel, ...filteredModels]
      : filteredModels;

  const loadModelListFromInternet = async (): Promise<void> => {
    setIsLoadingModelList(true);
    setStatus("Descargando lista de modelos WebLLM...");
    try {
      let remoteModels: AvailableModel[] = [];
      for (const source of WEBLLM_MODELS_SOURCES) {
        try {
          const response = await fetch(source, { cache: "no-store" });
          if (!response.ok) {
            continue;
          }
          const text = await response.text();
          remoteModels = extractModelsFromText(text);
          if (remoteModels.length > 0) {
            break;
          }
        } catch {
          continue;
        }
      }
      if (remoteModels.length === 0) {
        setStatus("No se encontraron modelos remotos. Se mantiene la lista local.");
        return;
      }
      setAvailableModels(remoteModels);
      if (!remoteModels.some((model) => model.id === aiModel)) {
        dispatch(setAiModel(remoteModels[0]?.id ?? DEFAULT_WEBLLM_MODEL));
      }
      const withSize = remoteModels.filter((model) => Boolean(model.sizeGB)).length;
      setStatus(`Lista de modelos cargada (${remoteModels.length}, con tamaño en ${withSize}).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setStatus(`No se pudo descargar la lista de modelos (${message}).`);
    } finally {
      setIsLoadingModelList(false);
    }
  };

  useEffect(() => {
    void loadModelListFromInternet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="module-card">
      <h2>Configuración IA (WebLLM)</h2>

      <div className="metric-grid">
        <article className="metric-item">
          <strong>Estado IA</strong>
          <div>Disponible</div>
        </article>
        <article className="metric-item">
          <strong>Proveedor</strong>
          <div>WebLLM local</div>
        </article>
      </div>

      <div className="detail-section">
        <h5>Modelo</h5>
        <div className="inline-form">
          <input
            className="input"
            type="search"
            value={modelSearch}
            onChange={(event) => setModelSearch(event.target.value)}
            placeholder="Buscar modelo..."
          />
          <select
            className="input"
            value={aiModel}
            onChange={(event) => dispatch(setAiModel(event.target.value))}
          >
            {modelsToShow.map((model) => (
              <option key={model.id} value={model.id}>
                {formatModelLabel(model)}
              </option>
            ))}
            {modelsToShow.length === 0 ? <option value="">Sin resultados</option> : null}
          </select>
          <button
            type="button"
            className="btn secondary"
            disabled={isLoadingModelList}
            onClick={() => void loadModelListFromInternet()}
          >
            {isLoadingModelList ? "Descargando..." : "Actualizar lista modelos"}
          </button>
        </div>
        {status ? <p className="hint">{status}</p> : null}
      </div>
    </section>
  );
}


