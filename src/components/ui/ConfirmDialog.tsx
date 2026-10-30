"use client";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Delete",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#12241c]/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="lg-card w-full max-w-md p-5">
        <h2 id="confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-[var(--lagecto-muted)]">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full border px-4 py-2 text-sm">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="rounded-full bg-[#C2413B] px-4 py-2 text-sm font-semibold text-white">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
