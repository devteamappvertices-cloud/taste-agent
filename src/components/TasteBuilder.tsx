"use client";

import { useState } from "react";

const CATEGORIES = [
  { key: "restaurants", label: "Restaurants", phrase: "restaurants", place: true },
  { key: "bars", label: "Bars & cafés", phrase: "bars and cafés", place: true },
  { key: "travel", label: "Travel", phrase: "travel destinations", place: false },
  { key: "movies", label: "Movies", phrase: "movies", place: false },
  { key: "tv", label: "TV shows", phrase: "TV shows", place: false },
  { key: "music", label: "Music", phrase: "music artists", place: false },
  { key: "books", label: "Books", phrase: "books", place: false },
  { key: "podcasts", label: "Podcasts", phrase: "podcasts", place: false },
  { key: "brands", label: "Brands", phrase: "brands", place: false },
] as const;

const STARTERS = ["Radiohead", "Studio Ghibli", "The Bear", "Taylor Swift", "Dune", "Anthony Bourdain"];

export function TasteBuilder({ onSubmit, busy }: { onSubmit: (prompt: string) => void; busy: boolean }) {
  const [loves, setLoves] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [want, setWant] = useState<(typeof CATEGORIES)[number] | null>(null);
  const [where, setWhere] = useState("");

  function add(name: string) {
    const n = name.trim().replace(/,$/, "");
    if (n && !loves.some((l) => l.toLowerCase() === n.toLowerCase())) setLoves([...loves, n]);
    setDraft("");
  }

  const pending = draft.trim();
  const all = pending ? [...loves, pending] : loves;
  const ready = all.length > 0 && want && !busy;

  function submit() {
    if (!ready || !want) return;
    const place = want.place && where.trim() ? ` in ${where.trim()}` : "";
    onSubmit(`I love ${all.join(", ")}. Recommend ${want.phrase}${place} that match my taste.`);
  }

  return (
    <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <label htmlFor="loves" className="block font-display text-lg font-semibold">
        What do you love?
      </label>
      <p className="mt-0.5 text-sm text-muted">Artists, films, shows, books, places. Add a few.</p>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-paper p-2 focus-within:border-forest">
        {loves.map((l) => (
          <span key={l} className="flex items-center gap-1 rounded-full bg-forest py-1 pl-3 pr-1 text-sm text-forest-ink">
            {l}
            <button
              type="button"
              onClick={() => setLoves(loves.filter((x) => x !== l))}
              aria-label={`Remove ${l}`}
              className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-black/15"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id="loves"
          value={draft}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (draft.trim()) add(draft);
              else submit();
            } else if (e.key === "Backspace" && !draft && loves.length) {
              setLoves(loves.slice(0, -1));
            }
          }}
          placeholder={loves.length ? "Add another" : "Type a name and press Enter"}
          className="min-w-40 flex-1 bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-muted focus-visible:outline-none"
        />
      </div>
      {loves.length === 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-line px-3 py-1 text-xs text-muted hover:border-forest hover:text-ink"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      <p className="mt-6 font-display text-lg font-semibold">What are you looking for?</p>
      <div role="radiogroup" aria-label="What are you looking for?" className="mt-3 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={want?.key === c.key}
            onClick={() => setWant(c)}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${
              want?.key === c.key ? "border-forest bg-forest text-forest-ink" : "border-line hover:border-forest"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {want?.place && (
        <div className="mt-5">
          <label htmlFor="where" className="block text-sm font-medium">
            Where? <span className="font-normal text-muted">City or neighborhood</span>
          </label>
          <input
            id="where"
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. Lisbon, Brooklyn, Shibuya"
            className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-[15px] outline-none placeholder:text-muted focus:border-forest focus-visible:outline-none"
          />
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!ready}
        className="mt-6 w-full rounded-xl bg-forest px-4 py-3 font-medium text-forest-ink disabled:opacity-35 sm:w-auto"
      >
        Find my matches
      </button>
      {!ready && !busy && (
        <span className="mt-2 block text-xs text-muted sm:ml-3 sm:mt-0 sm:inline">
          {all.length === 0 ? "Add at least one thing you love." : "Pick what you're looking for."}
        </span>
      )}
    </div>
  );
}
