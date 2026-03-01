import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Modal } from "./Modal";

type UnsavedChangesDialogContextValue = {
  confirmLeave: (message: string) => Promise<boolean>;
};

type PendingDialogRequest = {
  message: string;
  resolve: (result: boolean) => void;
};

const UnsavedChangesDialogContext = createContext<UnsavedChangesDialogContextValue | null>(null);

export function UnsavedChangesDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingDialogRequest | null>(null);

  const closeWith = useCallback((result: boolean) => {
    setPending((current) => {
      if (current) {
        current.resolve(result);
      }
      return null;
    });
  }, []);

  const confirmLeave = useCallback((message: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending({
        message,
        resolve
      });
    });
  }, []);

  const value = useMemo<UnsavedChangesDialogContextValue>(
    () => ({
      confirmLeave
    }),
    [confirmLeave]
  );

  return (
    <UnsavedChangesDialogContext.Provider value={value}>
      {children}
      <Modal
        open={pending !== null}
        title="Cambios sin guardar"
        onClose={() => closeWith(false)}
      >
        <p>{pending?.message ?? "Tienes cambios sin guardar."}</p>
        <div className="inline-form">
          <button type="button" className="btn secondary" onClick={() => closeWith(false)}>
            Quedarme
          </button>
          <button type="button" className="btn" onClick={() => closeWith(true)}>
            Salir sin guardar
          </button>
        </div>
      </Modal>
    </UnsavedChangesDialogContext.Provider>
  );
}

export function useUnsavedChangesDialog() {
  return useContext(UnsavedChangesDialogContext);
}
