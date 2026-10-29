"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { EntityCard } from "@/lib/qloo";
import { useDialog } from "@/lib/useDialog";

export interface Favorite {
  name: string;
  id?: string;
  type?: string;
  image?: string;
}

// `popular` are well-known picks in the same category, offered as one-tap favorites.
export const CATEGORIES = [
  { key: "restaurants", label: "Restaurants", title: "Restaurants", phrase: "restaurants", place: true,
    popular: ["Nobu", "Shake Shack", "Din Tai Fung", "Sweetgreen", "Joe's Pizza"] },
  { key: "bars", label: "Bars & cafés", title: "Bars and cafés", phrase: "bars and cafés", place: true,
    popular: ["Blue Bottle Coffee", "Starbucks", "Soho House", "Death & Co", "Ace Hotel"] },
  { key: "travel", label: "Travel", title: "Places to travel", phrase: "travel destinations", place: false,
    popular: ["Paris", "Tokyo", "Bali", "New York City", "Barcelona"] },
  { key: "movies", label: "Movies", title: "Movies", phrase: "movies", place: false,
    popular: ["Inception", "The Dark Knight", "Interstellar", "Titanic", "Avengers: Endgame"] },
  { key: "tv", label: "TV shows", title: "TV shows", phrase: "TV shows", place: false,
    popular: ["Breaking Bad", "Friends", "Game of Thrones", "The Office", "Stranger Things"] },
  { key: "music", label: "Music", title: "Music", phrase: "music artists", place: false,
    popular: ["Taylor Swift", "Drake", "Coldplay", "The Weeknd", "Radiohead"] },
  { key: "books", label: "Books", title: "Books", phrase: "books", place: false,
    popular: ["Harry Potter", "The Hunger Games", "Dune", "1984", "The Great Gatsby"] },
  { key: "podcasts", label: "Podcasts", title: "Podcasts", phrase: "podcasts", place: false,
    popular: ["Serial", "The Daily", "Huberman Lab", "Call Her Daddy", "The Joe Rogan Experience"] },
  { key: "brands", label: "Brands", title: "Brands", phrase: "brands", place: false,
    popular: ["Nike", "Apple", "Patagonia", "IKEA", "Lego"] },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];
type Category = (typeof CATEGORIES)[number];

/** What the guided search holds; kept by the page so "Edit search" can bring it back. */
export interface TasteForm {
  want: CategoryKey | null;
  loves: Favorite[];
  where: string;
}

export const EMPTY_FORM: TasteForm = { want: null, loves: [], where: "" };

export interface Search {
  /** What the user sees. */
  display: string;
  /** What the agent gets, with Qloo IDs. */
  content: string;
  known: EntityCard[];
  title: string;
}

// Popular picks with a known Qloo ID skip the agent's lookup.
const KNOWN_IDS: Record<string, Favorite> = {
  Radiohead: { name: "Radiohead", id: "70CAE5BF-2F4C-445C-A3E5-4EDACFC3591C", type: "artist" },
};

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

function buildSearch(want: Category, loves: Favorite[], where: string): Search {
  const city = want.place ? where.trim() : "";
  const ask = `Recommend ${want.phrase}${city ? ` in ${city}` : ""} that match my taste.`;
  const names = loves.map((f) => f.name).join(", ");
  const tagged = loves.map((f) => (f.id ? `${f.name} [${f.id}]` : f.name)).join(", ");
  const known = loves
    .filter((f) => f.id)
    .map((f) => ({ id: f.id!, name: f.name, type: f.type ?? "", image: f.image, tags: [] }));
  return {
    display: `I love ${names}. ${ask}`,
    content: `I love ${tagged}. ${ask}`,
    known,
    title: `${want.title}${city ? ` in ${city}` : ""} for you`,
  };
}

function hintFor(want: Category | null, count: number) {
  if (!want) return "Pick what we should find.";
  if (count === 0) return "Add at least one thing you love.";
  return "Takes about 10–20 seconds.";
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

function FavoriteChip({ f, onRemove }: { f: Favorite; onRemove?: () => void }) {
  return (
    <span className={`flex items-center gap-1.5 rounded-full bg-forest py-0.5 pl-0.5 text-sm text-forest-ink ${onRemove ? "pr-0.5" : "pr-3"}`}>
      {f.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={f.image} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <span className="w-1.5" />
      )}
      {f.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${f.name}`}
          className="flex h-7 w-7 items-center justify-center rounded-full text-base hover:bg-black/15"
        >
          ×
        </button>
      )}
    </span>
  );
}

type StepState = "done" | "current" | "todo";

function Step({
  n,
  state,
  title,
  titleId,
  last,
  children,
}: {
  n: number;
  state: StepState;
  title: string;
  titleId: string;
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
        <h2 id={titleId} className={`font-display text-[17px] font-semibold leading-tight ${state === "todo" ? "text-muted" : ""}`}>
          {title}
          {state === "done" && <span className="sr-only"> (done)</span>}
        </h2>
        <div className="mt-2.5">{children}</div>
      </div>
    </li>
  );
}

/** Step 2, in a dialog: type favorites with Qloo autocomplete, then find matches. */
function FavoritesDialog({
  want,
  form,
  onChange,
  onClose,
  onSubmit,
  busy,
}: {
  want: Category;
  form: TasteForm;
  onChange: (f: TasteForm) => void;
  onClose: () => void;
  onSubmit: (s: Search) => void;
  busy: boolean;
}) {
  const { loves, where } = form;
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<Favorite[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const ids = useId();
  const listId = `${ids}-list`;
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const find = useRef<HTMLButtonElement>(null);
  // Start in the text box, or on Find when favorites are already filled in (e.g. the example).
  const initial = useRef<HTMLElement | null>(null);
  useEffect(() => {
    initial.current = loves.length ? find.current : input.current;
    // only on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useDialog(panel, initial, onClose);

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
    input.current?.focus();
  }

  const pending = draft.trim();
  const all = pending ? [...loves, { name: pending }] : loves;
  const ready = all.length > 0 && !busy;
  const showList = suggestions.length > 0;

  function submit() {
    if (!ready) return;
    if (pending) onChange({ ...form, loves: all });
    onSubmit(buildSearch(want, all, where));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        aria-describedby={`${ids}-desc`}
        className="flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-surface sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-start gap-3 px-5 pb-2 pt-5 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">
              Step 2 of 3: finding {want.phrase}
            </p>
            <h2 id={`${ids}-title`} className="mt-0.5 font-display text-2xl font-bold tracking-tight">
              What do you love?
            </h2>
            <p id={`${ids}-desc`} className="mt-1 text-sm text-muted">
              Add a few {want.phrase} you love. Other favorites, like music or shows, help too.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-muted hover:bg-paper hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2 sm:px-6">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-paper p-1.5 focus-within:border-forest">
            {loves.map((l) => (
              <FavoriteChip
                key={l.id ?? l.name}
                f={l}
                onRemove={() => {
                  onChange({ ...form, loves: loves.filter((x) => x !== l) });
                  input.current?.focus();
                }}
              />
            ))}
            <input
              ref={input}
              role="combobox"
              aria-labelledby={`${ids}-title`}
              aria-expanded={showList}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={highlight >= 0 ? `${listId}-${highlight}` : undefined}
              autoComplete="off"
              value={draft}
              onChange={(e) => (e.target.value.endsWith(",") ? add({ name: e.target.value }) : setDraft(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && suggestions.length) {
                  e.preventDefault();
                  setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
                } else if (e.key === "ArrowUp" && suggestions.length) {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, -1));
                } else if (e.key === "Escape" && showList) {
                  // close the suggestions, not the dialog
                  e.stopPropagation();
                  setSuggestions([]);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (highlight >= 0 && suggestions[highlight]) add(suggestions[highlight]);
                  else if (pending) add({ name: pending });
                  else submit();
                } else if (e.key === "Backspace" && !draft && loves.length) {
                  onChange({ ...form, loves: loves.slice(0, -1) });
                }
              }}
              placeholder={loves.length ? "Add another" : `Start typing, e.g. ${want.popular[0]}`}
              className="min-h-10 min-w-36 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted focus-visible:outline-none"
            />
          </div>

          {showList && (
            <ul id={listId} role="listbox" aria-label="Suggestions from Qloo" className="mt-1.5 rounded-xl border border-line py-1">
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
                  className={`flex min-h-11 cursor-pointer items-center gap-2.5 px-2.5 py-1.5 ${i === highlight ? "bg-paper" : ""}`}
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

          {loves.length === 0 && !showList && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">Popular:</span>
              {want.popular.map((name): Favorite => KNOWN_IDS[name] ?? { name }).map((s) => (
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

          {want.place && (
            <div className="mt-4">
              <label htmlFor={`${ids}-where`} className="block text-sm font-medium">
                Where? <span className="font-normal text-muted">City or neighborhood, optional</span>
              </label>
              <input
                id={`${ids}-where`}
                value={where}
                onChange={(e) => onChange({ ...form, where: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="e.g. Lisbon"
                className="mt-1.5 min-h-10 w-full rounded-xl border border-line bg-paper px-3 text-base outline-none placeholder:text-muted focus:border-forest focus-visible:outline-none"
              />
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-5 py-4 sm:px-6">
          <button
            ref={find}
            type="button"
            onClick={submit}
            disabled={!ready}
            className="min-h-11 w-full rounded-xl bg-forest px-6 font-medium text-forest-ink disabled:opacity-35 sm:w-auto"
          >
            {busy ? "Finding matches…" : "Find my matches"}
          </button>
          <p aria-live="polite" className="text-sm text-muted">
            {busy ? "" : hintFor(want, all.length)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function TasteBuilder({
  form,
  onChange,
  onSubmit,
  busy,
  picking,
  onPicking,
}: {
  form: TasteForm;
  onChange: (f: TasteForm) => void;
  onSubmit: (s: Search) => void;
  busy: boolean;
  /** Whether the favorites dialog is open; kept by the page so the example can open it. */
  picking: boolean;
  onPicking: (open: boolean) => void;
}) {
  const ids = useId();
  const want = CATEGORIES.find((c) => c.key === form.want) ?? null;
  const { loves } = form;
  const ready = !!want && loves.length > 0 && !busy;

  const s1: StepState = want ? "done" : "current";
  const s2: StepState = loves.length ? "done" : want ? "current" : "todo";
  const s3: StepState = want && loves.length ? "current" : "todo";

  function choose(c: Category) {
    onChange({ ...form, want: c.key, where: c.place ? form.where : "" });
    onPicking(true);
  }

  return (
    <>
      <ol>
        <Step n={1} state={s1} title="What should we find?" titleId={`${ids}-s1`}>
          <div role="group" aria-labelledby={`${ids}-s1`} className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const on = form.want === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => choose(c)}
                  className={`flex min-h-9 items-center rounded-full border px-3.5 text-sm ${
                    on ? "border-forest bg-forest text-forest-ink" : "border-line hover:border-forest"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </Step>

        <Step n={2} state={s2} title="What do you love?" titleId={`${ids}-s2`}>
          {loves.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {loves.map((l) => (
                <FavoriteChip key={l.id ?? l.name} f={l} />
              ))}
              {want?.place && form.where.trim() && <span className="text-sm text-muted">in {form.where.trim()}</span>}
              <button
                type="button"
                onClick={() => onPicking(true)}
                className="min-h-9 rounded-lg px-2 text-sm font-medium text-forest underline underline-offset-4 hover:text-ink"
              >
                Edit
              </button>
            </div>
          ) : want ? (
            <button
              type="button"
              onClick={() => onPicking(true)}
              className="min-h-10 rounded-xl border border-dashed border-forest px-4 text-sm font-medium text-forest hover:bg-paper"
            >
              <span aria-hidden="true">+ </span>Add things you love
            </button>
          ) : (
            <p className="text-sm text-muted">Pick a category first.</p>
          )}
        </Step>

        <Step n={3} state={s3} title="Get your matches" titleId={`${ids}-s3`} last>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={() => want && onSubmit(buildSearch(want, loves, form.where))}
              disabled={!ready}
              className="min-h-11 w-full rounded-xl bg-forest px-6 font-medium text-forest-ink disabled:opacity-35 sm:w-auto"
            >
              {busy ? "Finding matches…" : "Find my matches"}
            </button>
            <p className="text-sm text-muted">{busy ? "" : hintFor(want, loves.length)}</p>
          </div>
        </Step>
      </ol>

      {picking && want && (
        <FavoritesDialog
          want={want}
          form={form}
          onChange={onChange}
          onClose={() => onPicking(false)}
          onSubmit={onSubmit}
          busy={busy}
        />
      )}
    </>
  );
}
