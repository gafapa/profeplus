import { useEffect, useRef, useState } from "react";
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
    timerRef.current = setTimeout(() => setVisible(false), 2500);
  }, [notice]);

  return (
    <section className="module-card">
      {isBusy ? (
        <div className="management-progress" role="status" aria-label="Procesando acción">
          <div className="management-progress-bar" />
        </div>
      ) : null}
      {visible && (
        <div className="notice-float" role="status" aria-live="polite">
          <span className="notice-float-icon">✓</span>
          <span className="notice-float-text">{text}</span>
        </div>
      )}
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
