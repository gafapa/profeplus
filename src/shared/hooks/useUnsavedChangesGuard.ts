import { useCallback, useContext, useEffect } from "react";
import { UNSAFE_NavigationContext as NavigationContext, useBeforeUnload } from "react-router-dom";
import { useUnsavedChangesDialog } from "../ui/UnsavedChangesDialog";

const DEFAULT_MESSAGE = "Tienes cambios sin guardar. Si sales ahora, se perderan.";

type BlockableNavigator = {
  block?: (blocker: (tx: { retry: () => void }) => void) => () => void;
};

export function useUnsavedChangesGuard(when: boolean, message = DEFAULT_MESSAGE): void {
  const navigationContext = useContext(NavigationContext) as { navigator?: BlockableNavigator } | null;
  const dialog = useUnsavedChangesDialog();

  const handleBeforeUnload = useCallback(
    (event: BeforeUnloadEvent) => {
      if (!when) {
        return;
      }
      event.preventDefault();
      event.returnValue = message;
    },
    [message, when]
  );

  useBeforeUnload(handleBeforeUnload, { capture: true });

  useEffect(() => {
    if (!when) {
      return;
    }
    const block = navigationContext?.navigator?.block;
    if (typeof block !== "function") {
      return;
    }

    const unblock = block((tx) => {
      void (async () => {
        const shouldLeave = dialog
          ? await dialog.confirmLeave(message)
          : window.confirm(message);

        if (!shouldLeave) {
          return;
        }
        unblock();
        tx.retry();
      })();
    });

    return unblock;
  }, [dialog, message, navigationContext, when]);
}
