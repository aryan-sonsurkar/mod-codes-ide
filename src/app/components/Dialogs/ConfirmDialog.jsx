import "./ConfirmDialog.css";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="confirm-overlay" onClick={onCancel} role="presentation">
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={title ? "confirm-dialog-title" : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        {title && <p className="confirm-title" id="confirm-dialog-title">{title}</p>}
        <div className="confirm-message">{message}</div>
        <div className="confirm-actions">
          <button className="confirm-button" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button
            className={`confirm-button${
              danger
                ? " confirm-button-danger"
                : " confirm-button-primary"
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}