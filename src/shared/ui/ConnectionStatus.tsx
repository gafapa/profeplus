import { useEffect, useState } from "react";

function readInitialConnectionState(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(readInitialConnectionState);

  useEffect(() => {
    const handleOnline = (): void => setIsOnline(true);
    const handleOffline = (): void => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <span
      className={`connection-status ${isOnline ? "online" : "offline"}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="connection-status-dot" aria-hidden="true" />
      <span>{isOnline ? "En línea" : "Sin conexión · guardando en este dispositivo"}</span>
    </span>
  );
}
