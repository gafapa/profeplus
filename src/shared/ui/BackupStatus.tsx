import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { db } from "../db/database";
import {
  BACKUP_STATUS_CHANGED_EVENT,
  backupFreshness,
  backupStatusLabel,
  readLastBackupAt,
  type BackupFreshness
} from "../backup/status";

function useBackupState(): { lastBackupAt: string | null; freshness: BackupFreshness } {
  const [lastBackupAt, setLastBackupAt] = useState(() => readLastBackupAt());

  useEffect(() => {
    const refresh = (): void => setLastBackupAt(readLastBackupAt());
    window.addEventListener(BACKUP_STATUS_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(BACKUP_STATUS_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return { lastBackupAt, freshness: backupFreshness(lastBackupAt) };
}

export function BackupStatusLink() {
  const { lastBackupAt, freshness } = useBackupState();
  return (
    <NavLink
      to="/config/database"
      className={`backup-status-link ${freshness}`}
      title="Abrir copias y recuperación"
    >
      <span className="backup-status-dot" aria-hidden="true" />
      <span>{backupStatusLabel(lastBackupAt)}</span>
    </NavLink>
  );
}

export function BackupReminder() {
  const { freshness } = useBackupState();
  const [hasLocalData, setHasLocalData] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem("profeplus_backup_reminder_dismissed") === "1";
    } catch {
      return false;
    }
  });

  const refreshDataState = useCallback((): void => {
    void Promise.all([
      db.classGroups.count(),
      db.students.count(),
      db.attendanceEntries.count(),
      db.assessments.count()
    ])
      .then((counts) => setHasLocalData(counts.some((count) => count > 0)))
      .catch(() => setHasLocalData(false));
  }, []);

  useEffect(() => {
    refreshDataState();
    window.addEventListener("focus", refreshDataState);
    return () => window.removeEventListener("focus", refreshDataState);
  }, [refreshDataState]);

  if (!hasLocalData || dismissed || freshness === "current") return null;

  return (
    <aside className={`backup-reminder ${freshness}`} aria-label="Recordatorio de copia de seguridad">
      <div>
        <strong>{freshness === "missing" ? "Protege tu trabajo" : "Actualiza tu copia de seguridad"}</strong>
        <span>
          {freshness === "missing"
            ? "Los datos están solo en este navegador hasta que descargues una copia cifrada."
            : "Tu última copia ya no refleja los cambios recientes."}
        </span>
      </div>
      <NavLink className="btn primary" to="/config/database">Crear copia</NavLink>
      <button
        type="button"
        className="backup-reminder-dismiss"
        aria-label="Ocultar este recordatorio durante la sesión"
        onClick={() => {
          try {
            window.sessionStorage.setItem("profeplus_backup_reminder_dismissed", "1");
          } catch {
            // The in-memory dismissal still works when session storage is blocked.
          }
          setDismissed(true);
        }}
      >
        Ahora no
      </button>
    </aside>
  );
}

export function BackupTrustPanel() {
  const { lastBackupAt, freshness } = useBackupState();
  return (
    <section className="backup-trust-panel" aria-labelledby="backup-trust-title">
      <div className="backup-trust-heading">
        <div>
          <h1 id="backup-trust-title">Tus datos viven en este navegador</h1>
          <p>ProfePlus no guarda tu información académica en un servidor. La recuperación depende de tu copia cifrada.</p>
        </div>
        <span className={`backup-trust-state ${freshness}`}>{backupStatusLabel(lastBackupAt)}</span>
      </div>
      <ol className="backup-recovery-steps">
        <li><strong>Descarga</strong><span>Crea una copia cifrada después de cambios importantes.</span></li>
        <li><strong>Separa</strong><span>Guarda el archivo y la contraseña en lugares distintos.</span></li>
        <li><strong>Comprueba</strong><span>Valida el archivo aquí sin sustituir tus datos.</span></li>
      </ol>
    </section>
  );
}
