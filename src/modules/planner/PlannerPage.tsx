import { useEffect, useMemo, useRef, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import { db } from "../../shared/db/database";
import type {
  ChecklistItem,
  ChecklistTemplate,
  RubricCriterion,
  RubricLevel,
  RubricTemplate,
  ScheduleDay,
  Subject,
  Task,
  TaskSession,
  UnitBlock
} from "../../shared/db/types";
import { IconButton } from "../../shared/ui/IconButton";
import { Modal } from "../../shared/ui/Modal";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";

type TaskSessionDraft = {
  date: string;
  scheduleSlotId: string;
};

type SlotOption = {
  slotId: string;
  label: string;
};

type AITemplateMode = "rubric" | "checklist";

const AI_GENERATION_TIMEOUT_MS = 180000;

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoDayOfWeek(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map((item) => Number(item));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return 0;
  }
  const date = new Date(year, month - 1, day);
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function uniqueSessionKey(item: TaskSessionDraft): string {
  return `${item.date}::${item.scheduleSlotId}`;
}

function compareSessionDraft(a: TaskSessionDraft, b: TaskSessionDraft): number {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) {
    return byDate;
  }
  return a.scheduleSlotId.localeCompare(b.scheduleSlotId);
}

function normalizeTaskSessions(rows: TaskSession[]): TaskSessionDraft[] {
  return rows
    .map((item) => ({
      date: item.date,
      scheduleSlotId: item.scheduleSlotId
    }))
    .sort(compareSessionDraft);
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

function parseFirstJsonObject(raw: string): any | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const jsonObject = extractFirstBalancedJSONObject(trimmed);
    if (!jsonObject) {
      return null;
    }
    try {
      return JSON.parse(jsonObject);
    } catch {
      return null;
    }
  }
}

function extractMessageText(response: any): string {
  const content = response?.choices?.[0]?.message?.content ?? response?.choices?.[0]?.delta?.content ?? "";
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && typeof (item as Record<string, unknown>).text === "string") {
          return (item as Record<string, string>).text;
        }
        return "";
      })
      .join("");
  }
  if (content && typeof content === "object" && typeof (content as Record<string, unknown>).text === "string") {
    return (content as Record<string, string>).text;
  }
  return "";
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

function buildFallbackRubric(theme: string): { name: string; description: string; criteria: RubricCriterion[] } {
  const levels: RubricLevel[] = [
    { id: crypto.randomUUID(), name: "Excelente", score: 4 },
    { id: crypto.randomUUID(), name: "Notable", score: 3 },
    { id: crypto.randomUUID(), name: "Basico", score: 2 },
    { id: crypto.randomUUID(), name: "Inicial", score: 1 }
  ];
  const criteriaNames = ["Comprension", "Aplicacion", "Comunicacion"];
  const criteria: RubricCriterion[] = criteriaNames.map((name) => ({
    id: crypto.randomUUID(),
    name,
    levels: levels.map((item) => ({ ...item, id: crypto.randomUUID() }))
  }));
  return {
    name: `Rubrica: ${theme.slice(0, 60)}`,
    description: `Borrador generado para: ${theme}`,
    criteria
  };
}

function buildFallbackChecklist(theme: string): { name: string; description: string; items: ChecklistItem[] } {
  const items = [
    "Comprende los conceptos clave",
    "Aplica el procedimiento correctamente",
    "Justifica su trabajo",
    "Usa vocabulario de la materia",
    "Entrega completa y ordenada"
  ].map((text) => ({ id: crypto.randomUUID(), text }));
  return {
    name: `Lista: ${theme.slice(0, 60)}`,
    description: `Borrador generado para: ${theme}`,
    items
  };
}

const today = toIsoDate(new Date());

export function TasksPage() {
  const selectedClassId = useAppSelector((state) => state.app.selectedClassId);
  const aiModel = useAppSelector((state) => state.app.aiModel);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<UnitBlock[]>([]);
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskSessions, setTaskSessions] = useState<TaskSession[]>([]);
  const [rubricTemplates, setRubricTemplates] = useState<RubricTemplate[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);

  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");

  const [detailTitle, setDetailTitle] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [detailUnitId, setDetailUnitId] = useState("");
  const [detailSendToGradebook, setDetailSendToGradebook] = useState(false);
  const [detailGradebookWeight, setDetailGradebookWeight] = useState("0");
  const [detailRubricTemplateId, setDetailRubricTemplateId] = useState("");
  const [detailChecklistTemplateId, setDetailChecklistTemplateId] = useState("");
  const [detailSessions, setDetailSessions] = useState<TaskSessionDraft[]>([]);
  const [taskNotice, setTaskNotice] = useState("");
  const [taskDirty, setTaskDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [aiTemplateMode, setAiTemplateMode] = useState<AITemplateMode>("rubric");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isModelLoadingOpen, setIsModelLoadingOpen] = useState(false);
  const [modelLoadStatus, setModelLoadStatus] = useState("Preparando modelo...");
  const [modelLoadProgress, setModelLoadProgress] = useState(0);

  const [sessionDate, setSessionDate] = useState(today);
  const [sessionSlotId, setSessionSlotId] = useState("");
  const engineRef = useRef<any>(null);

  const loadAll = async (): Promise<void> => {
    const [
      subjectsData,
      unitsData,
      scheduleDaysData,
      tasksData,
      taskSessionsData,
      rubricTemplatesData,
      checklistTemplatesData
    ] = await Promise.all([
      db.subjects.orderBy("name").toArray(),
      db.unitBlocks.orderBy("[subjectId+position]").toArray(),
      db.scheduleDays.orderBy("dayOfWeek").toArray(),
      db.tasks.toArray(),
      db.taskSessions.toArray(),
      selectedClassId ? db.rubricTemplates.where("classId").equals(selectedClassId).toArray() : Promise.resolve([]),
      selectedClassId
        ? db.checklistTemplates.where("classId").equals(selectedClassId).toArray()
        : Promise.resolve([])
    ]);

    setSubjects(subjectsData);
    setUnits(unitsData);
    setScheduleDays(scheduleDaysData);
    setTasks(tasksData);
    setTaskSessions(taskSessionsData);
    setRubricTemplates(rubricTemplatesData);
    setChecklistTemplates(checklistTemplatesData);
  };

  useEffect(() => {
    void loadAll();
  }, [selectedClassId]);

  useEffect(() => {
    if (subjects.length === 0) {
      setSelectedSubjectId("");
      return;
    }
    if (!subjects.some((item) => item.id === selectedSubjectId)) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [selectedSubjectId, subjects]);

  const tasksBySubject = useMemo(
    () => tasks.filter((item) => item.subjectId === selectedSubjectId),
    [selectedSubjectId, tasks]
  );

  useEffect(() => {
    if (tasksBySubject.length === 0) {
      setSelectedTaskId("");
      return;
    }
    if (!tasksBySubject.some((item) => item.id === selectedTaskId)) {
      setSelectedTaskId(tasksBySubject[0].id);
    }
  }, [selectedTaskId, tasksBySubject]);

  const selectedTask = useMemo(
    () => tasksBySubject.find((item) => item.id === selectedTaskId) ?? null,
    [selectedTaskId, tasksBySubject]
  );

  const selectedSubject = useMemo(
    () => subjects.find((item) => item.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjects]
  );

  const unitsBySubject = useMemo(
    () => units.filter((item) => item.subjectId === selectedSubjectId).sort((a, b) => a.position - b.position),
    [selectedSubjectId, units]
  );

  const taskCountById = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of taskSessions) {
      map.set(item.taskId, (map.get(item.taskId) ?? 0) + 1);
    }
    return map;
  }, [taskSessions]);

  const slotLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const day of scheduleDays) {
      for (const block of day.blocks) {
        map.set(block.id, `${day.dayName} ${block.startTime} - ${block.endTime}`);
      }
    }
    return map;
  }, [scheduleDays]);

  const availableSlotsForSessionDate = useMemo((): SlotOption[] => {
    if (!selectedSubject) {
      return [];
    }
    const dayOfWeek = isoDayOfWeek(sessionDate);
    if (dayOfWeek === 0) {
      return [];
    }
    const scheduleDay = scheduleDays.find((day) => day.enabled && day.dayOfWeek === dayOfWeek);
    if (!scheduleDay) {
      return [];
    }
    const slotIds = new Set(selectedSubject.scheduleSlotIds ?? []);
    return scheduleDay.blocks
      .filter((block) => slotIds.has(block.id))
      .map((block) => ({
        slotId: block.id,
        label: `${scheduleDay.dayName} ${block.startTime} - ${block.endTime}`
      }));
  }, [scheduleDays, selectedSubject, sessionDate]);

  useEffect(() => {
    if (availableSlotsForSessionDate.length === 0) {
      setSessionSlotId("");
      return;
    }
    const exists = availableSlotsForSessionDate.some((item) => item.slotId === sessionSlotId);
    if (!exists) {
      setSessionSlotId(availableSlotsForSessionDate[0].slotId);
    }
  }, [availableSlotsForSessionDate, sessionSlotId]);

  useEffect(() => {
    if (!selectedTask) {
      setDetailTitle("");
      setDetailDescription("");
      setDetailUnitId("");
      setDetailSendToGradebook(false);
      setDetailGradebookWeight("0");
      setDetailRubricTemplateId("");
      setDetailChecklistTemplateId("");
      setDetailSessions([]);
      setTaskNotice("");
      setTaskDirty(false);
      return;
    }
    setDetailTitle(selectedTask.title);
    setDetailDescription(selectedTask.description ?? "");
    setDetailUnitId(selectedTask.unitId ?? "");
    setDetailSendToGradebook(Boolean(selectedTask.sendToGradebook));
    setDetailGradebookWeight(String(selectedTask.gradebookWeight ?? 0));
    if (selectedTask.rubricTemplateId) {
      setDetailRubricTemplateId(selectedTask.rubricTemplateId);
      setDetailChecklistTemplateId("");
    } else {
      setDetailRubricTemplateId("");
      setDetailChecklistTemplateId(selectedTask.checklistTemplateId ?? "");
    }
    setDetailSessions(normalizeTaskSessions(taskSessions.filter((item) => item.taskId === selectedTask.id)));
    setTaskNotice("");
    setTaskDirty(false);
  }, [selectedTask, taskSessions]);

  const availableRubricTemplates = useMemo(
    () =>
      rubricTemplates.filter((template) => !template.taskId || (selectedTask ? template.taskId === selectedTask.id : false)),
    [rubricTemplates, selectedTask]
  );

  const availableChecklistTemplates = useMemo(
    () =>
      checklistTemplates.filter((template) =>
        !template.taskId || (selectedTask ? template.taskId === selectedTask.id : false)
      ),
    [checklistTemplates, selectedTask]
  );

  const ensureNoPendingChanges = (): boolean => {
    if (!taskDirty) {
      return true;
    }
    setShowUnsavedModal(true);
    return false;
  };

  useUnsavedChangesGuard(taskDirty);

  const createTask = async (): Promise<void> => {
    if (!selectedSubjectId) {
      return;
    }
    const id = crypto.randomUUID();
    const defaultUnit = units
      .filter((item) => item.subjectId === selectedSubjectId)
      .sort((a, b) => a.position - b.position)[0];
    await db.tasks.add({
      id,
      subjectId: selectedSubjectId,
      unitId: defaultUnit?.id,
      title: "",
      description: "",
      sendToGradebook: false,
      gradebookWeight: 0,
      rubricTemplateId: undefined,
      checklistTemplateId: undefined
    });
    await loadAll();
    setSelectedTaskId(id);
  };

  const deleteTask = async (taskId: string): Promise<void> => {
    await db.transaction(
      "rw",
      [
        db.tasks,
        db.taskSessions,
        db.taskStudentComments,
        db.taskDailyEvaluationSettings,
        db.taskRubricAssessments,
        db.taskChecklistAssessments,
        db.rubricTemplates,
        db.checklistTemplates
      ],
      async () => {
        await db.tasks.delete(taskId);
        await db.taskSessions.where("taskId").equals(taskId).delete();
        await db.taskStudentComments.where("taskId").equals(taskId).delete();
        await db.taskDailyEvaluationSettings.where("taskId").equals(taskId).delete();
        await db.taskRubricAssessments.where("taskId").equals(taskId).delete();
        await db.taskChecklistAssessments.where("taskId").equals(taskId).delete();
        const taskRubrics = await db.rubricTemplates.where("taskId").equals(taskId).toArray();
        if (taskRubrics.length > 0) {
          await db.rubricTemplates.bulkDelete(taskRubrics.map((item) => item.id));
        }
        const taskChecklists = await db.checklistTemplates.where("taskId").equals(taskId).toArray();
        if (taskChecklists.length > 0) {
          await db.checklistTemplates.bulkDelete(taskChecklists.map((item) => item.id));
        }
      }
    );
    await loadAll();
  };

  const persistTask = async (): Promise<boolean> => {
    if (!selectedTask || !taskDirty || !selectedSubjectId) {
      return true;
    }

    const title = detailTitle.trim();
    if (title.length < 2) {
      setTaskNotice("La tarea necesita un título (mínimo 2 caracteres).");
      return false;
    }

    if (!detailUnitId) {
      setTaskNotice("Selecciona una unidad para la tarea.");
      return false;
    }

    const parsedTaskWeight = Number(detailGradebookWeight.replace(",", ".").trim());
    if (Number.isNaN(parsedTaskWeight) || parsedTaskWeight < 0) {
      setTaskNotice("El peso de cuaderno debe ser un número igual o mayor que 0.");
      return false;
    }
    if (detailRubricTemplateId && detailChecklistTemplateId) {
      setTaskNotice("La tarea solo puede tener rúbrica o lista de cotejo, no ambas.");
      return false;
    }

    const selectedSlotIds = new Set(selectedSubject?.scheduleSlotIds ?? []);
    const normalizedSessions: TaskSessionDraft[] = [];
    const seenSessionKeys = new Set<string>();
    for (const item of detailSessions) {
      const dayOfWeek = isoDayOfWeek(item.date);
      const day = scheduleDays.find((row) => row.enabled && row.dayOfWeek === dayOfWeek);
      const slotValidForDay = day?.blocks.some((block) => block.id === item.scheduleSlotId) ?? false;
      if (!selectedSlotIds.has(item.scheduleSlotId) || !slotValidForDay) {
        continue;
      }
      const key = uniqueSessionKey(item);
      if (seenSessionKeys.has(key)) {
        continue;
      }
      seenSessionKeys.add(key);
      normalizedSessions.push(item);
    }
    normalizedSessions.sort(compareSessionDraft);
    if (normalizedSessions.length === 0) {
      setTaskNotice("Asigna al menos una sesión de horario a la tarea.");
      return false;
    }

    await db.transaction("rw", db.tasks, db.taskSessions, async () => {
      await db.tasks.put({
        ...selectedTask,
        subjectId: selectedSubjectId,
        unitId: detailUnitId || undefined,
        title,
        description: detailDescription.trim(),
        sendToGradebook: detailSendToGradebook,
        gradebookWeight: Number(parsedTaskWeight.toFixed(2)),
        rubricTemplateId: detailRubricTemplateId || undefined,
        checklistTemplateId: detailChecklistTemplateId || undefined
      });

      await db.taskSessions.where("taskId").equals(selectedTask.id).delete();
      if (normalizedSessions.length > 0) {
        await db.taskSessions.bulkAdd(
          normalizedSessions.map((item) => ({
            id: crypto.randomUUID(),
            taskId: selectedTask.id,
            subjectId: selectedSubjectId,
            date: item.date,
            scheduleSlotId: item.scheduleSlotId
          }))
        );
      }
    });

    setTaskNotice("Tarea guardada.");
    setTaskDirty(false);
    await loadAll();
    return true;
  };

  const createManualRubricTemplate = async (): Promise<void> => {
    if (!selectedClassId || !selectedTask) {
      setTaskNotice("Selecciona una clase para crear una rubrica.");
      return;
    }
    const id = crypto.randomUUID();
    const levelDefs: RubricLevel[] = [
      { id: crypto.randomUUID(), name: "Excelente", score: 4 },
      { id: crypto.randomUUID(), name: "Notable", score: 3 },
      { id: crypto.randomUUID(), name: "Basico", score: 2 },
      { id: crypto.randomUUID(), name: "Inicial", score: 1 }
    ];
    const criteria: RubricCriterion[] = ["Comprension", "Aplicacion", "Comunicacion"].map((name) => ({
      id: crypto.randomUUID(),
      name,
      levels: levelDefs.map((level) => ({ ...level, id: crypto.randomUUID() }))
    }));
    await db.rubricTemplates.add({
      id,
      classId: selectedClassId,
      taskId: selectedTask.id,
      name: `Rubrica ${detailTitle.trim() || "nueva tarea"}`,
      description: "",
      criteria
    });
    await loadAll();
    setDetailRubricTemplateId(id);
    setDetailChecklistTemplateId("");
    setTaskDirty(true);
    setTaskNotice("Rubrica a medida creada y asignada.");
  };

  const createManualChecklistTemplate = async (): Promise<void> => {
    if (!selectedClassId || !selectedTask) {
      setTaskNotice("Selecciona una clase para crear una lista de cotejo.");
      return;
    }
    const id = crypto.randomUUID();
    const items: ChecklistItem[] = [
      "Comprende los conceptos clave",
      "Aplica correctamente el procedimiento",
      "Justifica su respuesta",
      "Usa vocabulario especifico",
      "Entrega completa"
    ].map((text) => ({ id: crypto.randomUUID(), text }));
    await db.checklistTemplates.add({
      id,
      classId: selectedClassId,
      taskId: selectedTask.id,
      name: `Lista ${detailTitle.trim() || "nueva tarea"}`,
      description: "",
      items
    });
    await loadAll();
    setDetailChecklistTemplateId(id);
    setDetailRubricTemplateId("");
    setTaskDirty(true);
    setTaskNotice("Lista de cotejo a medida creada y asignada.");
  };

  const getAIEngine = async (): Promise<any | null> => {
    let webllm: any = null;
    try {
      webllm = await import("@mlc-ai/web-llm");
    } catch {
      webllm = null;
    }
    if (!webllm) {
      return null;
    }
    const createEngine =
      webllm.CreateMLCEngine ??
      webllm.CreateWebWorkerMLCEngine ??
      webllm.createMLCEngine;
    if (!createEngine) {
      return null;
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
            }
          }
        });
      } catch {
        engineRef.current = await createEngine(aiModel);
      } finally {
        setIsModelLoadingOpen(false);
      }
    }
    return engineRef.current;
  };

  const createTemplateWithAI = async (): Promise<void> => {
    if (!selectedClassId || !selectedTask) {
      setTaskNotice("Selecciona una clase para generar instrumentos con IA.");
      return;
    }
    const theme = aiPrompt.trim();
    if (!theme) {
      setTaskNotice("Escribe una consigna para la IA.");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const engine = await getAIEngine();
      if (!engine) {
        setTaskNotice("No se pudo cargar WebLLM en este navegador.");
        return;
      }

      if (aiTemplateMode === "rubric") {
        const response = await withTimeout<any>(
          engine.chat.completions.create({
            messages: [
              {
                role: "system",
                content: "Devuelve solo JSON valido para una rubrica academica."
              },
              {
                role: "user",
                content: [
                  `Tema: ${theme}`,
                  'Formato: {"name":"","description":"","criteria":[{"name":"","levels":[{"name":"","score":4},{"name":"","score":3},{"name":"","score":2},{"name":"","score":1}]}]}',
                  "Minimo 3 criterios."
                ].join("\n")
              }
            ],
            temperature: 0.2,
            max_tokens: 650,
            enable_thinking: false
          }),
          AI_GENERATION_TIMEOUT_MS,
          "La generacion ha tardado demasiado."
        );
        const parsed = parseFirstJsonObject(extractMessageText(response));
        const criteria: RubricCriterion[] = (parsed?.criteria ?? [])
          .map((criterion: any) => ({
            id: crypto.randomUUID(),
            name: String(criterion?.name ?? "").trim(),
            levels: (criterion?.levels ?? [])
              .map((level: any) => ({
                id: crypto.randomUUID(),
                name: String(level?.name ?? "").trim(),
                score: Number(level?.score)
              }))
              .filter((level: RubricLevel) => level.name.length > 0 && Number.isFinite(level.score))
          }))
          .filter((criterion: RubricCriterion) => criterion.name.length > 0 && (criterion.levels?.length ?? 0) >= 2);

        const rubricData =
          criteria.length > 0
            ? {
                name: String(parsed?.name ?? "").trim() || `Rubrica ${theme.slice(0, 60)}`,
                description: String(parsed?.description ?? "").trim(),
                criteria
              }
            : buildFallbackRubric(theme);

        const rubricId = crypto.randomUUID();
        await db.rubricTemplates.add({
          id: rubricId,
          classId: selectedClassId,
          taskId: selectedTask.id,
          name: rubricData.name,
          description: rubricData.description || undefined,
          criteria: rubricData.criteria
        });
        await loadAll();
        setDetailRubricTemplateId(rubricId);
        setDetailChecklistTemplateId("");
        setTaskDirty(true);
        setTaskNotice("Rubrica creada con IA y asignada.");
      } else {
        const response = await withTimeout<any>(
          engine.chat.completions.create({
            messages: [
              {
                role: "system",
                content: "Devuelve solo JSON valido para una lista de cotejo academica."
              },
              {
                role: "user",
                content: [
                  `Tema: ${theme}`,
                  'Formato: {"name":"","description":"","items":[{"text":""}]}',
                  "Minimo 5 items."
                ].join("\n")
              }
            ],
            temperature: 0.2,
            max_tokens: 450,
            enable_thinking: false
          }),
          AI_GENERATION_TIMEOUT_MS,
          "La generacion ha tardado demasiado."
        );
        const parsed = parseFirstJsonObject(extractMessageText(response));
        const aiItems: ChecklistItem[] = (parsed?.items ?? [])
          .map((item: any) => {
            if (typeof item === "string") {
              return { id: crypto.randomUUID(), text: item.trim() };
            }
            return {
              id: crypto.randomUUID(),
              text: String(item?.text ?? item?.name ?? item?.item ?? "").trim()
            };
          })
          .filter((item: ChecklistItem) => item.text.length > 0);
        const checklistData =
          aiItems.length > 0
            ? {
                name: String(parsed?.name ?? "").trim() || `Lista ${theme.slice(0, 60)}`,
                description: String(parsed?.description ?? "").trim(),
                items: aiItems
              }
            : buildFallbackChecklist(theme);
        const checklistId = crypto.randomUUID();
        await db.checklistTemplates.add({
          id: checklistId,
          classId: selectedClassId,
          taskId: selectedTask.id,
          name: checklistData.name,
          description: checklistData.description || undefined,
          items: checklistData.items
        });
        await loadAll();
        setDetailChecklistTemplateId(checklistId);
        setDetailRubricTemplateId("");
        setTaskDirty(true);
        setTaskNotice("Lista de cotejo creada con IA y asignada.");
      }
      setIsAIModalOpen(false);
      setAiPrompt("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setTaskNotice(`No se pudo generar el instrumento con IA (${message}).`);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const addSessionToTask = (): void => {
    if (!sessionDate || !sessionSlotId) {
      return;
    }
    const nextItem: TaskSessionDraft = {
      date: sessionDate,
      scheduleSlotId: sessionSlotId
    };
    const key = uniqueSessionKey(nextItem);
    if (detailSessions.some((item) => uniqueSessionKey(item) === key)) {
      return;
    }
    setDetailSessions((current) => [...current, nextItem].sort(compareSessionDraft));
    setTaskNotice("");
    setTaskDirty(true);
  };

  return (
    <>
      <section className="module-card">
        <h2>Tareas</h2>

        <div className="courses-layout">
          <aside className="courses-list-panel">
            <div className="courses-list-header">
              <strong>Asignatura</strong>
            </div>
            <div className="inline-form">
              <select
                className="input"
                value={selectedSubjectId}
                onChange={(event) => {
                  if (!ensureNoPendingChanges()) {
                    return;
                  }
                  setSelectedSubjectId(event.target.value);
                }}
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="courses-list-header" style={{ marginTop: 10 }}>
              <strong>Tareas</strong>
              <IconButton
                icon="add"
                label="Crear tarea"
                onClick={async () => {
                  if (!ensureNoPendingChanges()) {
                    return;
                  }
                  await createTask();
                }}
              />
            </div>
            <div className="courses-list section-tabs" role="tablist" aria-label="Listado de tareas">
              {tasksBySubject.map((task) => (
                <div key={task.id} className="courses-list-row">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedTaskId === task.id}
                    className={`section-tab ${selectedTaskId === task.id ? "active" : ""}`}
                    onClick={() => {
                      if (!ensureNoPendingChanges()) {
                        return;
                      }
                      setSelectedTaskId(task.id);
                    }}
                  >
                    <span>{task.title || "Tarea sin título"}</span>
                    <small>
                      {units.find((unit) => unit.id === task.unitId)?.name ?? "Sin unidad"}
                    </small>
                    <small>{taskCountById.get(task.id) ?? 0} sesiones</small>
                  </button>
                  <IconButton
                    icon="delete"
                    label={`Eliminar ${task.title || "tarea"}`}
                    onClick={async () => {
                      if (!ensureNoPendingChanges()) {
                        return;
                      }
                      await deleteTask(task.id);
                    }}
                  />
                </div>
              ))}
              {tasksBySubject.length === 0 ? <p className="hint">No hay tareas para esta asignatura.</p> : null}
            </div>
          </aside>

          <section className="course-detail-panel">
            {selectedTask ? (
              <>
                <div className="course-detail-header">
                  <h4>Detalle de tarea</h4>
                  <div className="actions-cell">
                    <IconButton
                      icon="save"
                      label="Guardar tarea"
                      className={taskDirty ? "save-attention" : ""}
                      disabled={!taskDirty}
                      onClick={async () => {
                        await persistTask();
                      }}
                    />
                  </div>
                </div>

                <section className="detail-section">
                  <h5>Configuración</h5>
                  <div className="detail-grid">
                    <div className="detail-field full">
                      <label>Título</label>
                      <input
                        className="input"
                        value={detailTitle}
                        placeholder="Título de la tarea"
                        onChange={(event) => {
                          setDetailTitle(event.target.value);
                          setTaskNotice("");
                          setTaskDirty(true);
                        }}
                      />
                    </div>
                    <div className="detail-field full">
                      <label>Descripción</label>
                      <textarea
                        className="input"
                        value={detailDescription}
                        placeholder="Instrucciones de la tarea"
                        onChange={(event) => {
                          setDetailDescription(event.target.value);
                          setTaskNotice("");
                          setTaskDirty(true);
                        }}
                      />
                    </div>
                    <div className="detail-field">
                      <label>Unidad</label>
                      <select
                        className="input"
                        value={detailUnitId}
                        onChange={(event) => {
                          setDetailUnitId(event.target.value);
                          setTaskNotice("");
                          setTaskDirty(true);
                        }}
                      >
                        {unitsBySubject.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="detail-field">
                      <label>Cuaderno</label>
                      <label className="chip-toggle">
                        <input
                          type="checkbox"
                          checked={detailSendToGradebook}
                          onChange={(event) => {
                            setDetailSendToGradebook(event.target.checked);
                            setTaskNotice("");
                            setTaskDirty(true);
                          }}
                        />
                        Incluir en cuaderno
                      </label>
                    </div>
                    <div className="detail-field">
                      <label>Peso en cuaderno</label>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step={0.1}
                        disabled={!detailSendToGradebook}
                        value={detailGradebookWeight}
                        onChange={(event) => {
                          setDetailGradebookWeight(event.target.value);
                          setTaskNotice("");
                          setTaskDirty(true);
                        }}
                      />
                    </div>
                    <div className="detail-field full">
                      <label>Rubrica asignada</label>
                      <div className="inline-form">
                        <select
                          className="input"
                          value={detailRubricTemplateId}
                          onChange={(event) => {
                            const value = event.target.value;
                            setDetailRubricTemplateId(value);
                            if (value) {
                              setDetailChecklistTemplateId("");
                            }
                            setTaskNotice("");
                            setTaskDirty(true);
                          }}
                        >
                          <option value="">Sin rubrica</option>
                          {availableRubricTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                        <IconButton
                          icon="add"
                          label="Crear rubrica a medida"
                          onClick={async () => {
                            await createManualRubricTemplate();
                          }}
                        />
                        <IconButton
                          icon="ai"
                          label="Crear rubrica con IA"
                          onClick={() => {
                            setAiTemplateMode("rubric");
                            setAiPrompt("");
                            setIsAIModalOpen(true);
                          }}
                        />
                      </div>
                    </div>
                    <div className="detail-field full">
                      <label>Lista de cotejo asignada</label>
                      <div className="inline-form">
                        <select
                          className="input"
                          value={detailChecklistTemplateId}
                          onChange={(event) => {
                            const value = event.target.value;
                            setDetailChecklistTemplateId(value);
                            if (value) {
                              setDetailRubricTemplateId("");
                            }
                            setTaskNotice("");
                            setTaskDirty(true);
                          }}
                        >
                          <option value="">Sin lista de cotejo</option>
                          {availableChecklistTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                        <IconButton
                          icon="add"
                          label="Crear lista a medida"
                          onClick={async () => {
                            await createManualChecklistTemplate();
                          }}
                        />
                        <IconButton
                          icon="ai"
                          label="Crear lista con IA"
                          onClick={() => {
                            setAiTemplateMode("checklist");
                            setAiPrompt("");
                            setIsAIModalOpen(true);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  {taskNotice ? <p className="hint">{taskNotice}</p> : null}
                </section>

                <section className="detail-section">
                  <h5>Sesiones de horario</h5>
                  <div className="inline-form">
                    <input
                      className="input"
                      type="date"
                      value={sessionDate}
                      onChange={(event) => setSessionDate(event.target.value)}
                    />
                    <select
                      className="input"
                      value={sessionSlotId}
                      onChange={(event) => setSessionSlotId(event.target.value)}
                    >
                      {availableSlotsForSessionDate.map((slot) => (
                        <option key={slot.slotId} value={slot.slotId}>
                          {slot.label}
                        </option>
                      ))}
                      {availableSlotsForSessionDate.length === 0 ? (
                        <option value="">No hay bloques para ese día</option>
                      ) : null}
                    </select>
                    <IconButton
                      icon="add"
                      label="Añadir sesión"
                      onClick={addSessionToTask}
                      disabled={!sessionDate || !sessionSlotId}
                    />
                  </div>

                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Bloque</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailSessions.map((item, index) => (
                          <tr key={`${item.date}:${item.scheduleSlotId}:${index}`}>
                            <td>{item.date}</td>
                            <td>{slotLabelById.get(item.scheduleSlotId) ?? item.scheduleSlotId}</td>
                            <td className="actions-cell">
                              <IconButton
                                icon="remove"
                                label="Quitar sesión"
                                onClick={() => {
                                  setDetailSessions((current) =>
                                    current.filter((_, currentIndex) => currentIndex !== index)
                                  );
                                  setTaskNotice("");
                                  setTaskDirty(true);
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                        {detailSessions.length === 0 ? (
                          <tr>
                            <td colSpan={3}>No hay sesiones asignadas.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>

              </>
            ) : (
              <p>Selecciona o crea una tarea para editarla.</p>
            )}
          </section>
        </div>
      </section>

      <Modal
        open={showUnsavedModal}
        title="Cambios sin guardar"
        onClose={() => setShowUnsavedModal(false)}
      >
        <p>Tienes cambios sin guardar. Pulsa Guardar tarea antes de continuar.</p>
        <div className="inline-form">
          <button type="button" className="btn" onClick={() => setShowUnsavedModal(false)}>
            Entendido
          </button>
        </div>
      </Modal>

      <Modal
        open={isAIModalOpen}
        title={aiTemplateMode === "rubric" ? "Crear rubrica con IA" : "Crear lista de cotejo con IA"}
        onClose={() => {
          if (!isGeneratingAI) {
            setIsAIModalOpen(false);
          }
        }}
      >
        <div className="detail-grid">
          <div className="detail-field full">
            <label>Indica que quieres generar</label>
            <textarea
              className="input"
              placeholder={
                aiTemplateMode === "rubric"
                  ? "Ej: Rubrica para exposicion oral en 2 ESO de Biologia."
                  : "Ej: Lista de cotejo para practica de laboratorio."
              }
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
            />
          </div>
        </div>
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
            className="btn"
            disabled={isGeneratingAI}
            onClick={async () => {
              await createTemplateWithAI();
            }}
          >
            {isGeneratingAI ? "Generando..." : "Generar y asignar"}
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
