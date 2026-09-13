"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A modal built on the native <dialog> element, so focus trapping, the
 * backdrop, Escape-to-close and inertness of the page behind it all come
 * from the platform rather than hand-rolled JavaScript.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Action buttons for the modal footer. */
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="modal-title"
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        // A click landing on the dialog element itself is a backdrop click —
        // clicks inside the content hit a child instead.
        if (event.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-teal-100 bg-white p-5 shadow-xl backdrop:bg-teal-950/40"
    >
      <div className="flex flex-col gap-3">
        <h2 id="modal-title" className="text-lg font-semibold text-teal-950">
          {title}
        </h2>
        {description ? <p className="text-sm text-teal-950/70">{description}</p> : null}
        <div className="mt-1 flex flex-col gap-2">{children}</div>
      </div>
    </dialog>
  );
}
