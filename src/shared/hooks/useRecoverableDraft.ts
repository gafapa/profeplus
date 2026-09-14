import { useEffect, useRef, useState } from "react";
import { readLocalDraft, removeLocalDraft, writeLocalDraft } from "../drafts/localDrafts";

export function useRecoverableDraft<T>(key: string | null, value: T, dirty: boolean, isValid: (value: unknown) => value is T, apply: (value: T) => void) {
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<T | null>(null);
  const [storageError, setStorageError] = useState(false);
  const dirtiedSinceRecovery = useRef(false);
  useEffect(() => {
    const saved = key ? readLocalDraft(key) : null;
    setRecovery(isValid(saved) ? saved : null);
    setLoadedKey(key);
    dirtiedSinceRecovery.current = false;
  }, [key, isValid]);
  useEffect(() => {
    if (!key || loadedKey !== key) return;
    if (recovery) {
      if (dirty) {
        dirtiedSinceRecovery.current = true;
      } else if (dirtiedSinceRecovery.current) {
        // The user ignored the recovery banner, edited the form, and saved fresh
        // data: the leftover draft is now stale and must not resurface later.
        removeLocalDraft(key);
        setRecovery(null);
      }
      return;
    }
    if (dirty) setStorageError(!writeLocalDraft(key, value));
    else removeLocalDraft(key);
  }, [key, loadedKey, recovery, dirty, value]);
  const discard = () => {
    if (key) removeLocalDraft(key);
    setRecovery(null);
  };
  return {
    available: Boolean(recovery && key === loadedKey),
    storageError,
    restore: () => { if (recovery && key === loadedKey) { apply(recovery); setRecovery(null); } },
    discard
  };
}
