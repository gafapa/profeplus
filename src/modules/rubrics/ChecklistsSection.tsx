import { useEffect, useMemo, useRef, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import { db } from "../../shared/db/database";
import type { ChecklistItem, ChecklistTemplate } from "../../shared/db/types";
import { IconButton } from "../../shared/ui/IconButton";
import { Modal } from "../../shared/ui/Modal";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";

const AI_GENERATION_TIMEOUT_MS = 180000;
const CHECKLIST_AI_LOG_PREFIX = "[ChecklistAI]";

type ChecklistsSectionProps = {
  selectedClassId: string | null;
  onDirtyChange?: (dirty: boolean) => void;
};

type GeneratedChecklist = {
  name?: string;
  title?: string;
  description?: string;
  items?: Array<string | { text?: string; name?: string; item?: string }>;
  checklist?: {
    name?: string;
    title?: string;
    description?: string;
    items?: Array<string | { text?: string; name?: string; item?: string }>;
  };
};

function normalizeChecklist(template: ChecklistTemplate): ChecklistTemplate {
  return {
    ...template,
    description: template.description ?? "",
    items: (template.items ?? []).map((item) => ({
      ...item,
      text: item.text ?? ""
    }))
  };
}

function logChecklistAI(step: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.log(`${CHECKLIST_AI_LOG_PREFIX} ${step}`, meta);
    return;
  }
  console.log(`${CHECKLIST_AI_LOG_PREFIX} ${step}`);
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

function tryParseGeneratedChecklist(text: string): GeneratedChecklist | null {
  try {
    return JSON.parse(text) as GeneratedChecklist;
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

function parseFirstJsonObject(raw: string): GeneratedChecklist | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const withoutThinking = trimmed.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();
  const withoutCodeFence = withoutThinking
    .replace(/```json/gi, "```")
    .replace(/```([\s\S]*?)```/g, "$1")
    .trim();
  const relaxed = withoutCodeFence
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'");

  const candidates = [withoutCodeFence, relaxed, trimmed];
  for (const candidateText of candidates) {
    const candidate = candidateText.trim();
    if (!candidate) {
      continue;
    }
    const direct = tryParseGeneratedChecklist(candidate);
    if (direct) {
      return direct;
    }
    const jsonObject = extractFirstBalancedJSONObject(candidate);
    if (!jsonObject) {
      continue;
    }
    const parsed = tryParseGeneratedChecklist(jsonObject);
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

  if (primaryText.trim().length > 0) {
    return primaryText;
  }
  return reasoningText;
}

function toChecklistItems(rawItems: unknown): ChecklistItem[] {
  if (!Array.isArray(rawItems)) {
    return [];
  }
  return rawItems
    .map((rawItem): ChecklistItem | null => {
      if (typeof rawItem === "string") {
        const id: string = crypto.randomUUID();
        return { id, text: rawItem.trim() };
      }
      if (!rawItem || typeof rawItem !== "object") {
        return null;
      }
      const typed = rawItem as Record<string, unknown>;
      const text = String(typed.text ?? typed.name ?? typed.item ?? "").trim();
      if (!text) {
        return null;
      }
      const id: string = crypto.randomUUID();
      return { id, text };
    })
    .filter((item): item is ChecklistItem => Boolean(item && item.text.length > 0));
}

function normalizeGeneratedChecklist(
  generated: GeneratedChecklist,
  theme: string
): { name: string; description: string; items: ChecklistItem[] } | null {
  const src = generated.checklist ?? generated;
  const name = String(src.name ?? src.title ?? "").trim() || `Lista de cotejo: ${theme.slice(0, 60)}`;
  const description = String(src.description ?? "").trim();
  const items = toChecklistItems(src.items);

  if (name.length < 2 || items.length === 0) {
    return null;
  }

  return {
    name,
    description,
    items
  };
}

function buildFallbackChecklist(theme: string): {
  name: string;
  description: string;
  items: ChecklistItem[];
} {
  const baseItems = [
    "Comprende los conceptos clave",
    "Aplica correctamente el procedimiento",
    "Explica con claridad su razonamiento",
    "Usa vocabulario especifico de la materia",
    "Entrega completa y ordenada"
  ];
  return {
    name: `Lista de cotejo: ${theme.slice(0, 60)}`,
    description: `Borrador base generado para: ${theme}`,
    items: baseItems.map((text) => ({ id: crypto.randomUUID(), text }))
  };
}

export function ChecklistsSection({ selectedClassId, onDirtyChange }: ChecklistsSectionProps) {
  const aiModel = useAppSelector((state) => state.app.aiModel);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedChecklistId, setSelectedChecklistId] = useState("");
  const [checklistDirty, setChecklistDirty] = useState(false);

  const [detailName, setDetailName] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [detailItems, setDetailItems] = useState<ChecklistItem[]>([]);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isModelLoadingOpen, setIsModelLoadingOpen] = useState(false);
  const [modelLoadStatus, setModelLoadStatus] = useState("Preparando modelo...");
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const engineRef = useRef<any>(null);
  const pendingChecklistActionRef = useRef<(() => void | Promise<void>) | null>(null);

  const loadTemplates = async (): Promise<void> => {
    if (!selectedClassId) {
      setTemplates([]);
      return;
    }
    const rows = await db.checklistTemplates.where("classId").equals(selectedClassId).toArray();
    setTemplates(rows.filter((item) => !item.taskId).map(normalizeChecklist));
  };

  useEffect(() => {
    void loadTemplates();
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedChecklistId && templates.length > 0) {
      setSelectedChecklistId(templates[0].id);
      return;
    }
    const exists = templates.some((item) => item.id === selectedChecklistId);
    if (!exists && templates.length > 0) {
      setSelectedChecklistId(templates[0].id);
    }
    if (templates.length === 0) {
      setSelectedChecklistId("");
    }
  }, [selectedChecklistId, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedChecklistId) ?? null,
    [selectedChecklistId, templates]
  );

  useEffect(() => {
    if (!selectedTemplate) {
      setDetailName("");
      setDetailDescription("");
      setDetailItems([]);
      setChecklistDirty(false);
      return;
    }
    setDetailName(selectedTemplate.name);
    setDetailDescription(selectedTemplate.description ?? "");
    setDetailItems(selectedTemplate.items ?? []);
    setChecklistDirty(false);
  }, [selectedTemplate]);

  useEffect(() => {
    engineRef.current = null;
  }, [aiModel]);

  useUnsavedChangesGuard(checklistDirty);
  useEffect(() => {
    onDirtyChange?.(checklistDirty);
    return () => onDirtyChange?.(false);
  }, [checklistDirty, onDirtyChange]);

  const persistChecklist = async (): Promise<boolean> => {
    if (!selectedTemplate || !checklistDirty) {
      return true;
    }
    const name = detailName.trim();
    if (name.length < 2) {
      return false;
    }

    const items = detailItems
      .map((item) => ({
        ...item,
        text: item.text.trim()
      }))
      .filter((item) => item.text.length > 0);

    await db.checklistTemplates.put({
      ...selectedTemplate,
      name,
      description: detailDescription.trim() || undefined,
      items
    });
    setChecklistDirty(false);
    await loadTemplates();
    return true;
  };

  const runChecklistAction = (action: () => void | Promise<void>): void => {
    if (!checklistDirty) {
      void action();
      return;
    }
    pendingChecklistActionRef.current = action;
    setShowUnsavedModal(true);
  };

  const closeUnsavedModal = (): void => {
    setShowUnsavedModal(false);
    pendingChecklistActionRef.current = null;
  };

  const executePendingChecklistAction = (): void => {
    const action = pendingChecklistActionRef.current;
    pendingChecklistActionRef.current = null;
    setShowUnsavedModal(false);
    if (action) {
      void action();
    }
  };

  const createChecklist = async (): Promise<void> => {
    if (!selectedClassId) {
      return;
    }
    const id = crypto.randomUUID();
    await db.checklistTemplates.add({
      id,
      classId: selectedClassId,
      taskId: undefined,
      name: "Nueva lista de cotejo",
      description: "",
      items: []
    });
    await loadTemplates();
    setSelectedChecklistId(id);
  };

  const removeChecklist = async (checklistId: string): Promise<void> => {
    await db.checklistTemplates.delete(checklistId);
    await loadTemplates();
  };

  const generateChecklistWithAI = async (): Promise<void> => {
    const startedAt = Date.now();
    logChecklistAI("generate.start", { selectedClassId, selectedChecklistId, aiModel });

    if (!selectedTemplate && !selectedClassId) {
      setAiStatus("Selecciona una clase para generar la lista.");
      return;
    }

    const theme = aiPrompt.trim();
    if (!theme) {
      setAiStatus("Escribe una indicacion para generar la lista de cotejo.");
      return;
    }

    setIsGeneratingAI(true);
    setAiStatus("Generando lista de cotejo con IA...");

    try {
      if (!selectedTemplate && selectedClassId) {
        const id = crypto.randomUUID();
        await db.checklistTemplates.add({
          id,
          classId: selectedClassId,
          taskId: undefined,
          name: "Nueva lista de cotejo",
          description: "",
          items: []
        });
        await loadTemplates();
        setSelectedChecklistId(id);
      }

      let webllm: any = null;
      try {
        webllm = await import("@mlc-ai/web-llm");
      } catch {
        webllm = null;
      }
      if (!webllm) {
        setAiStatus("No se pudo cargar WebLLM en este navegador.");
        return;
      }

      const createEngine =
        webllm.CreateMLCEngine ??
        webllm.CreateWebWorkerMLCEngine ??
        webllm.createMLCEngine;
      if (!createEngine) {
        setAiStatus("WebLLM no expone un inicializador compatible.");
        return;
      }

      if (!engineRef.current) {
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
        } catch {
          engineRef.current = await createEngine(aiModel);
        } finally {
          setIsModelLoadingOpen(false);
        }
      }

      const engine = engineRef.current;
      const completionPayload = {
        messages: [
          {
            role: "system",
            content:
              "Genera listas de cotejo académicas en JSON válido. Devuelve solo JSON sin markdown ni explicaciones."
          },
          {
            role: "user",
            content: [
              `Tema: ${theme}`,
              "Formato JSON exacto:",
              '{"name":"","description":"","items":[{"text":""}]}',
              "Reglas:",
              "- Minimo 5 items.",
              "- Items claros, observables y evaluables.",
              "- Evita texto extra fuera del JSON."
            ].join("\n")
          }
        ],
        temperature: 0.2,
        max_tokens: 450,
        enable_thinking: false
      };

      let response: any;
      try {
        response = await withTimeout<any>(
          engine.chat.completions.create(completionPayload),
          AI_GENERATION_TIMEOUT_MS,
          "La generacion ha tardado demasiado. Prueba con un modelo mas rapido o una consigna mas corta."
        );
      } catch (error) {
        if (!isTimeoutError(error)) {
          throw error;
        }
        setAiStatus("La generacion va lenta. Reintentando con salida reducida...");
        response = await withTimeout<any>(
          engine.chat.completions.create({
            ...completionPayload,
            max_tokens: 280
          }),
          AI_GENERATION_TIMEOUT_MS,
          "La generacion ha tardado demasiado. Prueba con un modelo mas rapido o una consigna mas corta."
        );
      }

      const raw = extractMessageText(response);
      logChecklistAI("completion.output.received", {
        textLength: raw.length,
        previewStart: raw.slice(0, 140),
        previewEnd: raw.slice(Math.max(0, raw.length - 140))
      });

      let parsed = parseFirstJsonObject(raw);
      let normalized = parsed ? normalizeGeneratedChecklist(parsed, theme) : null;

      if (!normalized) {
        setAiStatus("Reformateando respuesta a JSON...");
        const repairResponse: any = await withTimeout<any>(
          engine.chat.completions.create({
            messages: [
              {
                role: "system",
                content:
                  "Convierte el contenido recibido a JSON válido y devuelve SOLO JSON sin markdown."
              },
              {
                role: "user",
                content: [
                  'Formato objetivo: {"name":"","description":"","items":[{"text":""}]}',
                  "Contenido:",
                  raw.slice(0, 3500)
                ].join("\n")
              }
            ],
            temperature: 0,
            max_tokens: 350,
            enable_thinking: false
          }),
          AI_GENERATION_TIMEOUT_MS,
          "La generacion ha tardado demasiado. Prueba con un modelo mas rapido o una consigna mas corta."
        );
        const repairedRaw = extractMessageText(repairResponse);
        parsed = parseFirstJsonObject(repairedRaw);
        normalized = parsed ? normalizeGeneratedChecklist(parsed, theme) : null;
      }

      if (!normalized) {
        normalized = buildFallbackChecklist(theme);
        setAiStatus("La IA no devolvió JSON válido. Se creó un borrador base para que lo ajustes.");
      }

      setDetailName(normalized.name);
      setDetailDescription(normalized.description);
      setDetailItems(normalized.items);
      setChecklistDirty(true);
      setIsAIModalOpen(false);
      setAiStatus("Lista generada. Revisa y pulsa Guardar.");

      logChecklistAI("generate.success", {
        items: normalized.items.length,
        elapsedMs: Date.now() - startedAt
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      logChecklistAI("generate.error", { message, elapsedMs: Date.now() - startedAt });
      console.error(`${CHECKLIST_AI_LOG_PREFIX} error.detail`, error);
      setAiStatus(`No se pudo generar la lista (${message}).`);
    } finally {
      setIsGeneratingAI(false);
      logChecklistAI("generate.end", { elapsedMs: Date.now() - startedAt });
    }
  };

  return (
    <>
      <div className="courses-layout">
        <aside className="courses-list-panel">
          <div className="courses-list-header">
            <strong>Listas de cotejo</strong>
            <div className="actions-cell">
              <IconButton
                icon="add"
                label="Crear lista de cotejo"
                onClick={() => runChecklistAction(async () => void createChecklist())}
              />
              <IconButton
                icon="ai"
                label="Generar lista de cotejo con IA"
                onClick={() => {
                  setAiStatus("");
                  setIsAIModalOpen(true);
                }}
              />
            </div>
          </div>
          <div className="courses-list section-tabs" role="tablist" aria-label="Listas de cotejo">
            {templates.map((item) => (
              <div key={item.id} className="courses-list-row">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedChecklistId === item.id}
                  className={`section-tab ${selectedChecklistId === item.id ? "active" : ""}`}
                  onClick={() => {
                    runChecklistAction(() => setSelectedChecklistId(item.id));
                  }}
                >
                  <span>{item.name}</span>
                  <small>{item.items?.length ?? 0} items</small>
                </button>
                <IconButton
                  icon="delete"
                  label={`Eliminar ${item.name}`}
                  onClick={async () => {
                    runChecklistAction(async () => {
                      await removeChecklist(item.id);
                    });
                  }}
                />
              </div>
            ))}
            {templates.length === 0 ? <p className="hint">No hay listas de cotejo para esta clase.</p> : null}
          </div>
        </aside>

        <section className="course-detail-panel">
          {selectedTemplate ? (
            <>
              <div className="course-detail-header">
                <h4>Editor de lista de cotejo</h4>
                <div className="actions-cell">
                  <IconButton
                    icon="save"
                    label="Guardar lista de cotejo"
                    className={checklistDirty ? "save-attention" : ""}
                    disabled={!checklistDirty}
                    onClick={async () => {
                      await persistChecklist();
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
                        setChecklistDirty(true);
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
                        setChecklistDirty(true);
                      }}
                    />
                  </div>
                </div>
              </section>

              <section className="detail-section">
                <div className="course-detail-header">
                  <h5>Items</h5>
                  <IconButton
                    icon="add"
                    label="Anadir item"
                    onClick={() => {
                      setDetailItems((current) => [
                        ...current,
                        { id: crypto.randomUUID(), text: `Item ${current.length + 1}` }
                      ]);
                      setChecklistDirty(true);
                    }}
                  />
                </div>

                <div className="planner-list">
                  {detailItems.map((item, index) => (
                    <div key={item.id} className="courses-list-row">
                      <input
                        className="input"
                        value={item.text}
                        onChange={(event) => {
                          const value = event.target.value;
                          setDetailItems((current) =>
                            current.map((currentItem) =>
                              currentItem.id === item.id ? { ...currentItem, text: value } : currentItem
                            )
                          );
                          setChecklistDirty(true);
                        }}
                      />
                      <IconButton
                        icon="up"
                        label="Subir item"
                        disabled={index === 0}
                        onClick={() => {
                          if (index === 0) {
                            return;
                          }
                          setDetailItems((current) => {
                            const next = [...current];
                            const temp = next[index - 1];
                            next[index - 1] = next[index];
                            next[index] = temp;
                            return next;
                          });
                          setChecklistDirty(true);
                        }}
                      />
                      <IconButton
                        icon="down"
                        label="Bajar item"
                        disabled={index >= detailItems.length - 1}
                        onClick={() => {
                          if (index >= detailItems.length - 1) {
                            return;
                          }
                          setDetailItems((current) => {
                            const next = [...current];
                            const temp = next[index + 1];
                            next[index + 1] = next[index];
                            next[index] = temp;
                            return next;
                          });
                          setChecklistDirty(true);
                        }}
                      />
                      <IconButton
                        icon="delete"
                        label="Eliminar item"
                        onClick={() => {
                          setDetailItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
                          setChecklistDirty(true);
                        }}
                      />
                    </div>
                  ))}
                  {detailItems.length === 0 ? <p className="hint">La lista esta vacia. Anade items.</p> : null}
                </div>
              </section>
            </>
          ) : (
            <p>No hay listas de cotejo para editar.</p>
          )}
        </section>
      </div>
      {checklistDirty ? <p className="hint">Tienes cambios sin guardar en la lista de cotejo actual.</p> : null}

      <Modal
        open={showUnsavedModal}
        title="Cambios sin guardar"
        onClose={closeUnsavedModal}
      >
        <p>Hay cambios pendientes en la lista actual.</p>
        <div className="inline-form">
          <button type="button" className="btn secondary" onClick={closeUnsavedModal}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setChecklistDirty(false);
              executePendingChecklistAction();
            }}
          >
            Descartar y continuar
          </button>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const saved = await persistChecklist();
              if (!saved) {
                return;
              }
              executePendingChecklistAction();
            }}
          >
            Guardar y continuar
          </button>
        </div>
      </Modal>

      <Modal
        open={isAIModalOpen}
        title="Generar lista de cotejo con IA"
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
              placeholder="Ej: Lista de cotejo para exposicion oral de Ciencias en 3 ESO."
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
            onClick={() => void generateChecklistWithAI()}
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
  );
}
