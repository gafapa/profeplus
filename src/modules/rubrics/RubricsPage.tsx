import { useEffect, useMemo, useRef, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import { db } from "../../shared/db/database";
import type { RubricCriterion, RubricLevel, RubricTemplate } from "../../shared/db/types";
import { IconButton } from "../../shared/ui/IconButton";
import { Modal } from "../../shared/ui/Modal";
import { ChecklistsSection } from "./ChecklistsSection";

const WEBLLM_IMPORT_SOURCES = [
  "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@latest/+esm",
  "https://esm.run/@mlc-ai/web-llm"
];
const AI_GENERATION_TIMEOUT_MS = 180000;
const RUBRIC_AI_LOG_PREFIX = "[RubricAI]";

type GeneratedRubric = {
  name?: string;
  description?: string;
  criteria?: Array<{
    name?: string;
    description?: string;
    levels?: Array<{
      name?: string;
      score?: number;
    }>;
  }>;
};

function tryParseGeneratedRubric(text: string): GeneratedRubric | null {
  try {
    return JSON.parse(text) as GeneratedRubric;
  } catch {
    return null;
  }
}

function extractFirstBalancedJSONObject(text: string): string | null {
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") {
      continue;
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let end = start; end < text.length; end += 1) {
      const ch = text[end];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === "\"") {
          inString = false;
        }
        continue;
      }
      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          return text.slice(start, end + 1);
        }
      }
    }
  }
  return null;
}

function normalizeTemplate(template: RubricTemplate): RubricTemplate {
  const criteria = (template.criteria ?? []).map((criterion) => ({
    ...criterion,
    levels: (criterion.levels ?? []).map((level) => ({ ...level, score: Number(level.score) || 0 }))
  }));

  return {
    ...template,
    description: template.description ?? "",
    criteria
  };
}

async function dynamicImport(modulePath: string): Promise<any> {
  const importer = new Function("p", "return import(p)") as (p: string) => Promise<any>;
  return importer(modulePath);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("ha tardado demasiado");
  }
  return false;
}

function logRubricAI(step: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.log(`${RUBRIC_AI_LOG_PREFIX} ${step}`, meta);
    return;
  }
  console.log(`${RUBRIC_AI_LOG_PREFIX} ${step}`);
}

function parseFirstJsonObject(raw: string): GeneratedRubric | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const withoutThinking = trimmed
    // Remove think blocks even when they are not properly closed.
    .replace(/<think>[\s\S]*?(<\/think>|$)/gi, "")
    .trim();

  const withoutCodeFence = withoutThinking
    .replace(/```json/gi, "```")
    .replace(/```([\s\S]*?)```/g, "$1")
    .trim();

  const relaxed = withoutCodeFence
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'");

  const candidates = [
    withoutCodeFence,
    relaxed,
    trimmed,
    trimmed.replace(/<\/?think>/gi, "")
  ];

  for (const candidateText of candidates) {
    const candidate = candidateText.trim();
    if (!candidate) {
      continue;
    }
    const direct = tryParseGeneratedRubric(candidate);
    if (direct) {
      return direct;
    }
    const jsonObject = extractFirstBalancedJSONObject(candidate);
    if (!jsonObject) {
      continue;
    }
    const parsed = tryParseGeneratedRubric(jsonObject);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

function extractMessageText(response: any): string {
  const content = response?.choices?.[0]?.message?.content ?? response?.choices?.[0]?.delta?.content ?? "";
  const normalize = (input: unknown): string => {
    if (typeof input === "string") {
      return input;
    }
    if (Array.isArray(input)) {
      return input
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (!item || typeof item !== "object") {
            return "";
          }
          const typed = item as Record<string, unknown>;
          const itemType = String(typed.type ?? "");
          if (itemType.toLowerCase().includes("reason")) {
            return "";
          }
          if (typeof typed.text === "string") {
            return typed.text;
          }
          return "";
        })
        .join("");
    }
    if (input && typeof input === "object") {
      const obj = input as Record<string, unknown>;
      if (typeof obj.text === "string") {
        return obj.text;
      }
    }
    return String(input ?? "");
  };

  const primaryText = normalize(content);
  const reasoningText =
    normalize(response?.choices?.[0]?.message?.reasoning_content) ||
    normalize(response?.choices?.[0]?.delta?.reasoning_content);

  // In reasoning models, prefer final answer text over reasoning traces.
  if (primaryText.trim().length > 0) {
    return primaryText;
  }
  return reasoningText;
}

function normalizeGeneratedRubric(generated: GeneratedRubric): {
  name: string;
  description: string;
  criteria: RubricCriterion[];
} | null {
  const name = generated.name?.trim() || "";
  const rawCriteria = generated.criteria ?? [];
  const criteria: RubricCriterion[] = rawCriteria
    .map((criterion) => {
      const levels: RubricLevel[] = (criterion.levels ?? [])
        .map((level) => ({
          id: crypto.randomUUID(),
          name: level.name?.trim() || "",
          score: Number(level.score)
        }))
        .filter((level) => level.name.length > 0 && Number.isFinite(level.score));
      return {
        id: crypto.randomUUID(),
        name: criterion.name?.trim() || "",
        description: criterion.description?.trim() || undefined,
        levels
      };
    })
    .filter((criterion) => criterion.name.length > 0 && (criterion.levels?.length ?? 0) >= 2);

  if (name.length < 2 || criteria.length === 0) {
    return null;
  }

  return {
    name,
    description: generated.description?.trim() || "",
    criteria
  };
}

function buildFallbackRubric(theme: string): {
  name: string;
  description: string;
  criteria: RubricCriterion[];
} {
  const levelDefs = [
    { name: "Excelente", score: 4 },
    { name: "Notable", score: 3 },
    { name: "Basico", score: 2 },
    { name: "Inicial", score: 1 }
  ];

  const criteriaNames = ["Dominio del contenido", "Aplicacion practica", "Comunicacion y justificacion"];
  const criteria = criteriaNames.map((criterionName) => ({
    id: crypto.randomUUID(),
    name: criterionName,
    levels: levelDefs.map((level) => ({
      id: crypto.randomUUID(),
      name: level.name,
      score: level.score
    }))
  }));

  return {
    name: `Rubrica: ${theme.slice(0, 60)}`,
    description: `Borrador generado para: ${theme}`,
    criteria
  };
}

export function RubricsPage() {
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const aiModel = useAppSelector((state) => state.app.aiModel);
  const [activeTool, setActiveTool] = useState<"rubrics" | "checklists">("rubrics");
  const [templates, setTemplates] = useState<RubricTemplate[]>([]);
  const [selectedRubricId, setSelectedRubricId] = useState("");
  const [rubricDirty, setRubricDirty] = useState(false);

  const [detailName, setDetailName] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [detailCriteria, setDetailCriteria] = useState<RubricCriterion[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isModelLoadingOpen, setIsModelLoadingOpen] = useState(false);
  const [modelLoadStatus, setModelLoadStatus] = useState("Preparando modelo...");
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const engineRef = useRef<any>(null);

  const loadTemplates = async () => {
    if (!selectedClassId) {
      setTemplates([]);
      return;
    }
    const rows = await db.rubricTemplates.where("classId").equals(selectedClassId).toArray();
    setTemplates(rows.map(normalizeTemplate));
  };

  useEffect(() => {
    void loadTemplates();
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedRubricId && templates.length > 0) {
      setSelectedRubricId(templates[0].id);
      return;
    }
    const exists = templates.some((item) => item.id === selectedRubricId);
    if (!exists && templates.length > 0) {
      setSelectedRubricId(templates[0].id);
    }
    if (templates.length === 0) {
      setSelectedRubricId("");
    }
  }, [selectedRubricId, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedRubricId) ?? null,
    [selectedRubricId, templates]
  );

  useEffect(() => {
    if (!selectedTemplate) {
      setDetailName("");
      setDetailDescription("");
      setDetailCriteria([]);
      setRubricDirty(false);
      return;
    }
    setDetailName(selectedTemplate.name);
    setDetailDescription(selectedTemplate.description ?? "");
    setDetailCriteria(selectedTemplate.criteria ?? []);
    setRubricDirty(false);
  }, [selectedTemplate]);

  useEffect(() => {
    engineRef.current = null;
  }, [aiModel]);

  const persistRubric = async (): Promise<boolean> => {
    if (!selectedTemplate || !rubricDirty) {
      return true;
    }
    const name = detailName.trim();
    const criteria = detailCriteria
      .map((criterion) => ({
        ...criterion,
        name: criterion.name.trim(),
        levels: (criterion.levels ?? [])
          .map((level) => ({ ...level, name: level.name.trim(), score: Number(level.score) }))
          .filter((level) => level.name.length > 0 && !Number.isNaN(level.score))
      }))
      .filter((criterion) => criterion.name.length > 0);

    const valid =
      name.length >= 2 && criteria.length > 0 && criteria.every((criterion) => (criterion.levels?.length ?? 0) >= 2);
    if (!valid) {
      return false;
    }

    await db.rubricTemplates.put({
      ...selectedTemplate,
      name,
      description: detailDescription.trim() || undefined,
      criteria
    });
    setRubricDirty(false);
    await loadTemplates();
    return true;
  };

  const createRubric = async (): Promise<void> => {
    if (!selectedClassId) {
      return;
    }
    const id = crypto.randomUUID();
    await db.rubricTemplates.add({
      id,
      classId: selectedClassId,
      name: "Nueva rubrica",
      description: "",
      criteria: [],
      criteriaCount: 0,
      levelCount: 0
    });
    await loadTemplates();
    setSelectedRubricId(id);
  };

  const removeRubric = async (rubricId: string): Promise<void> => {
    await db.rubricTemplates.delete(rubricId);
    await loadTemplates();
  };

  const generateRubricWithAI = async (): Promise<void> => {
    const startedAt = Date.now();
    logRubricAI("generate.start", {
      selectedClassId,
      selectedRubricId,
      aiModel
    });

    if (!selectedTemplate && !selectedClassId) {
      logRubricAI("generate.blocked.no-class");
      setAiStatus("Selecciona una clase para generar la rubrica.");
      return;
    }

    const theme = aiPrompt.trim();
    if (!theme) {
      logRubricAI("generate.blocked.empty-prompt");
      setAiStatus("Escribe una indicacion para generar la rubrica.");
      return;
    }
    logRubricAI("generate.prompt.ready", { promptLength: theme.length });

    setIsGeneratingAI(true);
    setAiStatus("Generando rubrica con IA...");

    try {
      if (!selectedTemplate && selectedClassId) {
        logRubricAI("rubric.bootstrap.create-empty");
        const id = crypto.randomUUID();
        await db.rubricTemplates.add({
          id,
          classId: selectedClassId,
          name: "Nueva rubrica",
          description: "",
          criteria: [],
          criteriaCount: 0,
          levelCount: 0
        });
        await loadTemplates();
        setSelectedRubricId(id);
        logRubricAI("rubric.bootstrap.created", { rubricId: id });
      }

      let webllm: any = null;
      for (const source of WEBLLM_IMPORT_SOURCES) {
        try {
          logRubricAI("webllm.import.try", { source });
          webllm = await dynamicImport(source);
          logRubricAI("webllm.import.ok", { source });
          break;
        } catch {
          logRubricAI("webllm.import.fail", { source });
          webllm = null;
        }
      }
      if (!webllm) {
        logRubricAI("webllm.import.unavailable");
        setAiStatus("No se pudo cargar WebLLM en este navegador.");
        return;
      }

      const createEngine =
        webllm.CreateMLCEngine ??
        webllm.CreateWebWorkerMLCEngine ??
        webllm.createMLCEngine;

      if (!createEngine) {
        logRubricAI("webllm.createEngine.missing");
        setAiStatus("WebLLM no expone un inicializador compatible.");
        return;
      }

      if (!engineRef.current) {
        logRubricAI("engine.create.start", { aiModel });
        setIsModelLoadingOpen(true);
        setModelLoadStatus(`Cargando modelo ${aiModel}...`);
        setModelLoadProgress(0);
        try {
          engineRef.current = await createEngine(aiModel, {
            initProgressCallback: (report: any) => {
              const progress =
                typeof report?.progress === "number"
                  ? Math.max(0, Math.min(100, Math.round(report.progress * 100)))
                  : null;
              const text = typeof report?.text === "string" ? report.text : "";
              if (progress !== null) {
                setModelLoadProgress(progress);
              }
              if (text) {
                setModelLoadStatus(text);
              } else if (progress !== null) {
                setModelLoadStatus(`Cargando modelo... ${progress}%`);
              }
            }
          });
          logRubricAI("engine.create.ok.with-progress");
        } catch {
          logRubricAI("engine.create.retry.without-progress");
          engineRef.current = await createEngine(aiModel);
          logRubricAI("engine.create.ok.without-progress");
        } finally {
          setIsModelLoadingOpen(false);
        }
      } else {
        logRubricAI("engine.reuse.cached");
      }
      const engine = engineRef.current;

      setAiStatus("Generando contenido...");
      const completionPayload = {
        messages: [
          {
            role: "system",
            content:
              "Genera rúbricas académicas en JSON válido. Devuelve solo JSON sin markdown ni explicaciones."
          },
          {
            role: "user",
            content: [
              `Tema: ${theme}`,
              "Estructura JSON exacta:",
              '{"name":"", "description":"", "criteria":[{"name":"", "description":"", "levels":[{"name":"", "score":4},{"name":"", "score":3},{"name":"", "score":2},{"name":"", "score":1}]}]}',
              "Reglas:",
              "- Minimo 3 criterios.",
              "- Cada criterio con minimo 4 niveles.",
              "- Niveles ordenados de mayor a menor puntuacion."
            ].join("\n")
          }
        ],
        temperature: 0.2,
        max_tokens: 700,
        enable_thinking: false
      };

      let response: any;
      try {
        logRubricAI("completion.run.primary", {
          maxTokens: completionPayload.max_tokens
        });
        response = await withTimeout<any>(
          engine.chat.completions.create(completionPayload),
          AI_GENERATION_TIMEOUT_MS,
          "La generacion ha tardado demasiado. Prueba con un modelo mas rapido o una consigna mas corta."
        );
        logRubricAI("completion.run.primary.ok");
      } catch (error) {
        if (!isTimeoutError(error)) {
          logRubricAI("completion.run.primary.error", {
            message: error instanceof Error ? error.message : String(error)
          });
          throw error;
        }
        logRubricAI("completion.run.primary.timeout");
        setAiStatus("La generacion va lenta. Reintentando con salida reducida...");
        logRubricAI("completion.run.fallback", { maxTokens: 420 });
        response = await withTimeout<any>(
          engine.chat.completions.create({
            ...completionPayload,
            messages: [
              completionPayload.messages[0],
              {
                role: "user",
                content: [
                  `Tema: ${theme}`,
                  "Devuelve SOLO JSON válido con 3 criterios y 4 niveles por criterio.",
                  'Formato: {"name":"","description":"","criteria":[{"name":"","description":"","levels":[{"name":"","score":4},{"name":"","score":3},{"name":"","score":2},{"name":"","score":1}]}]}'
                ].join("\n")
              }
            ],
            max_tokens: 420
          }),
          AI_GENERATION_TIMEOUT_MS,
          "La generacion ha tardado demasiado. Prueba con un modelo mas rapido o una consigna mas corta."
        );
        logRubricAI("completion.run.fallback.ok");
      }

      const raw = extractMessageText(response);
      logRubricAI("completion.output.received", {
        textLength: raw.length,
        previewStart: raw.slice(0, 180),
        previewEnd: raw.slice(Math.max(0, raw.length - 180))
      });
      let parsed = parseFirstJsonObject(raw);
      let normalized = parsed ? normalizeGeneratedRubric(parsed) : null;

      if (!normalized) {
        logRubricAI("completion.output.repair.start");
        setAiStatus("Reformateando respuesta a JSON...");
        const repairResponse: any = await withTimeout<any>(
          engine.chat.completions.create({
            messages: [
              {
                role: "system",
                content:
                  "Recibirás una salida de otro modelo. Convierte su contenido a JSON válido y devuelve SOLO JSON sin markdown."
              },
              {
                role: "user",
                content: [
                  "Convierte esto al formato:",
                  '{"name":"","description":"","criteria":[{"name":"","description":"","levels":[{"name":"","score":4},{"name":"","score":3},{"name":"","score":2},{"name":"","score":1}]}]}',
                  "Contenido:",
                  raw.slice(0, 4000)
                ].join("\n")
              }
            ],
            temperature: 0,
            max_tokens: 500,
            enable_thinking: false
          }),
          AI_GENERATION_TIMEOUT_MS,
          "La generacion ha tardado demasiado. Prueba con un modelo mas rapido o una consigna mas corta."
        );
        const repairedRaw = extractMessageText(repairResponse);
        logRubricAI("completion.output.repair.received", {
          textLength: repairedRaw.length,
          previewStart: repairedRaw.slice(0, 180),
          previewEnd: repairedRaw.slice(Math.max(0, repairedRaw.length - 180))
        });
        parsed = parseFirstJsonObject(repairedRaw);
        normalized = parsed ? normalizeGeneratedRubric(parsed) : null;
      }

      if (!normalized) {
        logRubricAI("completion.output.invalid-json.fallback");
        normalized = buildFallbackRubric(theme);
        setAiStatus("La IA no devolvió JSON válido. Se creó un borrador base para que lo ajustes.");
      }

      setDetailName(normalized.name);
      setDetailDescription(normalized.description);
      setDetailCriteria(normalized.criteria);
      setRubricDirty(true);
      setAiStatus("Rubrica generada. Revisa y pulsa Guardar rubrica.");
      setIsAIModalOpen(false);
      logRubricAI("generate.success", {
        criteriaCount: normalized.criteria.length,
        elapsedMs: Date.now() - startedAt
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      logRubricAI("generate.error", {
        message,
        elapsedMs: Date.now() - startedAt
      });
      console.error(`${RUBRIC_AI_LOG_PREFIX} error.detail`, error);
      setAiStatus(`No se pudo generar la rubrica (${message}).`);
    } finally {
      setIsGeneratingAI(false);
      logRubricAI("generate.end", { elapsedMs: Date.now() - startedAt });
    }
  };

  return (
    <section className="module-card">
      <h2>Rubricas y listas de cotejo</h2>

      <div className="evaluation-tool-buttons" aria-label="Instrumentos de evaluacion">
        <button
          type="button"
          aria-pressed={activeTool === "rubrics"}
          className={`btn secondary ${activeTool === "rubrics" ? "active" : ""}`}
          onClick={() => setActiveTool("rubrics")}
        >
          Rubricas
        </button>
        <button
          type="button"
          aria-pressed={activeTool === "checklists"}
          className={`btn secondary ${activeTool === "checklists" ? "active" : ""}`}
          onClick={() => setActiveTool("checklists")}
        >
          Listas de cotejo
        </button>
      </div>

      {activeTool === "rubrics" ? (
        <>
      <div className="courses-layout">
        <aside className="courses-list-panel">
          <div className="courses-list-header">
            <strong>Rubricas</strong>
            <div className="actions-cell">
              <IconButton icon="add" label="Crear rubrica" onClick={async () => void createRubric()} />
              <IconButton
                icon="ai"
                label="Generar rubrica con IA"
                onClick={() => {
                  setAiStatus("");
                  setIsAIModalOpen(true);
                }}
              />
            </div>
          </div>
          <div className="courses-list section-tabs" role="tablist" aria-label="Rubricas">
            {templates.map((item) => (
              <div key={item.id} className="courses-list-row">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedRubricId === item.id}
                  className={`section-tab ${selectedRubricId === item.id ? "active" : ""}`}
                  onClick={() => {
                    if (rubricDirty) {
                      return;
                    }
                    setSelectedRubricId(item.id);
                  }}
                >
                  <span>{item.name}</span>
                  <small>{item.criteria?.length ?? 0} criterios</small>
                  <small>
                    {item.criteria?.[0]?.levels?.length ?? 0} niveles por criterio
                  </small>
                </button>
                <IconButton
                  icon="delete"
                  label={`Eliminar ${item.name}`}
                  onClick={async () => {
                    if (rubricDirty) {
                      return;
                    }
                    await removeRubric(item.id);
                  }}
                />
              </div>
            ))}
            {templates.length === 0 ? <p className="hint">No hay rubricas para esta clase.</p> : null}
          </div>
        </aside>

        <section className="course-detail-panel">
          {selectedTemplate ? (
            <>
              <div className="course-detail-header">
                <h4>Editor de rubrica</h4>
                <div className="actions-cell">
                  <IconButton
                    icon="save"
                    label="Guardar rubrica"
                    className={rubricDirty ? "save-attention" : ""}
                    disabled={!rubricDirty}
                    onClick={async () => {
                      await persistRubric();
                    }}
                  />
                </div>
              </div>

              <section className="detail-section">
                <h5>Datos generales</h5>
                <div className="detail-grid">
                  <div className="detail-field full">
                    <label>Nombre</label>
                    <input
                      className="input"
                      value={detailName}
                      onChange={(event) => {
                        setDetailName(event.target.value);
                        setRubricDirty(true);
                      }}
                    />
                  </div>
                  <div className="detail-field full">
                    <label>Descripcion</label>
                    <textarea
                      className="input"
                      value={detailDescription}
                      onChange={(event) => {
                        setDetailDescription(event.target.value);
                        setRubricDirty(true);
                      }}
                    />
                  </div>
                </div>
              </section>

              <section className="detail-section">
                <div className="course-detail-header">
                  <h5>Criterios y niveles</h5>
                  <IconButton
                    icon="add"
                    label="Añadir criterio"
                    onClick={() => {
                      setDetailCriteria((current) => [
                        ...current,
                        { id: crypto.randomUUID(), name: `Criterio ${current.length + 1}`, levels: [] }
                      ]);
                      setRubricDirty(true);
                    }}
                  />
                </div>

                <div className="planner-list">
                  {detailCriteria.map((criterion, criterionIndex) => (
                    <article key={criterion.id} className="planner-card">
                      <div className="courses-list-row">
                        <input
                          className="input"
                          value={criterion.name}
                          onChange={(event) => {
                            const value = event.target.value;
                            setDetailCriteria((current) =>
                              current.map((item) => (item.id === criterion.id ? { ...item, name: value } : item))
                            );
                            setRubricDirty(true);
                          }}
                        />
                        <IconButton
                          icon="up"
                          label="Subir criterio"
                          disabled={criterionIndex === 0}
                          onClick={() => {
                            if (criterionIndex === 0) {
                              return;
                            }
                            setDetailCriteria((current) => {
                              const next = [...current];
                              const temp = next[criterionIndex - 1];
                              next[criterionIndex - 1] = next[criterionIndex];
                              next[criterionIndex] = temp;
                              return next;
                            });
                            setRubricDirty(true);
                          }}
                        />
                        <IconButton
                          icon="down"
                          label="Bajar criterio"
                          disabled={criterionIndex >= detailCriteria.length - 1}
                          onClick={() => {
                            if (criterionIndex >= detailCriteria.length - 1) {
                              return;
                            }
                            setDetailCriteria((current) => {
                              const next = [...current];
                              const temp = next[criterionIndex + 1];
                              next[criterionIndex + 1] = next[criterionIndex];
                              next[criterionIndex] = temp;
                              return next;
                            });
                            setRubricDirty(true);
                          }}
                        />
                        <IconButton
                          icon="add"
                          label="Añadir nivel al criterio"
                          onClick={() => {
                            setDetailCriteria((current) =>
                              current.map((item) =>
                                item.id === criterion.id
                                  ? {
                                      ...item,
                                      levels: [
                                        ...(item.levels ?? []),
                                        {
                                          id: crypto.randomUUID(),
                                          name: `Nivel ${(item.levels?.length ?? 0) + 1}`,
                                          score: 1
                                        }
                                      ]
                                    }
                                  : item
                              )
                            );
                            setRubricDirty(true);
                          }}
                        />
                        <IconButton
                          icon="delete"
                          label="Eliminar criterio"
                          disabled={detailCriteria.length <= 1}
                          onClick={() => {
                            setDetailCriteria((current) =>
                              current.filter((_, index) => index !== criterionIndex)
                            );
                            setRubricDirty(true);
                          }}
                        />
                      </div>

                      <div className="planner-list">
                        {(criterion.levels ?? []).map((level, levelIndex) => (
                          <div key={level.id} className="courses-list-row">
                            <input
                              className="input"
                              value={level.name}
                              onChange={(event) => {
                                const value = event.target.value;
                                setDetailCriteria((current) =>
                                  current.map((item) =>
                                    item.id === criterion.id
                                      ? {
                                          ...item,
                                          levels: (item.levels ?? []).map((levelItem) =>
                                            levelItem.id === level.id ? { ...levelItem, name: value } : levelItem
                                          )
                                        }
                                      : item
                                  )
                                );
                                setRubricDirty(true);
                              }}
                            />
                            <input
                              className="input"
                              type="number"
                              step={0.1}
                              value={level.score}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                setDetailCriteria((current) =>
                                  current.map((item) =>
                                    item.id === criterion.id
                                      ? {
                                          ...item,
                                          levels: (item.levels ?? []).map((levelItem) =>
                                            levelItem.id === level.id ? { ...levelItem, score: value } : levelItem
                                          )
                                        }
                                      : item
                                  )
                                );
                                setRubricDirty(true);
                              }}
                            />
                            <IconButton
                              icon="delete"
                              label="Eliminar nivel"
                              disabled={(criterion.levels?.length ?? 0) <= 2}
                              onClick={() => {
                                setDetailCriteria((current) =>
                                  current.map((item) =>
                                    item.id === criterion.id
                                      ? {
                                          ...item,
                                          levels: (item.levels ?? []).filter((_, index) => index !== levelIndex)
                                        }
                                      : item
                                  )
                                );
                                setRubricDirty(true);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <p>No hay rubricas para editar.</p>
          )}
        </section>
      </div>
      {rubricDirty ? <p className="hint">Tienes cambios sin guardar en la rubrica actual.</p> : null}
      <Modal
        open={isAIModalOpen}
        title="Generar rubrica con IA"
        onClose={() => {
          if (!isGeneratingAI) {
            setIsAIModalOpen(false);
          }
        }}
      >
        <div className="detail-grid">
          <div className="detail-field full">
            <label>Que quieres generar</label>
            <textarea
              className="input"
              placeholder="Ej: Rubrica para debate en 4º ESO de Geografia e Historia, con criterios de argumentacion, evidencias y expresion oral."
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
            />
          </div>
        </div>
        {aiStatus ? <p className="hint">{aiStatus}</p> : null}
        <div className="actions-cell">
          <button
            type="button"
            className="btn secondary"
            disabled={isGeneratingAI}
            onClick={() => setIsAIModalOpen(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={isGeneratingAI}
            onClick={() => void generateRubricWithAI()}
          >
            {isGeneratingAI ? "Generando..." : "Generar"}
          </button>
        </div>
      </Modal>
      <Modal open={isModelLoadingOpen} title="Cargando modelo IA" onClose={() => undefined}>
        <p className="hint">{modelLoadStatus}</p>
        <div style={{ marginTop: 8 }}>
          <progress value={modelLoadProgress} max={100} style={{ width: "100%" }} />
          <p className="hint">{modelLoadProgress}%</p>
        </div>
      </Modal>
        </>
      ) : (
        <ChecklistsSection selectedClassId={selectedClassId} />
      )}
    </section>
  );
}
