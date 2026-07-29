import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";

type ModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  panelClassName?: string;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({
  open,
  title,
  subtitle,
  panelClassName = "",
  onClose,
  children
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.setTimeout(() => panelRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusableElements = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");
        if (focusableElements.length === 0) {
          event.preventDefault();
          panelRef.current.focus();
          return;
        }
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className={`modal-panel ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? descriptionId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p id={descriptionId}>{subtitle}</p> : null}
          </div>
          <IconButton icon="close" label="Cerrar" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
