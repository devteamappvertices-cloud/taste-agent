"use client";

import { useEffect, useRef } from "react";

/** Themed yes/no question; native <dialog> handles focus, Escape and the backdrop. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDialogElement>(null);
  useEffect(() => box.current?.showModal(), []);

  return (
    <dialog
      ref={box}
      onClose={onClose}
      onClick={(e) => e.target === box.current && box.current?.close()}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="font-display text-xl font-bold tracking-tight">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => box.current?.close()}
            className="h-10 rounded-full border border-line bg-surface px-5 text-sm font-semibold transition-colors hover:border-forest hover:text-forest"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              box.current?.close();
            }}
            className="h-10 rounded-full bg-red-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-red-800"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
