"use client";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4">
      <div className="card w-full max-w-sm p-5">
        <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
        {description && <p className="text-sm text-navy-500 mt-2">{description}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className={destructive ? "btn-danger" : "btn-primary"} onClick={onConfirm} disabled={busy}>
            {busy ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
