"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import type { EntityCard } from "@/lib/qloo";

export interface Favorite {
  name: string;
  id?: string;
  type?: string;
  image?: string;
}

export const CATEGORIES = [
  { key: "restaurants", label: "Restaurants", title: "Restaurants", phrase: "restaurants", place: true },
  { key: "bars", label: "Bars & cafés", title: "Bars and cafés", phrase: "bars and cafés", place: true },
  { key: "travel", label: "Travel", title: "Places to travel", phrase: "travel destinations", place: false },
  { key: "movies", label: "Movies", title: "Movies", phrase: "movies", place: false },
  { key: "tv", label: "TV shows", title: "TV shows", phrase: "TV shows", place: false },
  { key: "music", label: "Music", title: "Music", phrase: "music artists", place: false },
  { key: "books", label: "Books", title: "Books", phrase: "books", place: false },
  { key: "podcasts", label: "Podcasts", title: "Podcasts", phrase: "podcasts", place: false },
  { key: "brands", label: "Brands", title: "Brands", phrase: "brands", place: false },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

/** What the guided search holds; kept by the page so "Edit search" can bring it back. */
export interface TasteForm {
  loves: Favorite[];
  want: CategoryKey | null;
  where: string;
}

export const EMPTY_FORM: TasteForm = { loves: [], want: null, where: "" };

export interface Search {
  /** What the user sees. */
  display: string;
  /** What the agent gets, with Qloo IDs. */
  content: string;
  known: EntityCard[];
  title: string;
}

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

function Check() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

type StepState = "done" | "current" | "todo";

function Step({
  n,
  state,
  title,
  titleId,
  hint,
  last,
  children,
}: {
  n: number;
  state: StepState;
  title: string;
  titleId: string;
  hint?: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <li className={`relative flex gap-3.5 sm:gap-4 ${last ? "" : "pb-6"}`}>
      {!last && (
        <span
          aria-hidden="true"
          className={`absolute bottom-1 left-[15px] top-10 w-0.5 rounded-full ${state === "done" ? "bg-forest" : "bg-line"}`}
        />
      )}
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          state === "done"
            ? "bg-forest text-forest-ink"
            : state === "current"
              ? "border-2 border-forest text-forest"
              : "border-2 border-line text-muted"
        }`}
      >
        {state === "done" ? <Check /> : n}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <h2 id={titleId} className="font-display text-[17px] font-semibold leading-tight">
          {title}
          {state === "done" && <span className="sr-only"> (done)</span>}
        </h2>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
        <div className="mt-2.5">{children}</div>
      </div>
    </li>
  );
}

export function TasteBuilder({
  form,
  onChange,
  onSubmit,
  busy,
  findRef,
}: {
  form: TasteForm;
  onChange: (f: TasteForm) => void;
  onSubmit: (s: Search) => void;
  busy: boolean;
  findRef?: Ref<HTMLButtonElement>;
}) {
  const { loves, where } = form;
  const want = CATEGORIES.find((c) => c.key === form.want) ?? null;
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<Favorite[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const [open, setOpen] = useState(false);
  const ids = useId();
  const listId = `${ids}-list`;
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
      onChange({ ...form, loves: [...loves, { ...f, name }] });
    }
    setDraft("");
    setSuggestions([]);
    setOpen(false);
    input.current?.focus();
  }

  function remove(f: Favorite) {
    onChange({ ...form, loves: loves.filter((x) => x !== f) });
    input.current?.focus();
  }

  const pending = draft.trim();
  const all = pending ? [...loves, { name: pending }] : loves;
  const ready = all.length > 0 && !!want && !busy;

  function submit() {
    if (!ready || !want) return;
    const city = want.place ? where.trim() : "";
    const ask = `Recommend ${want.phrase}${city ? ` in ${city}` : ""} that match my taste.`;
    const names = all.map((f) => f.name).join(", ");
    const tagged = all.map((f) => (f.id ? `${f.name} [${f.id}]` : f.name)).join(", ");
    const known = all
      .filter((f) => f.id)
      .map((f) => ({ id: f.id!, name: f.name, type: f.type ?? "", image: f.image, tags: [] }));
    onSubmit({
      display: `I love ${names}. ${ask}`,
      content: `I love ${tagged}. ${ask}`,
      known,
      title: `${want.title}${city ? ` in ${city}` : ""} for you`,
    });
  }

  const showList = open && suggestions.length > 0;
  const s1: StepState = all.length > 0 ? "done" : "current";
  const s2: StepState = want ? "done" : s1 === "done" ? "current" : "todo";
  const s3: StepState = s1 === "done" && s2 === "done" ? "current" : "todo";

  return (
    <ol>
      <Step
        n={1}
        state={s1}
        title="What do you love?"
        titleId={`${ids}-s1`}
        hint="Add a few artists, films, shows, books or places."
      >
        <div className="relative">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-paper p-1.5 focus-within:border-forest">
            {loves.map((l) => (
              <span
                key={l.id ?? l.name}
                className="flex items-center gap-1.5 rounded-full bg-forest py-0.5 pl-0.5 pr-0.5 text-sm text-forest-ink"
              >
                {l.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.image} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <span className="w-1.5" />
                )}
                {l.name}
                <button
                  type="button"
                  onClick={() => remove(l)}
                  aria-label={`Remove ${l.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-base hover:bg-black/15"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={input}
              id={`${ids}-loves`}
              role="combobox"
              aria-labelledby={`${ids}-s1`}
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
                  onChange({ ...form, loves: loves.slice(0, -1) });
                }
              }}
              placeholder={loves.length ? "Add another" : "Start typing, e.g. Radiohead"}
              className="min-h-9 min-w-36 flex-1 bg-transparent px-2 text-[15px] outline-none placeholder:text-muted focus-visible:outline-none"
            />
          </div>

          {showList && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Suggestions from Qloo"
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
                className="min-h-8 rounded-full border border-dashed border-line px-2.5 text-xs text-muted hover:border-forest hover:text-ink"
              >
                <span aria-hidden="true">+ </span>
                {s.name}
              </button>
            ))}
          </div>
        )}
      </Step>

      <Step n={2} state={s2} title="What should we find?" titleId={`${ids}-s2`}>
        <div role="radiogroup" aria-labelledby={`${ids}-s2`} className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <label key={c.key} className="cursor-pointer">
              <input
                type="radio"
                name={`${ids}-want`}
                value={c.key}
                checked={form.want === c.key}
                onChange={() => onChange({ ...form, want: c.key })}
                className="peer sr-only"
              />
              <span className="flex min-h-9 items-center rounded-full border border-line px-3.5 text-sm hover:border-forest peer-checked:border-forest peer-checked:bg-forest peer-checked:text-forest-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest">
                {c.label}
              </span>
            </label>
          ))}
        </div>

        {want?.place && (
          <div className="mt-3">
            <label htmlFor={`${ids}-where`} className="block text-sm font-medium">
              Where? <span className="font-normal text-muted">City or neighborhood, optional</span>
            </label>
            <input
              id={`${ids}-where`}
              value={where}
              onChange={(e) => onChange({ ...form, where: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="e.g. Lisbon"
              className="mt-1.5 min-h-10 w-full max-w-xs rounded-xl border border-line bg-paper px-3 text-[15px] outline-none placeholder:text-muted focus:border-forest focus-visible:outline-none"
            />
          </div>
        )}
      </Step>

      <Step n={3} state={s3} title="Get your matches" titleId={`${ids}-s3`} last>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            ref={findRef}
            type="button"
            onClick={submit}
            disabled={!ready}
            className="min-h-11 w-full rounded-xl bg-forest px-6 font-medium text-forest-ink disabled:opacity-35 sm:w-auto"
          >
            {busy ? "Finding matches…" : "Find my matches"}
          </button>
          <p aria-live="polite" className="text-sm text-muted">
            {busy
              ? ""
              : all.length === 0
                ? "Add at least one favorite first."
                : !want
                  ? "Pick what we should find."
                  : "Takes about 10–20 seconds."}
          </p>
        </div>
      </Step>
    </ol>
  );
}
