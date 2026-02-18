import { useRef, useState } from "react";
import { db } from "../../shared/db/database";
import { Modal } from "../../shared/ui/Modal";
import { useManagement } from "./ManagementContext";

type DatabaseExportPayload = {
  app: string;
  exportedAt: string;
  tables: Record<string, unknown[]>;
};

function buildBackupFileName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `profeplus-backup-${stamp}.json`;
}

export function ManagementDatabasePage() {
  const { setNotice, refreshAll } = useManagement();
  const [isBusy, setIsBusy] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const runDatabaseAction = async (action: () => Promise<void>): Promise<void> => {
    setIsBusy(true);
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setNotice(`Operación de base de datos fallida: ${message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const exportDatabase = async (): Promise<void> => {
    await runDatabaseAction(async () => {
      const tables: Record<string, unknown[]> = {};
      for (const table of db.tables) {
        tables[table.name] = await table.toArray();
      }
      const payload: DatabaseExportPayload = {
        app: "ProfePlus",
        exportedAt: new Date().toISOString(),
        tables
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = buildBackupFileName();
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        URL.revokeObjectURL(downloadUrl);
      }
      setNotice("Base de datos exportada.");
    });
  };

  const importDatabaseFromFile = async (file: File): Promise<void> => {
    await runDatabaseAction(async () => {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("El archivo no es JSON válido.");
      }

      const tablesData = (parsed as { tables?: unknown })?.tables;
      if (!tablesData || typeof tablesData !== "object") {
        throw new Error("El archivo no contiene un bloque 'tables' válido.");
      }

      await db.transaction("rw", db.tables, async () => {
        for (const table of db.tables) {
          await table.clear();
        }
        for (const table of db.tables) {
          const rows = (tablesData as Record<string, unknown>)[table.name];
          if (Array.isArray(rows) && rows.length > 0) {
            await table.bulkPut(rows as object[]);
          }
        }
      });

      await refreshAll();
      setNotice("Base de datos importada.");
    });
  };

  const deleteAllDatabase = async (): Promise<void> => {
    await runDatabaseAction(async () => {
      await db.transaction("rw", db.tables, async () => {
        for (const table of db.tables) {
          await table.clear();
        }
      });
      await refreshAll();
      setNotice("Todos los datos de la base han sido eliminados.");
      setShowDeleteAllModal(false);
    });
  };

  return (
    <>
      <article className="management-card">
        <h3>Base de datos</h3>
        <p className="hint">Exporta, importa o borra todos los datos de la app.</p>

        <div className="inline-form">
          <button
            type="button"
            className="btn secondary"
            disabled={isBusy}
            onClick={() => void exportDatabase()}
          >
            Exportar
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={isBusy}
            onClick={() => importInputRef.current?.click()}
          >
            Importar
          </button>
          <button
            type="button"
            className="btn secondary management-danger-btn"
            disabled={isBusy}
            onClick={() => setShowDeleteAllModal(true)}
          >
            Borrar todo
          </button>
        </div>

        <input
          ref={importInputRef}
          className="student-photo-input-hidden"
          type="file"
          accept="application/json,.json"
          disabled={isBusy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (!file) {
              return;
            }
            void importDatabaseFromFile(file);
          }}
        />

        {isBusy ? (
          <div className="management-progress" role="status" aria-label="Procesando base de datos">
            <div className="management-progress-bar" />
          </div>
        ) : null}
      </article>

      <Modal
        open={showDeleteAllModal}
        title="Borrar toda la base de datos"
        onClose={() => {
          if (!isBusy) {
            setShowDeleteAllModal(false);
          }
        }}
      >
        <p>Se eliminarán todos los datos de la app. Esta acción no se puede deshacer.</p>
        <div className="inline-form">
          <button
            type="button"
            className="btn secondary"
            disabled={isBusy}
            onClick={() => setShowDeleteAllModal(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn secondary management-danger-btn"
            disabled={isBusy}
            onClick={() => void deleteAllDatabase()}
          >
            Borrar todo
          </button>
        </div>
      </Modal>
    </>
  );
}
