type DraftRecoveryNoticeProps = {
  available: boolean;
  storageError: boolean;
  restore: () => void;
  discard: () => void;
};

export function DraftRecoveryNotice({ available, storageError, restore, discard }: DraftRecoveryNoticeProps) {
  if (storageError) return <p role="alert">No se ha podido conservar el borrador en este navegador. Guarda los cambios antes de salir.</p>;
  if (!available) return null;
  return (
    <section className="detail-section" aria-label="Recuperar borrador">
      <p>Hay un borrador local sin confirmar de este contexto. No forma parte de la copia de seguridad hasta que lo guardes.</p>
      <div className="inline-form">
        <button type="button" className="btn" onClick={restore}>Recuperar borrador</button>
        <button type="button" className="btn secondary" onClick={discard}>Descartar borrador</button>
      </div>
    </section>
  );
}
