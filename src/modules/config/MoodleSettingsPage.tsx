import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { obtainMoodleToken } from "../../shared/moodle/auth";
import { hasConnectionPreference, useConnectionPreference } from "../../shared/hooks/useConnectionPreference";
import { readMoodleToken, removeMoodleToken, saveMoodleToken } from "../../shared/moodle/credentials";
import { db } from "../../shared/db/database";
import type { ClassGroup, Student, Subject, Task } from "../../shared/db/types";
import { createMoodleClient, normalizeMoodleUrl, type MoodleClient } from "../../shared/moodle/client";
import {
  applyGrades,
  applyMappingPreview,
  applyUpdates,
  createLocalScope,
  createMappingPreview,
  forgetConnection,
  getBindings,
  getOperations,
  listConnections,
  previewGrades,
  previewUpdates,
  saveConnection,
  type MoodleGradePreview,
  type MoodleMappingPreview,
  type MoodleUpdatePreview
} from "../../shared/moodle/service";
import type {
  MoodleBinding,
  MoodleConnection,
  MoodleCourse,
  MoodleCourseSnapshot,
  MoodleMappingChoice,
  MoodleOperation,
  MoodleResolution,
  MoodleScope
} from "../../shared/moodle/types";
import { MoodleWorkflowStepper, type MoodleWorkflowStep } from "./MoodleWorkflowStepper";
import "./MoodleSettingsPage.css";


type Notice = { tone: "info" | "success" | "error"; text: string };
type BusyAction = "connect" | "snapshot" | "mapping-preview" | "mapping-apply" | "updates-preview" | "updates-apply" | "grades-preview" | "grades-apply" | "forget" | "scope-create" | null;
type MappingDraft = { action: MoodleMappingChoice["action"]; localId?: string };

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "Operación cancelada.";
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}

function formatDate(value?: number | string): string {
  if (value === undefined) return "Sin fecha";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : dateFormatter.format(date);
}

function mappingKey(kind: "student" | "activity", remoteId: number): string {
  return `${kind}:${remoteId}`;
}

function workflowContextKey(snapshot: MoodleCourseSnapshot | null, scope: MoodleScope | null): string | null {
  if (!snapshot || !scope) return null;
  return `${snapshot.fetchedAt}:${scope.courseId}:${scope.remoteGroupId ?? "all"}:${scope.classId}:${scope.subjectId}`;
}

function capabilityLabel(name: string): string {
  const labels: Record<string, string> = {
    core_enrol_get_enrolled_users: "Participantes",
    core_group_get_course_groups: "Grupos de Moodle",
    core_course_get_contents: "Actividades",
    mod_assign_get_assignments: "Tareas",
    mod_assign_get_grades: "Lectura de calificaciones",
    mod_assign_get_submissions: "Estado de entregas"
  };
  return labels[name] ?? name;
}

function fieldLabel(field: string): string {
  return ({ firstName: "Nombre", lastName: "Apellidos", fullName: "Nombre completo", email: "Correo", title: "Título" } as Record<string, string>)[field] ?? field;
}

function mappingActionLabel(action: MoodleMappingChoice["action"]): string {
  return ({ link: "Vincular", create: "Crear", ignore: "Ignorar", unlink: "Quitar asociación" })[action];
}

function operationKindLabel(kind: MoodleOperation["kind"]): string {
  return ({ link: "asociaciones", update: "actualizaciones", grades: "calificaciones" })[kind];
}

function submissionStatusLabel(status: string): string {
  return ({ submitted: "Entregada", new: "Sin entregar", draft: "Borrador", graded: "Calificada", reopened: "Reabierta" } as Record<string, string>)[status.toLowerCase()] ?? status;
}

export function MoodleSettingsPage() {
  const [searchParams] = useSearchParams();
  const activeSection = searchParams.get("section") === "data" ? "data" : "config";
  const clientRef = useRef<MoodleClient | null>(null);
  const pendingClientRef = useRef<MoodleClient | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [configStep, setConfigStep] = useState("server");
  const [dataStep, setDataStep] = useState("scope");
  const [notice, setNotice] = useState<Notice>({ tone: "info", text: "Conecta tu cuenta cuando necesites consultar datos de Moodle." });
  const restorePreviousServer = useRef(!hasConnectionPreference("moodle.server"));
  const [server, setServer] = useConnectionPreference("moodle.server");
  const [token, setToken] = useState(() => readMoodleToken(server)?.token ?? "");
  const [hasSavedToken, setHasSavedToken] = useState(() => Boolean(readMoodleToken(server)));
  const [authMode, setAuthMode] = useConnectionPreference("moodle.authMode", "token");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [service, setService] = useConnectionPreference("moodle.service", "moodle_mobile_app");
  const [connections, setConnections] = useState<MoodleConnection[]>([]);
  const [connection, setConnection] = useState<MoodleConnection | null>(null);
  const [forgetTarget, setForgetTarget] = useState<string | null>(null);
  const [courses, setCourses] = useState<MoodleCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [snapshot, setSnapshot] = useState<MoodleCourseSnapshot | null>(null);
  const [bindings, setBindings] = useState<MoodleBinding[]>([]);
  const [operations, setOperations] = useState<MoodleOperation[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjectCourseKeys, setSubjectCourseKeys] = useState<Set<string>>(new Set());
  const [subjectStudentKeys, setSubjectStudentKeys] = useState<Set<string>>(new Set());
  const [taskSubjectKeys, setTaskSubjectKeys] = useState<Set<string>>(new Set());
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, MappingDraft>>({});
  const [mappingPreview, setMappingPreview] = useState<MoodleMappingPreview | null>(null);
  const [updatePreview, setUpdatePreview] = useState<MoodleUpdatePreview | null>(null);
  const [updateResolutions, setUpdateResolutions] = useState<Record<string, MoodleResolution>>({});
  const [gradePreview, setGradePreview] = useState<MoodleGradePreview | null>(null);
  const [gradeResolutions, setGradeResolutions] = useState<Record<string, MoodleResolution>>({});
  const [changesReviewedFor, setChangesReviewedFor] = useState<string | null>(null);
  const [createScopeOpen, setCreateScopeOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassLevel, setNewClassLevel] = useState("");
  const [newSchoolYear, setNewSchoolYear] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");

  const cancelPending = (announce = false): void => {
    requestVersionRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    pendingClientRef.current?.dispose();
    pendingClientRef.current = null;
    setBusy(null);
    setPassword("");
    if (announce) setNotice({ tone: "info", text: "Operación cancelada. No se ha aplicado ningún cambio local nuevo." });
  };

  const beginRequest = (action: Exclude<BusyAction, null>): { controller: AbortController; version: number } => {
    cancelPending();
    const controller = new AbortController();
    abortRef.current = controller;
    const version = requestVersionRef.current;
    setBusy(action);
    return { controller, version };
  };

  const isCurrent = (version: number): boolean => version === requestVersionRef.current;

  const reloadMetadata = async (connectionId?: string, version?: number): Promise<void> => {
    const [savedConnections, recentOperations] = await Promise.all([
      listConnections(),
      getOperations(connectionId, 8)
    ]);
    if (version !== undefined && !isCurrent(version)) return;
    setConnections(savedConnections);
    setOperations(recentOperations);
  };

  const reloadLocalCandidates = async (): Promise<void> => {
    const [localClasses, localSubjects, localStudents, localTasks, courseLinks, studentLinks, taskLinks] = await Promise.all([
      db.classGroups.orderBy("name").toArray(),
      db.subjects.orderBy("name").toArray(),
      db.students.toArray(),
      db.tasks.toArray(),
      db.subjectCourseLinks.toArray(),
      db.subjectStudentLinks.toArray(),
      db.taskSubjectLinks.toArray()
    ]);
    setClasses(localClasses);
    setSubjects(localSubjects);
    setStudents(localStudents);
    setTasks(localTasks);
    setSubjectCourseKeys(new Set(courseLinks.map((link) => `${link.classId}:${link.subjectId}`)));
    setSubjectStudentKeys(new Set(studentLinks.map((link) => `${link.subjectId}:${link.studentId}`)));
    setTaskSubjectKeys(new Set(taskLinks.map((link) => `${link.taskId}:${link.subjectId}`)));
  };

  useEffect(() => {
    let active = true;
    void Promise.all([
      listConnections(),
      getOperations(undefined, 8),
      db.classGroups.orderBy("name").toArray(),
      db.subjects.orderBy("name").toArray(),
      db.students.toArray(),
      db.tasks.toArray(),
      db.subjectCourseLinks.toArray(),
      db.subjectStudentLinks.toArray(),
      db.taskSubjectLinks.toArray()
    ]).then(([savedConnections, recentOperations, localClasses, localSubjects, localStudents, localTasks, courseLinks, studentLinks, taskLinks]) => {
      if (!active) return;
      if (restorePreviousServer.current && savedConnections.length) {
        const previous = [...savedConnections].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        setServer((current) => current || previous.server);
        setToken(readMoodleToken(previous.server)?.token ?? "");
        setHasSavedToken(Boolean(readMoodleToken(previous.server)));
        restorePreviousServer.current = false;
      }
      setConnections(savedConnections);
      setOperations(recentOperations);
      setClasses(localClasses);
      setSubjects(localSubjects);
      setStudents(localStudents);
      setTasks(localTasks);
      setSubjectCourseKeys(new Set(courseLinks.map((link) => `${link.classId}:${link.subjectId}`)));
      setSubjectStudentKeys(new Set(studentLinks.map((link) => `${link.subjectId}:${link.studentId}`)));
      setTaskSubjectKeys(new Set(taskLinks.map((link) => `${link.taskId}:${link.subjectId}`)));
    }).catch((error) => {
      if (active) setNotice({ tone: "error", text: errorMessage(error) });
    });
    return () => {
      active = false;
      requestVersionRef.current += 1;
      abortRef.current?.abort();
      pendingClientRef.current?.dispose();
      pendingClientRef.current = null;
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, [setServer]);

  const scope = useMemo<MoodleScope | null>(() => {
    if (!selectedCourseId || !selectedClassId || !selectedSubjectId) return null;
    return {
      courseId: Number(selectedCourseId),
      ...(selectedGroupId ? { remoteGroupId: Number(selectedGroupId) } : {}),
      classId: selectedClassId,
      subjectId: selectedSubjectId
    };
  }, [selectedClassId, selectedCourseId, selectedGroupId, selectedSubjectId]);

  const availableSubjects = useMemo(
    () => subjects.filter((subject) => !selectedClassId || subjectCourseKeys.has(`${selectedClassId}:${subject.id}`)),
    [selectedClassId, subjectCourseKeys, subjects]
  );
  const localStudents = useMemo(() => students.filter((student) => student.classId === selectedClassId && subjectStudentKeys.has(`${selectedSubjectId}:${student.id}`)), [selectedClassId, selectedSubjectId, students, subjectStudentKeys]);
  const localTasks = useMemo(() => tasks.filter((task) => taskSubjectKeys.has(`${task.id}:${selectedSubjectId}`)), [selectedSubjectId, taskSubjectKeys, tasks]);
  const scopedRemoteStudents = useMemo(() => {
    if (!snapshot) return [];
    if (!selectedGroupId) return snapshot.students;
    const memberIds = new Set(snapshot.groups.find((group) => group.id === Number(selectedGroupId))?.memberIds ?? []);
    return snapshot.students.filter((student) => memberIds.has(student.id));
  }, [selectedGroupId, snapshot]);
  const scopedBindings = useMemo(() => bindings.filter((item) => scope &&
    item.connectionId === connection?.id &&
    item.courseId === scope.courseId &&
    item.classId === scope.classId &&
    item.subjectId === scope.subjectId &&
    item.remoteGroupId === scope.remoteGroupId
  ), [bindings, connection?.id, scope]);
  const hasScopedLinks = scopedBindings.some((item) => item.kind === "student" || item.kind === "activity");
  const currentWorkflowContext = workflowContextKey(snapshot, scope);
  const hasValidServer = useMemo(() => {
    try {
      normalizeMoodleUrl(server);
      return true;
    } catch {
      return false;
    }
  }, [server]);
  const configSteps: MoodleWorkflowStep[] = [
    { id: "server", label: "Dirección", description: "Servidor Moodle" },
    { id: "access", label: "Acceso", description: "Token o inicio de sesión", disabled: !hasValidServer },
    { id: "connected", label: "Cuenta conectada", description: "Solo lectura", disabled: !connection, complete: Boolean(connection) }
  ];
  const dataSteps: MoodleWorkflowStep[] = [
    { id: "scope", label: "Curso y destino", description: "Moodle y Edunoza", complete: Boolean(snapshot && scope) },
    { id: "mappings", label: "Asociaciones", description: "Participantes y actividades", disabled: !snapshot || !scope },
    { id: "changes", label: "Cambios", description: "Nombres y títulos", disabled: !snapshot || !scope || !hasScopedLinks },
    { id: "grades", label: "Calificaciones", description: "Revisión local", disabled: !snapshot || !scope || !hasScopedLinks || changesReviewedFor !== currentWorkflowContext }
  ];

  const clearPreviews = (): void => {
    setMappingPreview(null);
    setUpdatePreview(null);
    setUpdateResolutions({});
    setGradePreview(null);
    setGradeResolutions({});
    setChangesReviewedFor(null);
  };

  const changeScope = (update: () => void): void => {
    cancelPending();
    update();
    setMappingDrafts({});
    clearPreviews();
  };

  const connect = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    let credential = token.trim();
    if (authMode === "token" ? !credential : !username.trim() || !password) return;
    const { version, controller } = beginRequest("connect");
    setNotice({ tone: "info", text: "Comprobando la cuenta de Moodle…" });
    try {
      const normalizedServer = normalizeMoodleUrl(server);
      if (authMode === "password") {
        credential = await obtainMoodleToken(normalizedServer, username, password, service, { signal: controller.signal });
        if (!isCurrent(version)) return;
      }
      const nextClient = createMoodleClient(normalizedServer, credential);
      pendingClientRef.current = nextClient;
      const [site, availableCourses] = await Promise.all([nextClient.getSiteInfo(), nextClient.getCourses()]);
      if (!isCurrent(version)) {
        nextClient.dispose();
        if (pendingClientRef.current === nextClient) pendingClientRef.current = null;
        return;
      }
      const savedConnection = await saveConnection(site, controller.signal);
      if (!isCurrent(version)) {
        nextClient.dispose();
        if (pendingClientRef.current === nextClient) pendingClientRef.current = null;
        return;
      }
      clientRef.current?.dispose();
      clientRef.current = nextClient;
      pendingClientRef.current = null;
      setConnection(savedConnection);
      setConfigStep("connected");
      const tokenSaved = saveMoodleToken(savedConnection.server, credential, savedConnection.userId);
      setHasSavedToken(tokenSaved);
      setAuthMode("token");
      setUsername("");
      setCourses(availableCourses);
      setServer(savedConnection.server);
      setToken("");
      setSelectedCourseId("");
      setSnapshot(null);
      const savedBindings = await getBindings(savedConnection.id);
      if (!isCurrent(version)) return;
      setBindings(savedBindings);
      await reloadMetadata(savedConnection.id, version);
      if (!isCurrent(version)) return;
      setNotice({ tone: "success", text: `Conectado a ${savedConnection.siteName} como ${savedConnection.userName}. ${tokenSaved ? "Token guardado en este navegador; no se guarda el usuario de acceso ni la contraseña." : "El navegador no permitió guardar el token; solo estará disponible en esta sesión."}` });
    } catch (error) {
      if (isCurrent(version)) {
        pendingClientRef.current?.dispose();
        pendingClientRef.current = null;
        setNotice({ tone: "error", text: errorMessage(error) });
      }
    } finally {
      if (isCurrent(version)) setBusy(null);
    }
  };

  const disconnect = (): void => {
    cancelPending();
    clientRef.current?.dispose();
    clientRef.current = null;
    pendingClientRef.current?.dispose();
    pendingClientRef.current = null;
    setConnection(null);
    setToken(readMoodleToken(server)?.token ?? "");
    setHasSavedToken(Boolean(readMoodleToken(server)));
    setUsername("");
    setCourses([]);
    setSelectedCourseId("");
    setSelectedGroupId("");
    setSnapshot(null);
    setBindings([]);
    clearPreviews();
    setConfigStep("server");
    setDataStep("scope");
    setNotice({ tone: "info", text: "Sesión desconectada. Las asociaciones y los datos académicos se conservan." });
  };

  const loadSnapshot = async (nextStep: "scope" | "changes" = "scope"): Promise<void> => {
    const client = clientRef.current;
    const course = courses.find((item) => item.id === Number(selectedCourseId));
    if (!client || !course || !connection) return;
    const { version } = beginRequest("snapshot");
    setNotice({ tone: "info", text: "Leyendo participantes, actividades, notas y entregas disponibles…" });
    setSnapshot(null);
    setMappingDrafts({});
    clearPreviews();
    try {
      const nextSnapshot = await client.getCourseSnapshot(course);
      if (!isCurrent(version)) return;
      setSnapshot(nextSnapshot);
      const savedBindings = await getBindings(connection.id);
      if (!isCurrent(version)) return;
      setBindings(savedBindings);
      const persistedScopes = savedBindings.filter((item) => item.kind === "course" && item.courseId === course.id);
      const uniqueScopes = [...new Map(persistedScopes.map((item) => [`${item.remoteGroupId ?? "all"}:${item.classId}:${item.subjectId}`, item])).values()];
      const currentScopeIsValid = Boolean(selectedClassId && selectedSubjectId &&
        classes.some((item) => item.id === selectedClassId) &&
        subjects.some((item) => item.id === selectedSubjectId) &&
        subjectCourseKeys.has(`${selectedClassId}:${selectedSubjectId}`) &&
        (!selectedGroupId || nextSnapshot.groups.some((item) => item.id === Number(selectedGroupId))));
      const restoredScope = !currentScopeIsValid && uniqueScopes.length === 1 ? uniqueScopes[0] : undefined;
      const restoredScopeIsValid = restoredScope &&
        classes.some((item) => item.id === restoredScope.classId) &&
        subjects.some((item) => item.id === restoredScope.subjectId) &&
        subjectCourseKeys.has(`${restoredScope.classId}:${restoredScope.subjectId}`) &&
        (restoredScope.remoteGroupId === undefined || nextSnapshot.groups.some((item) => item.id === restoredScope.remoteGroupId));
      const resolvedScope: MoodleScope | null = currentScopeIsValid
        ? { courseId: course.id, ...(selectedGroupId ? { remoteGroupId: Number(selectedGroupId) } : {}), classId: selectedClassId, subjectId: selectedSubjectId }
        : restoredScopeIsValid
          ? { courseId: course.id, ...(restoredScope.remoteGroupId === undefined ? {} : { remoteGroupId: restoredScope.remoteGroupId }), classId: restoredScope.classId, subjectId: restoredScope.subjectId }
          : null;
      if (currentScopeIsValid) {
        setDataStep(nextStep);
      } else if (restoredScopeIsValid) {
        setSelectedGroupId(restoredScope.remoteGroupId?.toString() ?? "");
        setSelectedClassId(restoredScope.classId);
        setSelectedSubjectId(restoredScope.subjectId);
        setDataStep(nextStep);
      } else {
        setSelectedGroupId("");
        setSelectedClassId("");
        setSelectedSubjectId("");
        setDataStep("scope");
      }
      let changesPreviewPrepared = false;
      if (nextStep === "changes" && resolvedScope && nextSnapshot.warnings.length === 0) {
        const preview = await previewUpdates(connection.id, nextSnapshot, resolvedScope);
        if (!isCurrent(version)) return;
        setUpdatePreview(preview);
        setUpdateResolutions(Object.fromEntries(preview.rows.map((row) => [row.id, "local"])));
        changesPreviewPrepared = true;
      }
      const successText = currentScopeIsValid
        ? "Curso actualizado. Se conserva el ámbito actual y las asociaciones guardadas; prepara de nuevo la revisión."
        : restoredScopeIsValid
          ? "Curso y ámbito anterior recuperados. Revisa las asociaciones antes de preparar cambios."
        : persistedScopes.length && uniqueScopes.length === 1
          ? "Curso cargado, pero su ámbito local guardado ya no está disponible. Selecciona otro ámbito."
          : uniqueScopes.length > 1
            ? "Curso cargado. Hay varios ámbitos guardados; selecciona el que quieres usar."
            : "Curso cargado. Revisa el ámbito antes de preparar asociaciones.";
      const quickReviewText = changesPreviewPrepared
        ? "Curso actualizado y cambios preparados. Revisa cada decisión antes de aplicarla o continúa sin importar cambios."
        : successText;
      setNotice({ tone: nextSnapshot.warnings.length ? "info" : "success", text: nextSnapshot.warnings.length ? `Curso cargado con ${nextSnapshot.warnings.length} aviso(s) de permisos o compatibilidad. No se ha preparado ninguna revisión aplicable.` : quickReviewText });
    } catch (error) {
      if (isCurrent(version)) {
        setSnapshot(null);
        clearPreviews();
        setDataStep("scope");
        setNotice({ tone: "error", text: `${errorMessage(error)} No se puede aplicar una revisión anterior; vuelve a cargar el curso.` });
      }
    } finally {
      if (isCurrent(version)) setBusy(null);
    }
  };

  const buildMappingChoices = (): MoodleMappingChoice[] => [
    ...scopedRemoteStudents.map((student) => {
      const existing = scopedBindings.find((item) => item.kind === "student" && item.remoteId === student.id);
      return { kind: "student" as const, remoteId: student.id, ...(mappingDrafts[mappingKey("student", student.id)] ?? (existing ? { action: "link" as const, localId: existing.localId } : { action: "ignore" as const })) };
    }),
    ...(snapshot?.activities ?? []).map((activity) => {
      const existing = scopedBindings.find((item) => item.kind === "activity" && item.remoteId === activity.id);
      return { kind: "activity" as const, remoteId: activity.id, ...(mappingDrafts[mappingKey("activity", activity.id)] ?? (existing ? { action: "link" as const, localId: existing.localId } : { action: "ignore" as const })) };
    })
  ];

  const prepareMappings = async (): Promise<void> => {
    if (!connection || !snapshot || !scope) return;
    const { version } = beginRequest("mapping-preview");
    try {
      const preview = await createMappingPreview(connection.id, snapshot, scope, buildMappingChoices());
      if (!isCurrent(version)) return;
      setMappingPreview(preview);
      setNotice({ tone: "info", text: "Vista previa preparada. Aún no se ha cambiado ningún dato local." });
    } catch (error) {
      if (isCurrent(version)) setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      if (isCurrent(version)) setBusy(null);
    }
  };

  const commitMappings = async (): Promise<void> => {
    if (!mappingPreview || !connection) return;
    const { controller, version } = beginRequest("mapping-apply");
    try {
      const nextBindings = await applyMappingPreview(mappingPreview, controller.signal);
      if (!isCurrent(version)) return;
      setBindings(nextBindings);
      await reloadLocalCandidates();
      if (!isCurrent(version)) return;
      clearPreviews();
      setDataStep("changes");
      await reloadMetadata(connection.id, version);
      if (!isCurrent(version)) return;
      setNotice({ tone: "success", text: "Asociaciones aplicadas. Los nombres y datos existentes de Edunoza no se han sobrescrito. Las otras revisiones se han descartado; prepara los cambios de nuevo." });
    } catch (error) {
      if (isCurrent(version)) setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      if (isCurrent(version)) setBusy(null);
    }
  };

  const prepareUpdates = async (): Promise<void> => {
    if (!connection || !snapshot || !scope) return;
    const { version } = beginRequest("updates-preview");
    try {
      const preview = await previewUpdates(connection.id, snapshot, scope);
      if (!isCurrent(version)) return;
      setUpdatePreview(preview);
      setUpdateResolutions(Object.fromEntries(preview.rows.map((row) => [row.id, "local"])));
      setNotice({ tone: "info", text: preview.rows.length ? "Elige el valor de cada cambio antes de aplicarlo." : "No hay cambios de identidad o título pendientes." });
    } catch (error) {
      if (isCurrent(version)) setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      if (isCurrent(version)) setBusy(null);
    }
  };

  const commitUpdates = async (): Promise<void> => {
    if (!updatePreview || !connection) return;
    const { controller, version } = beginRequest("updates-apply");
    try {
      await applyUpdates(updatePreview, updateResolutions, controller.signal);
      if (!isCurrent(version)) return;
      await reloadLocalCandidates();
      if (!isCurrent(version)) return;
      clearPreviews();
      setChangesReviewedFor(workflowContextKey(snapshot, scope));
      setDataStep("grades");
      await reloadMetadata(connection.id, version);
      if (!isCurrent(version)) return;
      setNotice({ tone: "success", text: "Actualizaciones aplicadas según tus decisiones. Prepara ahora una revisión nueva de calificaciones." });
    } catch (error) {
      if (isCurrent(version)) setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      if (isCurrent(version)) setBusy(null);
    }
  };

  const prepareGrades = async (): Promise<void> => {
    if (!connection || !snapshot || !scope) return;
    const { version } = beginRequest("grades-preview");
    try {
      const preview = await previewGrades(connection.id, snapshot, scope);
      if (!isCurrent(version)) return;
      setGradePreview(preview);
      setGradeResolutions(Object.fromEntries(preview.rows.map((row) => [row.id, "local"])));
      setNotice({ tone: "info", text: preview.rows.length ? "Revisa la conversión a la escala 0–10." : "No hay calificaciones compatibles para importar." });
    } catch (error) {
      if (isCurrent(version)) setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      if (isCurrent(version)) setBusy(null);
    }
  };

  const commitGrades = async (): Promise<void> => {
    if (!gradePreview || !connection) return;
    const { controller, version } = beginRequest("grades-apply");
    try {
      await applyGrades(gradePreview, gradeResolutions, controller.signal);
      if (!isCurrent(version)) return;
      clearPreviews();
      await reloadMetadata(connection.id, version);
      if (!isCurrent(version)) return;
      setNotice({ tone: "success", text: "Calificaciones seleccionadas importadas. Las demás evaluaciones siguen intactas." });
    } catch (error) {
      if (isCurrent(version)) setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      if (isCurrent(version)) setBusy(null);
    }
  };

  const createScope = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!selectedCourseId) return;
    const { controller, version } = beginRequest("scope-create");
    try {
      const createdScope = await createLocalScope({
        courseId: Number(selectedCourseId),
        ...(selectedGroupId ? { remoteGroupId: Number(selectedGroupId) } : {}),
        className: newClassName,
        level: newClassLevel,
        schoolYear: newSchoolYear,
        subjectName: newSubjectName
      }, controller.signal);
      if (!isCurrent(version)) return;
      const [localClasses, localSubjects, links] = await Promise.all([db.classGroups.orderBy("name").toArray(), db.subjects.orderBy("name").toArray(), db.subjectCourseLinks.toArray()]);
      if (!isCurrent(version)) return;
      setClasses(localClasses);
      setSubjects(localSubjects);
      setSubjectCourseKeys(new Set(links.map((link) => `${link.classId}:${link.subjectId}`)));
      setSelectedClassId(createdScope.classId);
      setSelectedSubjectId(createdScope.subjectId);
      setCreateScopeOpen(false);
      clearPreviews();
      setDataStep("mappings");
      setNotice({ tone: "success", text: "Grupo y materia creados. Revisa ahora cada asociación antes de aplicarla." });
    } catch (error) {
      if (isCurrent(version)) setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      if (isCurrent(version)) setBusy(null);
    }
  };

  const confirmForget = async (id: string): Promise<void> => {
    const { controller, version } = beginRequest("forget");
    try {
      await forgetConnection(id, controller.signal);
      if (!isCurrent(version)) return;
      const forgotten = connections.find((item) => item.id === id);
      if (forgotten && !removeMoodleToken(forgotten.server, forgotten.userId)) throw new Error("Se eliminaron las asociaciones, pero no se pudo borrar el token del navegador. Elimínalo desde los datos del sitio.");
      if (connection?.id === id) disconnect();
      setToken(readMoodleToken(server)?.token ?? "");
      setHasSavedToken(Boolean(readMoodleToken(server)));
      setForgetTarget(null);
      await reloadMetadata();
      setNotice({ tone: "success", text: "Metadatos de conexión y asociaciones eliminados. No se ha borrado ningún dato académico." });
    } catch (error) {
      if (isCurrent(version)) setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      if (isCurrent(version)) setBusy(null);
    }
  };

  const updateMappingDraft = (kind: "student" | "activity", remoteId: number, action: MoodleMappingChoice["action"], localId?: string): void => {
    clearPreviews();
    setMappingDrafts((current) => ({ ...current, [mappingKey(kind, remoteId)]: { action, ...(localId ? { localId } : {}) } }));
  };

  return (
    <article className="management-card moodle-settings-page">
      <header className="moodle-page-heading">
        <div>
          <h1>Moodle</h1>
          <p>Consulta Moodle en modo de solo lectura, asocia lo que ya existe y revisa cada cambio local.</p>
        </div>
        {connection ? <button type="button" className="btn secondary" onClick={disconnect}>Desconectar</button> : null}
      </header>

      <nav className="data-backup-navigation" aria-label="Apartados de Moodle">
        <Link id="moodle-config-link" to="?section=config" className={`section-tab ${activeSection === "config" ? "active" : ""}`} aria-current={activeSection === "config" ? "page" : undefined}>Configuración</Link>
        <Link id="moodle-data-link" to="?section=data" className={`section-tab ${activeSection === "data" ? "active" : ""}`} aria-current={activeSection === "data" ? "page" : undefined}>Conexión entre datos</Link>
      </nav>

      <p className={`moodle-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"} aria-live="polite">{notice.text}</p>

      <div className="moodle-subsection" hidden={activeSection !== "config"} role="region" aria-labelledby="moodle-config-link">
      <section className="detail-section moodle-section" aria-labelledby="moodle-connection-title">
        <div className="moodle-section-heading">
          <div><h2 id="moodle-connection-title">Conexión</h2><p>Conserva el token en este navegador, sin guardar las credenciales de acceso.</p></div>
          <span className={`moodle-status ${connection ? "connected" : "offline"}`}>{connection ? "Conectada · solo lectura" : "Sin sesión"}</span>
        </div>
        <MoodleWorkflowStepper steps={configSteps} activeStep={connection ? "connected" : configStep} onStepChange={setConfigStep} label="Pasos para conectar Moodle" />
        {connection ? (
          <>
            <dl className="moodle-connection-facts">
              <div><dt>Sitio</dt><dd>{connection.siteName}</dd></div>
              <div><dt>Cuenta</dt><dd>{connection.userName}</dd></div>
              <div><dt>Dirección</dt><dd>{connection.server}</dd></div>
            </dl>
            <p className="moodle-step-guidance">La cuenta está lista para consultar Moodle. Ningún dato académico se modifica en Moodle.</p>
          </>
        ) : (
          <form className="moodle-connect-form" onSubmit={connect}>
            {configStep === "server" ? <>
              <label className="compact-field"><span>Dirección HTTPS</span><input className="input" type="url" required disabled={busy === "connect"} value={server} onChange={(event) => { restorePreviousServer.current = false; setServer(event.target.value); setToken(readMoodleToken(event.target.value)?.token ?? ""); setHasSavedToken(Boolean(readMoodleToken(event.target.value))); }} autoComplete="url" /></label>
              <p className="moodle-step-guidance">Introduce la dirección HTTPS exacta de la instalación de tu centro, incluyendo su ruta si la tiene.</p>
              <div className="moodle-actions"><button type="button" className="btn" disabled={!hasValidServer} onClick={() => setConfigStep("access")}>Continuar al acceso</button></div>
            </> : null}
            {configStep === "access" ? <>
              <p className="moodle-selected-server"><strong>Servidor:</strong> {server}</p>
              <label className="compact-field"><span>Forma de acceso</span><select className="input" value={authMode} disabled={busy === "connect"} onChange={(event) => { setAuthMode(event.target.value); setPassword(""); setToken(event.target.value === "token" ? readMoodleToken(server)?.token ?? "" : ""); }}><option value="token">Token manual</option><option value="password">Usuario y contraseña</option></select></label>
              {authMode === "token" ? <label className="compact-field"><span>Token del servicio web</span><input className="input" type="password" required disabled={busy === "connect"} value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" spellCheck={false} /></label> : <>
              <label className="compact-field"><span>Usuario de Moodle</span><input className="input" required disabled={busy === "connect"} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} /></label>
              <label className="compact-field"><span>Contraseña de Moodle</span><input className="input" type="password" required disabled={busy === "connect"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="off" aria-describedby="moodle-password-help" /></label>
              <label className="compact-field"><span>Servicio web</span><input className="input" required disabled={busy === "connect"} value={service} onChange={(event) => setService(event.target.value)} autoComplete="off" spellCheck={false} aria-describedby="moodle-service-help" /></label>
              <p id="moodle-service-help">Nombre corto del servicio habilitado por el centro. El valor habitual para la aplicación móvil es moodle_mobile_app; puede no estar disponible o no ofrecer todas las consultas.</p>
              <p id="moodle-password-help">Proxy recibirá el usuario y la contraseña y los enviará al Moodle indicado para obtener el token. Edunoza no guarda la contraseña y la borra del campo al enviarla. Moodle puede crear un token y registrar el acceso; los datos académicos siguen siendo de solo lectura. Si tu centro exige acceso institucional o doble factor, utiliza un token manual.</p>
            </>}
            <div className="moodle-actions"><button className="btn" type="submit" disabled={busy === "connect" || (authMode === "token" ? !token.trim() : !username.trim() || !password || !service.trim())}>{busy === "connect" ? "Conectando…" : authMode === "password" ? "Obtener token y conectar" : "Conectar"}</button>{busy === "connect" ? <button type="button" className="btn secondary" onClick={() => cancelPending(true)}>Cancelar</button> : null}</div>
            </> : null}
          </form>
        )}
        <p>El token se guarda en este navegador al conectar, fuera de las copias de seguridad. No guardamos el usuario de acceso ni la contraseña. Desconectar conserva el token; cualquier persona con acceso a este perfil del navegador podría utilizarlo.</p>
        {hasSavedToken ? <button type="button" className="btn secondary" disabled={Boolean(busy)} onClick={() => {
          if (!removeMoodleToken(server)) { setNotice({ tone: "error", text: "No se pudo borrar el token. Elimínalo desde los datos del sitio en el navegador." }); return; }
          disconnect(); setToken(""); setHasSavedToken(false);
          setNotice({ tone: "success", text: "Token eliminado de este navegador y sesión desconectada. Los datos académicos se conservan. El token no se ha revocado en Moodle." });
        }}>Borrar token guardado</button> : null}
        <p>Requiere Proxy. <Link to="/config/proxy">Comprobar e instalar la extensión</Link>. Salir de esta pantalla desconecta la sesión de Moodle.</p>
        <details className="moodle-help">
          <summary>Permisos y ayuda para administradores</summary>
          <div>
            <p>El administrador debe habilitar los servicios web REST y autorizar tu cuenta. Puedes introducir un token o solicitarlo con usuario y contraseña si el centro lo permite. Se recomienda un servicio limitado a funciones de lectura; Edunoza no modifica datos académicos en Moodle.</p>
          </div>
        </details>
      </section>

      {connections.length ? (
        <section className="detail-section moodle-section" aria-labelledby="moodle-saved-title">
          <div className="moodle-section-heading"><div><h2 id="moodle-saved-title">Conexiones conocidas</h2><p>Reconecta con el token guardado o introduce otro si ha caducado.</p></div></div>
          <ul className="moodle-saved-list">
            {connections.map((item) => <li key={item.id}><div><strong>{item.siteName}</strong><span>{item.userName} · {item.server}</span></div><div className="moodle-row-actions"><button type="button" className="btn secondary" disabled={Boolean(connection) || Boolean(busy)} onClick={() => {
              restorePreviousServer.current = false;
              setServer(item.server); setPassword(""); setUsername("");
              const saved = readMoodleToken(item.server, item.userId);
              setToken(saved?.token ?? ""); setHasSavedToken(Boolean(saved)); setAuthMode("token");
              setConfigStep("access");
              setNotice({ tone: "info", text: saved ? `Token recuperado para ${item.userName}. Pulsa Conectar.` : `Introduce un token de ${item.userName} o utiliza usuario y contraseña. Las asociaciones se recuperarán para esa misma cuenta.` });
            }}>Reconectar</button><button type="button" className="moodle-danger-button" onClick={() => setForgetTarget(item.id)}>Olvidar</button></div>{forgetTarget === item.id ? <div className="moodle-confirm" role="alert"><p>Se eliminarán los metadatos, las asociaciones y el token guardado de esta cuenta. Los datos académicos locales no se borrarán.</p><button type="button" className="btn secondary" onClick={() => setForgetTarget(null)}>Conservar</button><button type="button" className="moodle-danger-button solid" disabled={busy === "forget"} onClick={() => void confirmForget(item.id)}>Sí, olvidar</button></div> : null}</li>)}
          </ul>
        </section>
      ) : null}

      {connection ? <Link className="btn secondary" to="?section=data">Ir a conexión entre datos</Link> : null}
      </div>

      <div className="moodle-subsection" hidden={activeSection !== "data"} role="region" aria-labelledby="moodle-data-link">
      {!connection ? <section className="detail-section moodle-section">
        <h2>Conecta tu cuenta de Moodle</h2>
        <p>Abre Configuración y conecta con tu token para elegir cursos y asociar sus datos con Edunoza. Las asociaciones guardadas se conservan.</p>
        <Link className="btn secondary" to="?section=config">Ir a configuración de Moodle</Link>
      </section> : null}
      {connection ? (
        <>
          <MoodleWorkflowStepper steps={dataSteps} activeStep={dataStep} onStepChange={setDataStep} label="Pasos para revisar datos de Moodle" />
          {snapshot && scope ? <p className="moodle-workflow-context"><strong>Ámbito actual:</strong> {snapshot.course.fullName} → {classes.find((item) => item.id === scope.classId)?.name ?? "Grupo local"} · {subjects.find((item) => item.id === scope.subjectId)?.name ?? "Materia local"}</p> : null}
          <section className="detail-section moodle-section" aria-labelledby="moodle-scope-title" hidden={dataStep !== "scope"}>
            <div className="moodle-section-heading"><div><h2 id="moodle-scope-title">Curso y ámbito local</h2><p>Un grupo de Moodle es opcional. Cambiar el ámbito descarta las vistas previas pendientes.</p></div></div>
            <div className="moodle-field-stack">
              <label className="compact-field"><span>Curso Moodle</span><select value={selectedCourseId} onChange={(event) => changeScope(() => { setSelectedCourseId(event.target.value); setSelectedGroupId(""); setSnapshot(null); })}><option value="">Seleccionar curso</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.fullName} · {course.shortName}</option>)}</select></label>
              {!courses.length ? <p className="moodle-empty">Esta cuenta no devolvió ningún curso accesible.</p> : null}
              <div className="moodle-actions"><button type="button" className="btn secondary" disabled={!selectedCourseId || Boolean(busy)} onClick={() => void loadSnapshot()}>{busy === "snapshot" ? "Cargando…" : snapshot ? "Actualizar curso" : "Cargar curso"}</button></div>
              {snapshot ? <>
                <label className="compact-field"><span>Grupo Moodle</span><select value={selectedGroupId} onChange={(event) => changeScope(() => setSelectedGroupId(event.target.value))}><option value="">Todo el curso</option>{snapshot.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
                <label className="compact-field"><span>Grupo de Edunoza</span><select value={selectedClassId} onChange={(event) => changeScope(() => { setSelectedClassId(event.target.value); setSelectedSubjectId(""); })}><option value="">Seleccionar grupo existente</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.schoolYear}</option>)}</select></label>
                <label className="compact-field"><span>Materia de Edunoza</span><select value={selectedSubjectId} disabled={!selectedClassId} onChange={(event) => changeScope(() => setSelectedSubjectId(event.target.value))}><option value="">Seleccionar materia existente</option>{availableSubjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <button type="button" className="moodle-text-button" aria-expanded={createScopeOpen} onClick={() => setCreateScopeOpen((value) => !value)}>Crear un grupo y una materia para este curso</button>
                {createScopeOpen ? <form className="moodle-create-scope" onSubmit={createScope}><label className="compact-field"><span>Nombre del grupo</span><input className="input" required value={newClassName} onChange={(event) => setNewClassName(event.target.value)} /></label><label className="compact-field"><span>Nivel</span><input className="input" required value={newClassLevel} onChange={(event) => setNewClassLevel(event.target.value)} /></label><label className="compact-field"><span>Curso escolar</span><input className="input" required pattern="[0-9]{4}-[0-9]{4}" placeholder="2026-2027" value={newSchoolYear} onChange={(event) => setNewSchoolYear(event.target.value)} /></label><label className="compact-field"><span>Materia</span><input className="input" required value={newSubjectName} onChange={(event) => setNewSubjectName(event.target.value)} /></label><div className="moodle-actions"><button className="btn" disabled={busy === "scope-create"}>Crear y seleccionar</button><button type="button" className="btn secondary" onClick={() => setCreateScopeOpen(false)}>Cancelar</button></div></form> : null}
              </> : null}
            </div>
            {snapshot?.warnings.length ? <details className="moodle-warnings" open><summary>{snapshot.warnings.length} aviso(s) del servidor</summary><ul>{snapshot.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
            <details className="moodle-capabilities"><summary>Capacidades de lectura de esta cuenta</summary><ul>{["core_enrol_get_enrolled_users", "core_group_get_course_groups", "core_course_get_contents", "mod_assign_get_assignments", "mod_assign_get_grades", "mod_assign_get_submissions"].map((name) => <li key={name}><span>{capabilityLabel(name)}</span><strong>{connection.functions.includes(name) ? "Disponible" : "No disponible"}</strong></li>)}</ul></details>
            {snapshot && scope ? <div className="moodle-actions moodle-step-actions"><button type="button" className="btn" disabled={Boolean(busy)} onClick={() => setDataStep("mappings")}>Continuar a asociaciones</button>{hasScopedLinks ? <button type="button" className="btn secondary" disabled={Boolean(busy)} onClick={() => setDataStep("changes")}>Continuar con asociaciones guardadas</button> : null}{hasScopedLinks ? <button type="button" className="moodle-text-button" disabled={Boolean(busy)} onClick={() => void loadSnapshot("changes")}>Buscar cambios</button> : null}</div> : null}
          </section>

          {snapshot && scope ? (
            <>
              <section className="detail-section moodle-section" aria-labelledby="moodle-mapping-title" hidden={dataStep !== "mappings"}>
                <div className="moodle-section-heading"><div><h2 id="moodle-mapping-title">Asociaciones</h2><p>Los nombres son solo sugerencias visuales: ninguna coincidencia se aplica automáticamente.</p></div></div>
                <details className="moodle-mapping-group" open><summary>Participantes · {scopedRemoteStudents.length}</summary>{scopedRemoteStudents.length ? <div className="moodle-mapping-list">{scopedRemoteStudents.map((student) => <MappingRow key={student.id} kind="student" remoteId={student.id} label={student.fullName} candidates={localStudents.map((item) => ({ id: item.id, label: item.fullName }))} binding={scopedBindings.find((item) => item.kind === "student" && item.remoteId === student.id)} draft={mappingDrafts[mappingKey("student", student.id)]} onChange={updateMappingDraft} />)}</div> : <p className="moodle-empty">No hay participantes en este ámbito.</p>}</details>
                <details className="moodle-mapping-group"><summary>Actividades · {snapshot.activities.length}</summary>{snapshot.activities.length ? <div className="moodle-mapping-list">{snapshot.activities.map((activity) => <MappingRow key={activity.id} kind="activity" remoteId={activity.id} label={activity.title} candidates={localTasks.map((item) => ({ id: item.id, label: item.title }))} binding={scopedBindings.find((item) => item.kind === "activity" && item.remoteId === activity.id)} draft={mappingDrafts[mappingKey("activity", activity.id)]} onChange={updateMappingDraft} />)}</div> : <p className="moodle-empty">No hay actividades compatibles.</p>}</details>
                <div className="moodle-actions"><button type="button" className="btn secondary" disabled={Boolean(busy)} onClick={() => void prepareMappings()}>Preparar vista previa</button>{mappingPreview ? <button type="button" className="btn" disabled={Boolean(busy) || mappingPreview.rows.some((row) => row.status === "invalid")} onClick={() => void commitMappings()}>Aplicar {mappingPreview.rows.length} decisión(es) y continuar</button> : null}{hasScopedLinks && !mappingPreview ? <button type="button" className="btn secondary" disabled={Boolean(busy)} onClick={() => setDataStep("changes")}>Continuar a cambios</button> : null}</div>
                {mappingPreview ? <div className="moodle-preview" role="region" aria-label="Vista previa de asociaciones"><p><strong>Aún sin aplicar.</strong> Revisa estas decisiones:</p><ul>{mappingPreview.rows.map((row) => <li key={`${row.kind}:${row.remoteId}`}><span>{row.remoteLabel}</span><span>{row.localLabel ?? mappingActionLabel(row.choice.action)}</span><strong className={row.status === "invalid" ? "invalid" : "ready"}>{row.message ?? (row.status === "ready" ? "Preparada" : "Revisar")}</strong></li>)}</ul></div> : null}
              </section>

              <section className="detail-section moodle-section" aria-labelledby="moodle-updates-title" hidden={dataStep !== "changes"}>
                <div className="moodle-section-heading"><div><h2 id="moodle-updates-title">Cambios de nombres y títulos</h2><p>Las asociaciones no modifican campos. Aquí decides por separado qué versión conservar.</p></div><button type="button" className="btn secondary" disabled={Boolean(busy)} onClick={() => void prepareUpdates()}>Revisar cambios</button></div>
                {updatePreview ? updatePreview.rows.length ? <div className="moodle-resolution-list">{updatePreview.rows.map((row) => <fieldset key={row.id}><legend>{row.kind === "student" ? "Participante" : "Actividad"} · {fieldLabel(row.field)}{row.conflict ? " · Conflicto" : ""}</legend><label><input type="radio" name={`update-${row.id}`} checked={updateResolutions[row.id] === "local"} onChange={() => setUpdateResolutions((current) => ({ ...current, [row.id]: "local" }))} /><span><strong>Conservar Edunoza</strong><small>{String(row.localValue ?? "Vacío")}</small></span></label><label><input type="radio" name={`update-${row.id}`} checked={updateResolutions[row.id] === "remote"} onChange={() => setUpdateResolutions((current) => ({ ...current, [row.id]: "remote" }))} /><span><strong>Usar Moodle</strong><small>{String(row.sourceValue ?? "Vacío")}</small></span></label></fieldset>)}</div> : <p className="moodle-empty">No hay cambios pendientes en los campos compatibles.</p> : null}
                <div className="moodle-actions">{updatePreview?.rows.length ? <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => void commitUpdates()}>Aplicar decisiones y continuar</button> : null}<button type="button" className="btn secondary" disabled={Boolean(busy)} onClick={() => { clearPreviews(); setChangesReviewedFor(workflowContextKey(snapshot, scope)); setDataStep("grades"); setNotice({ tone: "info", text: "No se han aplicado cambios de nombres o títulos. Revisa ahora las calificaciones." }); }}>Continuar a calificaciones</button></div>
              </section>

              <section className="detail-section moodle-section" aria-labelledby="moodle-grades-title" hidden={dataStep !== "grades"}>
                <div className="moodle-section-heading"><div><h2 id="moodle-grades-title">Calificaciones y entregas</h2><p>Las notas leídas se convierten explícitamente a 0–10. Edunoza no modifica Moodle.</p></div><button type="button" className="btn secondary" disabled={Boolean(busy)} onClick={() => void prepareGrades()}>Revisar notas entrantes</button></div>
                {gradePreview ? gradePreview.rows.length ? <div className="moodle-grade-list">{gradePreview.rows.map((row) => <fieldset key={row.id}><legend>{tasks.find((item) => item.id === row.taskId)?.title ?? "Actividad"} · {students.find((item) => item.id === row.studentId)?.fullName ?? "Participante"}</legend><p>Moodle: {row.remoteGrade ?? "sin nota"} / {row.gradeMax} → {row.scaledGrade ?? "no compatible"} / 10 · Edunoza: {row.localGrade ?? "sin nota"}</p><label><input type="radio" name={`grade-${row.id}`} checked={gradeResolutions[row.id] === "local"} onChange={() => setGradeResolutions((current) => ({ ...current, [row.id]: "local" }))} /> Conservar Edunoza</label><label><input type="radio" name={`grade-${row.id}`} checked={gradeResolutions[row.id] === "remote"} onChange={() => setGradeResolutions((current) => ({ ...current, [row.id]: "remote" }))} /> Importar Moodle</label></fieldset>)}</div> : <p className="moodle-empty">No hay notas vinculadas y compatibles para importar.</p> : null}
                {gradePreview?.rows.length ? <div className="moodle-actions"><button type="button" className="btn" disabled={Boolean(busy)} onClick={() => void commitGrades()}>Importar selección</button></div> : null}

                <SubmissionSummary snapshot={snapshot} />
              </section>
            </>
          ) : null}
        </>
      ) : null}

      <section className="detail-section moodle-section" aria-labelledby="moodle-operations-title">
        <div className="moodle-section-heading"><div><h2 id="moodle-operations-title">Operaciones recientes</h2><p>El historial no contiene tokens ni contenido privado no necesario.</p></div></div>
        {operations.length ? <ol className="moodle-operation-list">{operations.map((operation) => <li key={operation.id}><div><strong>{operation.summary}</strong><span>{operation.count} elemento(s) · {operationKindLabel(operation.kind)}</span></div><time dateTime={operation.createdAt}>{formatDate(operation.createdAt)}</time></li>)}</ol> : <p className="moodle-empty">Todavía no hay operaciones Moodle registradas.</p>}
      </section>
      </div>
    </article>
  );
}

function MappingRow({ kind, remoteId, label, candidates, binding, draft, onChange }: { kind: "student" | "activity"; remoteId: number; label: string; candidates: Array<{ id: string; label: string }>; binding?: MoodleBinding; draft?: MappingDraft; onChange: (kind: "student" | "activity", remoteId: number, action: MoodleMappingChoice["action"], localId?: string) => void }) {
  const action = draft?.action ?? (binding ? "link" : "ignore");
  const localId = draft?.localId ?? binding?.localId ?? "";
  const linkedLabel = candidates.find((candidate) => candidate.id === binding?.localId)?.label;
  return <div className="moodle-mapping-row"><div><strong>{label}</strong><span>{binding ? `Vinculado a ${linkedLabel ?? "un registro local no disponible"}` : "Sin asociación"}</span></div><label><span className="sr-only">Decisión para {label}</span><select value={action} onChange={(event) => { const nextAction = event.target.value as MoodleMappingChoice["action"]; onChange(kind, remoteId, nextAction, nextAction === "link" ? localId : undefined); }}><option value="ignore">Ignorar</option><option value="link">{binding ? "Mantener o cambiar vínculo" : "Vincular existente"}</option><option value="create">Crear nuevo en Edunoza</option>{binding ? <option value="unlink">Quitar asociación</option> : null}</select></label>{action === "link" ? <label><span className="sr-only">Registro local para {label}</span><select required value={localId} onChange={(event) => onChange(kind, remoteId, "link", event.target.value)}><option value="">Seleccionar registro local</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select></label> : <span className="moodle-mapping-note">{action === "create" ? "Se creará al aplicar la vista previa" : action === "unlink" ? "El registro local se conserva" : "No se importará"}</span>}</div>;
}

function SubmissionSummary({ snapshot }: { snapshot: MoodleCourseSnapshot }) {
  if (!snapshot.activities.length) return <p className="moodle-empty">Moodle no devolvió actividades compatibles.</p>;
  return (
    <div className="moodle-submission-list">
      <h3>Entregas leídas</h3>
      {snapshot.activities.map((activity) => {
        const submissions = snapshot.submissions.filter((item) => item.activityId === activity.id);
        return (
          <details key={activity.id}>
            <summary><span><strong>{activity.title}</strong><small>{formatDate(activity.dueDate)} · {submissions.length} estado(s)</small></span></summary>
            <p><a href={activity.url} target="_blank" rel="noopener noreferrer">Abrir actividad en Moodle (nueva pestaña)</a></p>
            {submissions.length ? <ul>{submissions.map((submission) => <li key={`${submission.activityId}:${submission.userId}`}><span>{snapshot.students.find((student) => student.id === submission.userId)?.fullName ?? `Usuario ${submission.userId}`}</span><strong>{submissionStatusLabel(submission.status)}</strong><time dateTime={new Date(submission.modifiedAt * 1000).toISOString()}>{formatDate(submission.modifiedAt)}</time></li>)}</ul> : <p>No hay estados de entrega disponibles.</p>}
          </details>
        );
      })}
    </div>
  );
}
