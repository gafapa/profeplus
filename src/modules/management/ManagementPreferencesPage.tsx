import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  setStudentNameFormat,
  setStudentSortBy,
  setNotSubmittedGradePolicy,
  setWeekStartsOn,
  type NotSubmittedGradePolicy,
  type StudentNameFormat,
  type StudentSortBy,
  type WeekStartsOn
} from "../../app/store";
import {
  APP_LOCK_NOW_EVENT,
  createAppLockConfig,
  persistAppLockConfig,
  readAppLockConfig
} from "../../shared/security/appLock";
import { db } from "../../shared/db/database";
import type { FeedbackComment, FeedbackCommentCategory } from "../../shared/db/types";
import {
  FEEDBACK_COMMENT_CATEGORIES,
  feedbackCategoryLabel,
  normalizeFeedbackComment
} from "../../shared/feedback/comments";

export function ManagementPreferencesPage() {
  const dispatch = useAppDispatch();
  const studentSortBy = useAppSelector((state) => state.app.studentSortBy);
  const studentNameFormat = useAppSelector((state) => state.app.studentNameFormat);
  const weekStartsOn = useAppSelector((state) => state.app.weekStartsOn);
  const notSubmittedGradePolicy = useAppSelector((state) => state.app.notSubmittedGradePolicy);
  const [appLockEnabled, setAppLockEnabled] = useState(() => Boolean(readAppLockConfig()));
  const [appLockPassphrase, setAppLockPassphrase] = useState("");
  const [appLockConfirmation, setAppLockConfirmation] = useState("");
  const [autoLockMinutes, setAutoLockMinutes] = useState(
    () => readAppLockConfig()?.autoLockMinutes ?? 15
  );
  const [securityNotice, setSecurityNotice] = useState("");
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [feedbackComments, setFeedbackComments] = useState<FeedbackComment[]>([]);
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCommentCategory>("general");
  const [feedbackText, setFeedbackText] = useState("");
  const [editingFeedbackId, setEditingFeedbackId] = useState("");
  const [feedbackNotice, setFeedbackNotice] = useState("");

  const loadFeedbackComments = async (): Promise<void> => {
    const rows = await db.feedbackComments.toArray();
    setFeedbackComments(rows.sort((left, right) => left.category.localeCompare(right.category) || left.text.localeCompare(right.text)));
  };

  useEffect(() => {
    void loadFeedbackComments().catch(() => setFeedbackNotice("No se pudo cargar el banco de comentarios."));
  }, []);

  const resetFeedbackForm = (): void => {
    setEditingFeedbackId("");
    setFeedbackCategory("general");
    setFeedbackText("");
  };

  const saveFeedbackComment = async (): Promise<void> => {
    try {
      const text = normalizeFeedbackComment(feedbackText);
      const duplicate = feedbackComments.some(
        (comment) => comment.id !== editingFeedbackId && comment.category === feedbackCategory && comment.text.toLocaleLowerCase("es") === text.toLocaleLowerCase("es")
      );
      if (duplicate) throw new Error("Ya existe ese comentario en la categoría seleccionada.");
      const now = new Date().toISOString();
      const current = feedbackComments.find((comment) => comment.id === editingFeedbackId);
      await db.feedbackComments.put({
        id: current?.id ?? crypto.randomUUID(),
        category: feedbackCategory,
        text,
        createdAt: current?.createdAt ?? now,
        updatedAt: now
      });
      resetFeedbackForm();
      await loadFeedbackComments();
      setFeedbackNotice(current ? "Comentario actualizado." : "Comentario añadido al banco.");
    } catch (error) {
      setFeedbackNotice(error instanceof Error ? error.message : "No se pudo guardar el comentario.");
    }
  };

  const deleteFeedbackComment = async (comment: FeedbackComment): Promise<void> => {
    await db.feedbackComments.delete(comment.id);
    if (editingFeedbackId === comment.id) resetFeedbackForm();
    await loadFeedbackComments();
    setFeedbackNotice("Comentario eliminado.");
  };

  const enableAppLock = async (): Promise<void> => {
    if (appLockPassphrase !== appLockConfirmation) {
      setSecurityNotice("Las claves no coinciden.");
      return;
    }
    setIsSavingSecurity(true);
    try {
      const config = await createAppLockConfig(appLockPassphrase, autoLockMinutes);
      persistAppLockConfig(config);
      setAppLockEnabled(true);
      setAppLockPassphrase("");
      setAppLockConfirmation("");
      setSecurityNotice("Bloqueo local activado.");
    } catch (error) {
      setSecurityNotice(error instanceof Error ? error.message : "No se pudo activar el bloqueo.");
    } finally {
      setIsSavingSecurity(false);
    }
  };

  return (
    <article className="management-card">
      <h1 className="sr-only">Preferencias</h1>
      <p className="hint">
        Estas preferencias se guardan en la copia de seguridad.
      </p>

      <section className="detail-section">
        <h2>Ordenar listados de alumnos por</h2>
        <div className="inline-form">
          {(
            [
              { value: "lastName", label: "Apellidos" },
              { value: "firstName", label: "Nombre" }
            ] as { value: StudentSortBy; label: string }[]
          ).map(({ value, label }) => (
            <label key={value} className="pref-radio-label">
              <input
                type="radio"
                name="studentSortBy"
                value={value}
                checked={studentSortBy === value}
                onChange={() => dispatch(setStudentSortBy(value))}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h2>Mostrar nombre del alumno como</h2>
        <div className="inline-form">
          {(
            [
              { value: "firstLast", label: "Nombre Apellidos  (Ana García)" },
              { value: "lastFirst", label: "Apellidos, Nombre  (García, Ana)" }
            ] as { value: StudentNameFormat; label: string }[]
          ).map(({ value, label }) => (
            <label key={value} className="pref-radio-label">
              <input
                type="radio"
                name="studentNameFormat"
                value={value}
                checked={studentNameFormat === value}
                onChange={() => dispatch(setStudentNameFormat(value))}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h2>Empezar la semana en</h2>
        <div className="inline-form">
          {(
            [
              { value: "monday", label: "Lunes" },
              { value: "sunday", label: "Domingo" }
            ] as { value: WeekStartsOn; label: string }[]
          ).map(({ value, label }) => (
            <label key={value} className="pref-radio-label">
              <input
                type="radio"
                name="weekStartsOn"
                value={value}
                checked={weekStartsOn === value}
                onChange={() => dispatch(setWeekStartsOn(value))}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h2>Alumnado no presentado</h2>
        <p className="hint">
          Esta política solo se aplica a calificaciones marcadas expresamente como no presentado.
        </p>
        <div className="inline-form">
          {(
            [
              { value: "exclude", label: "Excluir de la media" },
              { value: "zero", label: "Contar como cero" }
            ] as { value: NotSubmittedGradePolicy; label: string }[]
          ).map(({ value, label }) => (
            <label key={value} className="pref-radio-label">
              <input
                type="radio"
                name="notSubmittedGradePolicy"
                value={value}
                checked={notSubmittedGradePolicy === value}
                onChange={() => dispatch(setNotSubmittedGradePolicy(value))}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="detail-section" aria-labelledby="feedback-bank-title">
        <h2 id="feedback-bank-title">Banco de comentarios</h2>
        <p className="hint">
          Guarda frases reutilizables. Siempre se insertan como borrador para que puedas revisarlas antes de guardar la clase o la nota.
        </p>
        <div className="feedback-bank-form">
          <label className="detail-field">
            <span>Categoría</span>
            <select className="input" value={feedbackCategory} onChange={(event) => setFeedbackCategory(event.target.value as FeedbackCommentCategory)}>
              {FEEDBACK_COMMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>{feedbackCategoryLabel(category)}</option>
              ))}
            </select>
          </label>
          <label className="detail-field feedback-bank-text">
            <span>Comentario</span>
            <textarea
              className="input"
              rows={2}
              maxLength={500}
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              placeholder="Ej. Participa de forma activa y argumenta sus respuestas."
            />
          </label>
          <div className="feedback-bank-actions">
            <button type="button" className="btn primary" onClick={() => void saveFeedbackComment()}>
              {editingFeedbackId ? "Actualizar comentario" : "Añadir comentario"}
            </button>
            {editingFeedbackId ? <button type="button" className="btn secondary" onClick={resetFeedbackForm}>Cancelar</button> : null}
          </div>
        </div>
        <p className="feedback-bank-notice" role="status" aria-live="polite">{feedbackNotice}</p>
        {feedbackComments.length > 0 ? (
          <ul className="feedback-bank-list">
            {feedbackComments.map((comment) => (
              <li key={comment.id}>
                <div>
                  <span>{feedbackCategoryLabel(comment.category)}</span>
                  <strong>{comment.text}</strong>
                </div>
                <div className="feedback-bank-row-actions">
                  <button type="button" className="btn secondary" onClick={() => {
                    setEditingFeedbackId(comment.id);
                    setFeedbackCategory(comment.category);
                    setFeedbackText(comment.text);
                    setFeedbackNotice("");
                  }}>Editar</button>
                  <button type="button" className="btn secondary management-danger-btn" onClick={() => void deleteFeedbackComment(comment)}>Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="empty-state">Todavía no hay comentarios guardados.</p>}
      </section>

      <section className="detail-section" aria-labelledby="device-security-title">
        <h2 id="device-security-title">Bloqueo del dispositivo</h2>
        <p className="hint">
          Protege la pantalla ante accesos casuales y se activa por inactividad. Los datos del navegador
          siguen dependiendo del cifrado y control de acceso del sistema operativo; las copias exportadas
          sí se cifran de extremo a extremo.
        </p>
        {appLockEnabled ? (
          <div className="inline-form">
            <span className="pill">Activado · {autoLockMinutes} min</span>
            <button
              className="btn secondary"
              type="button"
              onClick={() => window.dispatchEvent(new Event(APP_LOCK_NOW_EVENT))}
            >
              Bloquear ahora
            </button>
            <button
              className="btn danger"
              type="button"
              onClick={() => {
                persistAppLockConfig(null);
                setAppLockEnabled(false);
                setSecurityNotice("Bloqueo local desactivado.");
              }}
            >
              Desactivar
            </button>
          </div>
        ) : (
          <div className="detail-grid">
            <label className="detail-field">
              <span>Clave local (mínimo 8 caracteres)</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={appLockPassphrase}
                onChange={(event) => setAppLockPassphrase(event.target.value)}
              />
            </label>
            <label className="detail-field">
              <span>Repetir clave</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={appLockConfirmation}
                onChange={(event) => setAppLockConfirmation(event.target.value)}
              />
            </label>
            <label className="detail-field">
              <span>Bloquear tras</span>
              <select
                className="input"
                value={autoLockMinutes}
                onChange={(event) => setAutoLockMinutes(Number(event.target.value))}
              >
                <option value={5}>5 minutos</option>
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={60}>60 minutos</option>
              </select>
            </label>
            <button
              className="btn primary"
              type="button"
              disabled={isSavingSecurity || !appLockPassphrase || !appLockConfirmation}
              onClick={() => void enableAppLock()}
            >
              {isSavingSecurity ? "Protegiendo…" : "Activar bloqueo"}
            </button>
          </div>
        )}
        {securityNotice ? <p className="hint" role="status">{securityNotice}</p> : null}
      </section>
    </article>
  );
}
