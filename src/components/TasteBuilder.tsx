"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { EntityCard } from "@/lib/qloo";

interface Favorite {
  name: string;
  id?: string;
  type?: string;
  image?: string;
}

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

const STARTERS: Favorite[] = [
  { name: "Radiohead", id: "70CAE5BF-2F4C-445C-A3E5-4EDACFC3591C", type: "artist" },
  { name: "Studio Ghibli" },
  { name: "The Bear" },
  { name: "Taylor Swift" },
  { name: "Dune" },
];

const TYPE_LABEL: Record<string, string> = {
  tv_show: "TV show",
  video_game: "Video game",
  place: "Place",
  artist: "Artist",
  movie: "Movie",
  book: "Book",
  podcast: "Podcast",
  destination: "Destination",
  brand: "Brand",
  person: "Person",
  author: "Author",
  album: "Album",
  videogame: "Video game",
};

/** Builds the prompt; `content` carries Qloo IDs for the agent, `display` is what the user sees. */
export function TasteBuilder({
  onSubmit,
  busy,
}: {
  onSubmit: (display: string, content: string, known: EntityCard[]) => void;
  busy: boolean;
}) {
  const [loves, setLoves] = useState<Favorite[]>([]);
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<Favorite[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const [open, setOpen] = useState(false);
  const [want, setWant] = useState<(typeof CATEGORIES)[number] | null>(null);
  const [where, setWhere] = useState("");
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);

  // Debounced Qloo autocomplete.
  useEffect(() => {
    const q = draft.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const body = await res.json();
        setSuggestions(body.results ?? []);
        setHighlight(-1);
        setOpen(true);
      } catch {
        // aborted or offline: keep free-text entry working
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [draft]);

  function add(f: Favorite) {
    const name = f.name.trim().replace(/,$/, "");
    if (name && !loves.some((l) => (f.id && l.id === f.id) || l.name.toLowerCase() === name.toLowerCase())) {
      setLoves([...loves, { ...f, name }]);
    }
    setDraft("");
    setSuggestions([]);
    setOpen(false);
    input.current?.focus();
  }

  const pending = draft.trim();
  const all = pending ? [...loves, { name: pending }] : loves;
  const ready = all.length > 0 && !!want && !busy;

  function submit() {
    if (!ready || !want) return;
    const place = want.place && where.trim() ? ` in ${where.trim()}` : "";
    const ask = `Recommend ${want.phrase}${place} that match my taste.`;
    const names = all.map((f) => f.name).join(", ");
    const tagged = all.map((f) => (f.id ? `${f.name} [${f.id}]` : f.name)).join(", ");
    const known = all
      .filter((f) => f.id)
      .map((f) => ({ id: f.id!, name: f.name, type: f.type ?? "", image: f.image, tags: [] }));
    onSubmit(`I love ${names}. ${ask}`, `I love ${tagged}. ${ask}`, known);
  }

  const showList = open && suggestions.length > 0;

  return (
    <div>
      <label htmlFor="loves" className="block font-display text-base font-semibold">
        1. What do you love?
      </label>
      <p className="text-sm text-muted">Start typing an artist, film, show, book or place.</p>

      <div className="relative mt-2">
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-paper p-1.5 focus-within:border-forest">
          {loves.map((l) => (
            <span key={l.id ?? l.name} className="flex items-center gap-1.5 rounded-full bg-forest py-0.5 pl-0.5 pr-1 text-sm text-forest-ink">
              {l.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.image} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <span className="w-1.5" />
              )}
              {l.name}
              <button
                type="button"
                onClick={() => setLoves(loves.filter((x) => x !== l))}
                aria-label={`Remove ${l.name}`}
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-black/15"
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={input}
            id="loves"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={highlight >= 0 ? `${listId}-${highlight}` : undefined}
            autoComplete="off"
            value={draft}
            onChange={(e) => (e.target.value.endsWith(",") ? add({ name: e.target.value }) : setDraft(e.target.value))}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && suggestions.length) {
                e.preventDefault();
                setOpen(true);
                setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
              } else if (e.key === "ArrowUp" && suggestions.length) {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, -1));
              } else if (e.key === "Escape") {
                setOpen(false);
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (showList && highlight >= 0) add(suggestions[highlight]);
                else if (pending) add({ name: pending });
                else submit();
              } else if (e.key === "Backspace" && !draft && loves.length) {
                setLoves(loves.slice(0, -1));
              }
            }}
            placeholder={loves.length ? "Add another" : "e.g. Radiohead"}
            className="min-w-32 flex-1 bg-transparent px-2 py-1 text-[15px] outline-none placeholder:text-muted focus-visible:outline-none"
          />
        </div>

        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg"
          >
            {suggestions.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(s);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex cursor-pointer items-center gap-2.5 px-2.5 py-1.5 ${i === highlight ? "bg-paper" : ""}`}
              >
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt="" className="h-8 w-8 rounded-md object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-paper font-display text-sm text-muted">
                    {s.name.slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                <span className="shrink-0 text-xs text-muted">{TYPE_LABEL[s.type ?? ""] ?? s.type}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loves.length === 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">Popular:</span>
          {STARTERS.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-muted hover:border-forest hover:text-ink"
            >
              + {s.name}
            </button>
          ))}
        </div>
      )}

      <p className="mt-5 font-display text-base font-semibold">2. What should we find for you?</p>
      <div role="radiogroup" aria-label="What should we find for you?" className="mt-2 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={want?.key === c.key}
            onClick={() => setWant(c)}
            className={`rounded-full border px-3 py-1 text-sm ${
              want?.key === c.key ? "border-forest bg-forest text-forest-ink" : "border-line hover:border-forest"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {want?.place && (
        <div className="mt-4">
          <label htmlFor="where" className="block text-sm font-medium">
            Where? <span className="font-normal text-muted">City or neighborhood (optional)</span>
          </label>
          <input
            id="where"
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. Lisbon"
            className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-1.5 text-[15px] outline-none placeholder:text-muted focus:border-forest focus-visible:outline-none"
          />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className="rounded-xl bg-forest px-5 py-2.5 font-medium text-forest-ink disabled:opacity-35"
        >
          Find my matches
        </button>
        {!ready && !busy && (
          <span className="text-xs text-muted">
            {all.length === 0 ? "Add at least one favorite." : "Pick what we should find."}
          </span>
        )}
      </div>
    </div>
  );
}
