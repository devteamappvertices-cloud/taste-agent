"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal behavior: focuses `initial` on open, closes on Escape, keeps Tab inside the dialog,
 * and returns focus to whatever opened it.
 */
export function useDialog(
  dialog: RefObject<HTMLElement | null>,
  initial: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    initial.current?.focus();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close.current();
      if (ev.key !== "Tab" || !dialog.current) return;
      const items = dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = items[0];
      const last = items[items.length - 1];
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [dialog, initial]);
}
