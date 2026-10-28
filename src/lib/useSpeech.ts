"use client";

import { useEffect, useRef, useState } from "react";

// Minimal typing for the Web Speech API (Chrome, Edge, Safari expose it prefixed).
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Voice-to-text: spoken words are appended to `base` and passed to `onText` as they arrive. */
export function useSpeech(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<Recognition | null>(null);

  useEffect(() => setSupported(!!getRecognition()), []);

  function stop() {
    rec.current?.stop();
  }

  function start(base: string) {
    const Ctor = getRecognition();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;

    const prefix = base ? base.trimEnd() + " " : "";
    r.onresult = (e) => {
      let spoken = "";
      for (let i = 0; i < e.results.length; i++) spoken += e.results[i][0].transcript;
      onText(prefix + spoken.trimStart());
    };
    r.onerror = (e) =>
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone access is blocked. Allow it in your browser settings to use voice."
          : e.error === "no-speech"
            ? "No speech heard. Tap the mic and try again."
            : `Voice input stopped: ${e.error}`,
      );
    r.onend = () => setListening(false);

    setError("");
    rec.current = r;
    r.start();
    setListening(true);
  }

  return { supported, listening, error, start, stop };
}
