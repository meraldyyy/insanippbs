import { AlertTriangle, X } from 'lucide-react';

type ConfirmModalProps = {
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  title,
  description,
  confirmLabel,
  busy = false,
  danger = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (!busy && event.target === event.currentTarget) onCancel();
      }}
    >
      <section className="modal-card confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title" aria-describedby="confirm-modal-description">
        <div className="modal-heading">
          <div className="confirm-modal-icon"><AlertTriangle size={20} /></div>
          <button className="icon-button" type="button" onClick={onCancel} disabled={busy} aria-label="Tutup"><X size={18} /></button>
        </div>
        <h2 id="confirm-modal-title">{title}</h2>
        <p id="confirm-modal-description">{description}</p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>Batal</button>
          <button type="button" className={danger ? 'danger-confirm-button' : 'primary-button'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
