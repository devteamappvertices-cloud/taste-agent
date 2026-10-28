"use client";

import { useEffect, useRef } from "react";
import { useSpeech } from "@/lib/useSpeech";

interface Props {
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

export function Composer({ value, onChange, onSend, busy, placeholder }: Props) {
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
      {speech.error && <p className="mb-1.5 text-xs text-red-600 dark:text-red-400">{speech.error}</p>}
      <div
        className={`flex items-end gap-2 rounded-2xl border bg-surface p-2 transition-colors ${
          speech.listening ? "border-forest" : "border-line focus-within:border-forest"
        }`}
      >
        <textarea
          ref={area}
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
          aria-label="Message"
          className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-6 outline-none placeholder:text-muted focus-visible:outline-none"
        />
        {speech.supported && (
          <button
            type="button"
            onClick={() => (speech.listening ? speech.stop() : speech.start(value))}
            disabled={busy}
            aria-label={speech.listening ? "Stop voice input" : "Speak instead of typing"}
            aria-pressed={speech.listening}
            title={speech.listening ? "Stop listening" : "Speak instead of typing"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-40 ${
              speech.listening ? "animate-pulse bg-red-600 text-white" : "text-muted hover:bg-paper hover:text-ink"
            }`}
          >
            <MicIcon />
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={busy || !value.trim()}
          className="h-10 shrink-0 rounded-xl bg-forest px-4 text-sm font-medium text-forest-ink disabled:opacity-35"
        >
          {busy ? "Working…" : "Send"}
        </button>
      </div>
      <p className="mt-1.5 px-1 text-xs text-muted">Enter to send, Shift + Enter for a new line</p>
    </div>
  );
}
