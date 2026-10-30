"use client";

import { useEffect, useRef } from "react";
import { useSpeech } from "@/lib/useSpeech";

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onSend: (v: string) => void;
  busy: boolean;
  placeholder: string;
}

export function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Round green send button, shared by every input. */
function SendButton({ disabled, onClick, label, busy }: { disabled: boolean; onClick: () => void; label: string; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-forest-ink shadow-[0_6px_16px_-6px_var(--forest)] transition-transform duration-300 ease-[var(--ease-out)] hover:scale-105 active:scale-95 disabled:opacity-35 disabled:shadow-none disabled:hover:scale-100"
    >
      {busy ? (
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <ArrowIcon />
      )}
    </button>
  );
}

export function Composer({ id, value, onChange, onSend, busy, placeholder }: Props) {
  const area = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeech(onChange);

  // Grow with the text, up to about six lines.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
    el.style.overflowY = el.scrollHeight > 160 ? "auto" : "hidden";
  }, [value]);

  function submit() {
    speech.stop();
    if (value.trim() && !busy) onSend(value);
  }

  return (
    <div>
      {speech.error && <p className="mb-1.5 px-4 text-xs text-red-700">{speech.error}</p>}
      <div
        className={`flex items-center gap-1.5 rounded-[28px] border bg-surface py-1.5 pl-4 pr-1.5 shadow-[0_10px_30px_-18px_rgba(13,20,36,0.35)] transition-colors ${
          speech.listening ? "border-forest" : "border-line focus-within:border-forest"
        }`}
      >
        <textarea
          ref={area}
          id={id}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={speech.listening ? "Listening… speak now" : placeholder}
          aria-label={placeholder}
          className="max-h-40 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-6 outline-none placeholder:text-muted focus-visible:outline-none"
        />
        {speech.supported && (
          <button
            type="button"
            onClick={() => (speech.listening ? speech.stop() : speech.start(value))}
            disabled={busy}
            aria-label={speech.listening ? "Stop voice input" : "Speak instead of typing"}
            aria-pressed={speech.listening}
            title={speech.listening ? "Stop listening" : "Speak instead of typing"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${
              speech.listening ? "animate-pulse bg-red-600 text-white" : "text-muted hover:bg-paper hover:text-ink"
            }`}
          >
            <MicIcon />
          </button>
        )}
        <SendButton onClick={submit} disabled={busy || !value.trim()} busy={busy} label={busy ? "Working" : "Send"} />
      </div>
    </div>
  );
}
