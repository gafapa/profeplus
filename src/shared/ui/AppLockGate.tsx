import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  APP_LOCK_CHANGED_EVENT,
  APP_LOCK_NOW_EVENT,
  readAppLockConfig,
  verifyAppLockPassphrase,
  type AppLockConfig
} from "../security/appLock";

export function AppLockGate({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppLockConfig | null>(() => readAppLockConfig());
  const [locked, setLocked] = useState(() => Boolean(readAppLockConfig()));
  const [passphrase, setPassphrase] = useState("");
  const [notice, setNotice] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const activityTimer = useRef<number | null>(null);
  const lastActivityAt = useRef(Date.now());

  useEffect(() => {
    const handleConfigChange = () => {
      const next = readAppLockConfig();
      setConfig(next);
      if (!next) setLocked(false);
    };
    const handleLockNow = () => {
      if (readAppLockConfig()) setLocked(true);
    };
    window.addEventListener(APP_LOCK_CHANGED_EVENT, handleConfigChange);
    window.addEventListener(APP_LOCK_NOW_EVENT, handleLockNow);
    return () => {
      window.removeEventListener(APP_LOCK_CHANGED_EVENT, handleConfigChange);
      window.removeEventListener(APP_LOCK_NOW_EVENT, handleLockNow);
    };
  }, []);

  useEffect(() => {
    if (!config || locked) return;
    const resetTimer = () => {
      lastActivityAt.current = Date.now();
      if (activityTimer.current !== null) window.clearTimeout(activityTimer.current);
      activityTimer.current = window.setTimeout(
        () => setLocked(true),
        config.autoLockMinutes * 60_000
      );
    };
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastActivityAt.current >= config.autoLockMinutes * 60_000
      ) {
        setLocked(true);
      }
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    for (const eventName of events) window.addEventListener(eventName, resetTimer, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    resetTimer();
    return () => {
      for (const eventName of events) window.removeEventListener(eventName, resetTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (activityTimer.current !== null) window.clearTimeout(activityTimer.current);
    };
  }, [config, locked]);

  const unlock = async (): Promise<void> => {
    if (!config) return;
    setIsVerifying(true);
    try {
      if (!(await verifyAppLockPassphrase(config, passphrase))) {
        setNotice("La clave no es correcta.");
        return;
      }
      setPassphrase("");
      setNotice("");
      setLocked(false);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!config || !locked) return children;

  return (
    <main className="app-lock-screen" id="main-content">
      <form
        className="app-lock-card"
        onSubmit={(event) => {
          event.preventDefault();
          void unlock();
        }}
      >
        <span className="app-lock-mark" aria-hidden="true">PP</span>
        <h1>ProfePlus está bloqueado</h1>
        <p>Introduce la clave local de este dispositivo para continuar.</p>
        <label className="detail-field">
          <span>Clave del dispositivo</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
          />
        </label>
        {notice ? <p className="form-error" role="alert">{notice}</p> : null}
        <button className="btn primary" type="submit" disabled={isVerifying || !passphrase}>
          {isVerifying ? "Comprobando…" : "Desbloquear"}
        </button>
      </form>
    </main>
  );
}

export function AppLockButton() {
  const [enabled, setEnabled] = useState(() => Boolean(readAppLockConfig()));
  useEffect(() => {
    const handleChange = () => setEnabled(Boolean(readAppLockConfig()));
    window.addEventListener(APP_LOCK_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(APP_LOCK_CHANGED_EVENT, handleChange);
  }, []);
  if (!enabled) return null;
  return (
    <button
      type="button"
      className="status-bar-button"
      onClick={() => window.dispatchEvent(new Event(APP_LOCK_NOW_EVENT))}
    >
      Bloquear ahora
    </button>
  );
}
