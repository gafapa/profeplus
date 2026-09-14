import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Outlet } from "react-router-dom";
import { ManagementProvider, useManagement } from "./ManagementContext";

function ManagementShell() {
  const { notice, isBusy } = useManagement();
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!notice) return;
    setText(notice);
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 8000);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [notice]);

  const notificationRegion = document.getElementById("global-notification-region");
  const noticeElement = visible ? (
    <div className="notice-float" role="status" aria-live="polite">
      <span className="notice-float-text">{text}</span>
      <button
        type="button"
        className="notice-float-dismiss"
        aria-label="Cerrar aviso"
        onClick={() => setVisible(false)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </div>
  ) : null;

  return (
    <section className="module-card">
      {isBusy ? (
        <div className="management-progress" role="status" aria-label="Procesando acción">
          <div className="management-progress-bar" />
        </div>
      ) : null}
      {noticeElement && notificationRegion ? createPortal(noticeElement, notificationRegion) : noticeElement}
      <Outlet />
    </section>
  );
}

export function ManagementLayout() {
  return (
    <ManagementProvider>
      <ManagementShell />
    </ManagementProvider>
  );
}
