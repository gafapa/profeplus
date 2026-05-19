import { useEffect, useMemo, useRef, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import { db } from "../../shared/db/database";
import type { RubricCriterion, RubricLevel, RubricTemplate } from "../../shared/db/types";
import { ContextSidebarTabs } from "../../shared/ui/ContextSidebarTabs";
import { IconButton } from "../../shared/ui/IconButton";
import { Modal } from "../../shared/ui/Modal";
import { ChecklistsSection } from "./ChecklistsSection";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";
import { generateAiText } from "../../shared/ai/extensionRuntime";

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function logRubricAI(_step: string, _meta?: Record<string, unknown>): void {
  // no-op in production
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

const criteriaNames = ["Dominio del contenido", "Aplicación práctica", "Comunicación y justificación"];
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
    name: `Rúbrica: ${theme.slice(0, 60)}`,
    description: `Borrador generado para: ${theme}`,
    criteria
  };
}

export function RubricsPage() {
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const [activeTool, setActiveTool] = useState<"rubrics" | "checklists">("rubrics");
  const [checklistsDirty, setChecklistsDirty] = useState(false);
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
  const [showRubricUnsavedModal, setShowRubricUnsavedModal] = useState(false);
  const [showChecklistUnsavedModal, setShowChecklistUnsavedModal] = useState(false);
  const pendingRubricActionRef = useRef<(() => void | Promise<void>) | null>(null);

  const loadTemplates = async () => {
    if (!selectedClassId) {
      setTemplates([]);
      return;
    }
    const rows = await db.rubricTemplates.where("classId").equals(selectedClassId).toArray();
    setTemplates(rows.filter((item) => !item.taskId).map(normalizeTemplate));
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

  useUnsavedChangesGuard(rubricDirty);

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

  const runRubricAction = (action: () => void | Promise<void>): void => {
    if (!rubricDirty) {
      void action();
      return;
    }
    pendingRubricActionRef.current = action;
    setShowRubricUnsavedModal(true);
  };

  const closeRubricUnsavedModal = (): void => {
    setShowRubricUnsavedModal(false);
    pendingRubricActionRef.current = null;
  };

  const executePendingRubricAction = (): void => {
    const action = pendingRubricActionRef.current;
    pendingRubricActionRef.current = null;
    setShowRubricUnsavedModal(false);
    if (action) {
      void action();
    }
  };

  const createRubric = async (): Promise<void> => {
    if (!selectedClassId) {
      return;
    }
    const id = crypto.randomUUID();
    await db.rubricTemplates.add({
      id,
      classId: selectedClassId,
      taskId: undefined,
      name: "Nueva rúbrica",
      description: "",
      criteria: [],
      criteriaCount: 0,
      levelCount: 0
    });
    await loadTemplates();
    setSelectedRubricId(id);
  };

  const removeRubric = async (rubricId: string): Promise<void> => {
    const assessmentsCount = await db.taskRubricAssessments.where("rubricTemplateId").equals(rubricId).count();
    if (assessmentsCount > 0) {
      setAiStatus("No se puede eliminar la rúbrica porque ya tiene evaluaciones.");
      return;
    }
    await db.transaction("rw", db.rubricTemplates, db.taskGradebookConfigs, db.taskDailyEvaluationSettings, async () => {
      await db.rubricTemplates.delete(rubricId);
      const configs = await db.taskGradebookConfigs.where("rubricTemplateId").equals(rubricId).toArray();
      if (configs.length > 0) {
        await db.taskGradebookConfigs.bulkPut(
          configs.map((config) => ({ ...config, rubricTemplateId: undefined }))
        );
      }
      const settings = await db.taskDailyEvaluationSettings.where("rubricTemplateId").equals(rubricId).toArray();
      if (settings.length > 0) {
        await db.taskDailyEvaluationSettings.bulkPut(
          settings.map((setting) => ({ ...setting, rubricTemplateId: undefined }))
        );
      }
    });
    await loadTemplates();
  };

  const generateRubricWithAI = async (): Promise<void> => {
    const startedAt = Date.now();
    logRubricAI("generate.start", {
      selectedClassId,
      selectedRubricId
    });

    if (!selectedTemplate && !selectedClassId) {
      logRubricAI("generate.blocked.no-class");
      setAiStatus("Selecciona una clase para generar la rúbrica.");
      return;
    }

    const theme = aiPrompt.trim();
    if (!theme) {
      logRubricAI("generate.blocked.empty-prompt");
      setAiStatus("Escribe una indicación para generar la rúbrica.");
      return;
    }
    logRubricAI("generate.prompt.ready", { promptLength: theme.length });

    setIsGeneratingAI(true);
    setAiStatus("Generando rúbrica con IA...");

    try {
      if (!selectedTemplate && selectedClassId) {
        logRubricAI("rubric.bootstrap.create-empty");
        const id = crypto.randomUUID();
        await db.rubricTemplates.add({
          id,
          classId: selectedClassId,
          taskId: undefined,
        name: "Nueva rúbrica",
          description: "",
          criteria: [],
          criteriaCount: 0,
          levelCount: 0
        });
        await loadTemplates();
        setSelectedRubricId(id);
        logRubricAI("rubric.bootstrap.created", { rubricId: id });
      }

      setAiStatus("Generando contenido...");
      const completionMessages = [
        {
          role: "system" as const,
          content:
            "Genera rúbricas académicas en JSON válido. Devuelve solo JSON sin markdown ni explicaciones."
        },
        {
          role: "user" as const,
          content: [
            `Tema: ${theme}`,
            "Estructura JSON exacta:",
            '{"name":"", "description":"", "criteria":[{"name":"", "description":"", "levels":[{"name":"", "score":4},{"name":"", "score":3},{"name":"", "score":2},{"name":"", "score":1}]}]}',
            "Reglas:",
            "- Mínimo 3 criterios.",
            "- Cada criterio con mínimo 4 niveles.",
            "- Niveles ordenados de mayor a menor puntuación."
          ].join("\n")
        }
      ];

      const runCompletion = (messages: typeof completionMessages, maxOutputTokens: number) =>
        generateAiText(messages, {
          temperature: 0.2,
          maxOutputTokens,
          responseFormat: "json"
        });

      let raw: string;
      try {
        logRubricAI("completion.run.primary", { maxTokens: 700 });
        const response = await withTimeout(
          runCompletion(completionMessages, 700),
          AI_GENERATION_TIMEOUT_MS,
          "La generación ha tardado demasiado. Prueba con un proveedor más rápido o una consigna más corta."
        );
        raw = response.text;
        logRubricAI("completion.run.primary.ok", {
          provider: response.provider,
          model: response.model
        });
      } catch (error) {
        if (!isTimeoutError(error)) {
          logRubricAI("completion.run.primary.error", {
            message: error instanceof Error ? error.message : String(error)
          });
          throw error;
        }
        logRubricAI("completion.run.primary.timeout");
        setAiStatus("La generación va lenta. Reintentando con salida reducida...");
        const response = await withTimeout(
          runCompletion(
            [
              completionMessages[0],
              {
                role: "user" as const,
                content: [
                  `Tema: ${theme}`,
                  "Devuelve SOLO JSON válido con 3 criterios y 4 niveles por criterio.",
                  'Formato: {"name":"","description":"","criteria":[{"name":"","description":"","levels":[{"name":"","score":4},{"name":"","score":3},{"name":"","score":2},{"name":"","score":1}]}]}'
                ].join("\n")
              }
            ],
            420
          ),
          AI_GENERATION_TIMEOUT_MS,
          "La generación ha tardado demasiado. Prueba con un proveedor más rápido o una consigna más corta."
        );
        raw = response.text;
        logRubricAI("completion.run.fallback.ok", {
          provider: response.provider,
          model: response.model
        });
      }

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
        const repairResponse = await withTimeout(
          generateAiText(
            [
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
            {
              temperature: 0,
              maxOutputTokens: 500,
              responseFormat: "json"
            }
          ),
          AI_GENERATION_TIMEOUT_MS,
          "La generación ha tardado demasiado. Prueba con un proveedor más rápido o una consigna más corta."
        );
        const repairedRaw = repairResponse.text;
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
    setAiStatus("Rúbrica generada. Revisa y pulsa Guardar rúbrica.");
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
      setAiStatus(`No se pudo generar la rúbrica (${message}).`);
    } finally {
      setIsGeneratingAI(false);
      logRubricAI("generate.end", { elapsedMs: Date.now() - startedAt });
    }
  };

  return (
    <section className="module-card">
      <div className="evaluation-tool-buttons" aria-label="Instrumentos de evaluación">
        <button
          type="button"
          aria-pressed={activeTool === "rubrics"}
          className={`btn secondary ${activeTool === "rubrics" ? "active" : ""}`}
          onClick={() => {
            if (activeTool === "checklists" && checklistsDirty) {
              setShowChecklistUnsavedModal(true);
              return;
            }
            setActiveTool("rubrics");
          }}
        >
          Rúbricas
        </button>
        <button
          type="button"
          aria-pressed={activeTool === "checklists"}
          className={`btn secondary ${activeTool === "checklists" ? "active" : ""}`}
          onClick={() => runRubricAction(() => setActiveTool("checklists"))}
        >
          Listas de cotejo
        </button>
      </div>

      {activeTool === "rubrics" ? (
        <>
      <div className="courses-layout">
        <aside className="courses-list-panel">
          <ContextSidebarTabs />
          <div className="courses-list-header">
              <strong>Rúbricas</strong>
            <div className="actions-cell">
              <IconButton
                icon="add"
              label="Crear rúbrica"
                onClick={() => runRubricAction(async () => void createRubric())}
              />
              <IconButton
                icon="ai"
              label="Generar rúbrica con IA"
                onClick={() => {
                  setAiStatus("");
                  setIsAIModalOpen(true);
                }}
              />
            </div>
          </div>
              <div className="courses-list section-tabs" role="tablist" aria-label="Rúbricas">
            {templates.map((item) => (
              <div key={item.id} className="courses-list-row">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedRubricId === item.id}
                  className={`section-tab ${selectedRubricId === item.id ? "active" : ""}`}
                  onClick={() => runRubricAction(() => setSelectedRubricId(item.id))}
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
                  onClick={() =>
                    runRubricAction(async () => {
                      await removeRubric(item.id);
                    })
                  }
                />
              </div>
            ))}
              {templates.length === 0 ? <p className="hint">No hay rúbricas para esta clase.</p> : null}
          </div>
        </aside>

        <section className="course-detail-panel">
          {selectedTemplate ? (
            <>
              <div className="course-detail-header">
                  <h4>Editor de rúbrica</h4>
                <div className="actions-cell">
                  <IconButton
                    icon="save"
                    label="Guardar rúbrica"
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
              <label>Descripción</label>
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
            <p>No hay rúbricas para editar.</p>
          )}
        </section>
      </div>
      {rubricDirty ? <p className="hint">Tienes cambios sin guardar en la rúbrica actual.</p> : null}
      <Modal
        open={showRubricUnsavedModal}
        title="Cambios sin guardar"
        onClose={closeRubricUnsavedModal}
      >
        <p>Hay cambios pendientes en la rúbrica actual.</p>
        <div className="inline-form">
          <button type="button" className="btn secondary" onClick={closeRubricUnsavedModal}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setRubricDirty(false);
              executePendingRubricAction();
            }}
          >
            Descartar y continuar
          </button>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const saved = await persistRubric();
              if (!saved) {
                return;
              }
              executePendingRubricAction();
            }}
          >
            Guardar y continuar
          </button>
        </div>
      </Modal>
      <Modal
        open={showChecklistUnsavedModal}
        title="Cambios sin guardar"
        onClose={() => setShowChecklistUnsavedModal(false)}
      >
        <p>Tienes cambios pendientes en listas de cotejo. Guarda esos cambios antes de salir de esa vista.</p>
        <div className="inline-form">
          <button type="button" className="btn" onClick={() => setShowChecklistUnsavedModal(false)}>
            Entendido
          </button>
        </div>
      </Modal>
      <Modal
        open={isAIModalOpen}
      title="Generar rúbrica con IA"
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
          placeholder="Ej: Rúbrica para debate en 4º ESO de Geografía e Historia, con criterios de argumentación, evidencias y expresión oral."
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
        </>
      ) : (
        <ChecklistsSection selectedClassId={selectedClassId} onDirtyChange={setChecklistsDirty} />
      )}
    </section>
  );
}
