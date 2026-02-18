import type { ReactNode } from "react";
import { IconButton } from "./IconButton";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h4>{title}</h4>
          <IconButton icon="close" label="Cerrar" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
