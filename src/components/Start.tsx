"use client";

import { useEffect, useRef, useState } from "react";
import type { EntityCard } from "@/lib/qloo";
import { CATEGORIES, qlooImage, type Category } from "@/lib/categories";
import { readMessage } from "@/lib/message";
import { Composer } from "@/components/Composer";

/** Direct Qloo query the page runs while the agent works, so matches show in about a second. */
export interface Quick {
  type: string;
  ids: string[];
  location?: string;
  tag?: string;
  /** Favorites resolved from the message, shown as the taste profile right away. */
  seeds?: EntityCard[];
}

type Ask = (text: string, content?: string, known?: EntityCard[], quick?: Quick | Promise<Quick | undefined>) => void;

const fav = (name: string, id: string, type: string): EntityCard => ({ id, name, type, image: qlooImage(id), tags: [] });
const OPPENHEIMER = fav("Oppenheimer", "470553FA-42AD-435D-94BE-1078AFD6A2FD", "movie");
const BARBIE = fav("Barbie", "BAF6FB9E-7E2E-4008-944B-97C0CF430D41", "movie");
const OFFICE = fav("The Office", "E5AE1F26-04CB-4CDD-BBA4-87FB6541F848", "tv_show");
const TAYLOR = fav("Taylor Swift", "4BBEF799-A0C4-4110-AB01-39216993C312", "artist");
const BREAKING_BAD = fav("Breaking Bad", "D03D0913-A7B9-4C46-BFEB-958C1B3FA387", "tv_show");
const SCHITTS = fav("Schitt's Creek", "93804FA5-8089-488B-AE2C-C26D9E4F58DB", "tv_show");
const DRAKE = fav("Drake", "FAA55DC8-6030-4CC8-9BA6-4668295C3FA7", "artist");
const WALLEN = fav("Morgan Wallen", "59DCDFA8-5082-47D9-B3E5-2B49CF2A778F", "artist");
const RESTAURANT = CATEGORIES.find((c) => c.place)!.tag;

const SUGGESTIONS = [
  {
    emoji: "🍿",
    title: "Movie night for two",
    text: "I love Oppenheimer and my partner loves Barbie. What should we watch tonight?",
    seeds: [OPPENHEIMER, BARBIE],
    quick: { type: "movie" },
  },
  {
    emoji: "🍜",
    title: "Date night dinner in New York",
    text: "I love The Office and my partner loves Taylor Swift. Where should we eat in New York?",
    seeds: [OFFICE, TAYLOR],
    quick: { type: "place", location: "New York", tag: RESTAURANT },
  },
  {
    emoji: "📺",
    title: "A show to binge together",
    text: "I love Breaking Bad and my partner loves Schitt's Creek. What show should we binge together?",
    seeds: [BREAKING_BAD, SCHITTS],
    quick: { type: "tv_show" },
  },
  {
    emoji: "🚗",
    title: "Road trip music for friends",
    text: "I love Drake and my friend loves Morgan Wallen. Which artists would we both like?",
    seeds: [DRAKE, WALLEN],
    quick: { type: "artist" },
  },
];

/**
 * Best-effort read of a typed message into a direct Qloo query. If any part is unclear it
 * returns nothing and the agent alone answers.
 */
async function quickFromText(text: string, picked?: Category | null): Promise<Quick | undefined> {
  const { names, want, location } = readMessage(text, picked);
  if (!names.length || !want || (want.place && !location)) return;
  const hits = await Promise.all(
    names.map((n) =>
      fetch(`/api/search?q=${encodeURIComponent(n)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => b?.results?.[0] as EntityCard | undefined)
        .catch(() => undefined),
    ),
  );
  const seeds = hits.filter((h): h is EntityCard => !!h).map((h) => ({ ...h, tags: [] }));
  return seeds.length ? { type: want.type, ids: seeds.map((s) => s.id), location, tag: want.tag, seeds } : undefined;
}

const EXAMPLES = [
  "I love Oppenheimer, my partner loves Barbie. What to watch?",
  "I love Drake, my friend loves Morgan Wallen. Road trip music?",
  "We love The Office. Where should we eat in Toronto?",
  "I loved Atomic Habits. Which podcasts would I like?",
];

// For returning users: a next question built from a favorite in an earlier chat.
const NEXT: Record<string, [string, string]> = {
  movie: ["What should I watch next?", "movie"],
  tv_show: ["Which TV shows would I like?", "tv_show"],
  artist: ["Which artists would I like?", "artist"],
  book: ["What should I read next?", "book"],
  podcast: ["Which podcasts would I like?", "podcast"],
};

/** ChatGPT-style start: one box to type in, a few ready-made questions, and picks from past chats. */
export function Start({
  busy,
  onAsk,
  past = [],
  onAuth,
}: {
  busy: boolean;
  onAsk: Ask;
  past?: EntityCard[];
  /** Set when signed out: opens log in or sign up. */
  onAuth?: (mode: "signin" | "signup") => void;
}) {
  const seen = new Set<string>();
  const forYou = past.filter((e) => NEXT[e.type] && !seen.has(e.id) && !!seen.add(e.id)).slice(0, 3);
  const [input, setInput] = useState("");
  const [example, setExample] = useState(0);
  const [want, setWant] = useState<Category | null>(null);
  const [city, setCity] = useState("");
  const [needCity, setNeedCity] = useState(false);
  const cityInput = useRef<HTMLInputElement>(null);

  /** The picked category (and city, for food) is added to the message, so the agent and the bubble both show it. */
  function send(typed: string) {
    const place = city.trim();
    if (want?.place && !place && !/\bin\s+[A-Z]/.test(typed)) {
      setNeedCity(true);
      cityInput.current?.focus();
      return;
    }
    const base = /[.?!]$/.test(typed.trim()) ? typed.trim() : `${typed.trim()}.`;
    const text = want ? `${base} Show me ${want.phrase}${want.place && place ? ` in ${place}` : ""}.` : base;
    onAsk(text, undefined, [], quickFromText(text, want));
  }

  // Cycle the example in the empty box to show what kinds of questions work.
  useEffect(() => {
    if (input) return;
    const timer = setInterval(() => setExample((i) => (i + 1) % EXAMPLES.length), 3500);
    return () => clearInterval(timer);
  }, [input]);

  useEffect(() => {
    // Desktop only: on phones this would pop the keyboard over the page.
    if (matchMedia("(pointer: fine)").matches) document.getElementById("ask")?.focus();
  }, []);

  return (
    <main id="main" className="mx-auto flex min-h-[calc(100dvh-61px)] w-full max-w-3xl flex-col justify-center px-4 pb-16 pt-8 sm:px-6">
      <h1 className="rise text-center font-display text-[clamp(2rem,5.5vw,3rem)] font-bold leading-tight tracking-tight">
        Find what you&apos;ll <span className="text-forest">both</span> love.
      </h1>
      <p className="rise mx-auto mt-3 max-w-xl text-center text-lg text-muted" style={{ ["--i" as string]: 1 }}>
        Different tastes? Tell me what each of you likes. I&apos;ll find movies, shows, music, food and trips you&apos;ll
        all enjoy.
      </p>

      <div className="rise mt-8" style={{ ["--i" as string]: 2 }}>
        <Composer
          id="ask"
          roomy
          value={input}
          onChange={setInput}
          busy={busy}
          onSend={send}
          placeholder={`e.g. ${EXAMPLES[example]}`}
          label="Tell me what you and others love, and what you want"
        />
      </div>

      <div className="rise mt-4" style={{ ["--i" as string]: 3 }}>
        <p id="find-label" className="text-center text-sm text-muted">
          What should I find? <span className="text-muted/80">(optional)</span>
        </p>
        <div role="radiogroup" aria-labelledby="find-label" className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
          {[null, ...CATEGORIES].map((c) => {
            const on = (want?.key ?? null) === (c?.key ?? null);
            return (
              <button
                key={c?.key ?? "any"}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setWant(c);
                  setNeedCity(false);
                }}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  on ? "bg-forest text-forest-ink" : "bg-surface ring-1 ring-line hover:text-forest hover:ring-forest"
                }`}
              >
                <span aria-hidden="true">{c?.emoji ?? "✨"}</span>
                {c?.label ?? "Anything"}
              </button>
            );
          })}
        </div>
        {want?.place && (
          <div className="mx-auto mt-3 max-w-sm">
            <label htmlFor="city" className="sr-only">
              Which city?
            </label>
            <input
              ref={cityInput}
              id="city"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setNeedCity(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && input.trim() && send(input)}
              placeholder="Which city? e.g. Toronto, New York"
              aria-describedby={needCity ? "city-nudge" : undefined}
              className={`w-full rounded-full border bg-surface px-5 py-2.5 text-center outline-none placeholder:text-muted focus:border-forest focus-visible:outline-none ${
                needCity ? "border-red-400" : "border-line"
              }`}
            />
            {needCity && (
              <p id="city-nudge" role="alert" className="mt-1.5 text-center text-sm font-medium text-red-700">
                Add a city for restaurant picks.
              </p>
            )}
          </div>
        )}
        <p className="mt-3 text-center text-sm text-muted">Just you? Tell me one thing you love, that works too.</p>
      </div>

      {forYou.length > 0 && (
        <section aria-labelledby="for-you" className="rise mt-7" style={{ ["--i" as string]: 4 }}>
          <h2 id="for-you" className="text-sm font-semibold">
            Picked up from your past searches
          </h2>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {forYou.map((e) => {
              const [ask, type] = NEXT[e.type];
              return (
                <button
                  key={e.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onAsk(`I love ${e.name}. ${ask}`, `I love ${e.name} [${e.id}]. ${ask}`, [e], { type, ids: [e.id] })}
                  className="flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-4 text-sm ring-1 ring-line transition-colors hover:text-forest hover:ring-forest disabled:opacity-50"
                >
                  {e.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.image} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="w-2" />
                  )}
                  More like {e.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <ul className="no-scrollbar -mx-4 mt-6 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0">
        {SUGGESTIONS.map((s, i) => (
          <li key={s.title} className="rise w-[80%] shrink-0 snap-start sm:w-auto" style={{ ["--i" as string]: 4 + i }}>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onAsk(
                  s.text,
                  s.seeds.reduce((t, e) => t.replace(e.name, `${e.name} [${e.id}]`), s.text),
                  s.seeds,
                  { ...s.quick, ids: s.seeds.map((e) => e.id) },
                )
              }
              className="group flex h-full w-full items-start gap-3 rounded-2xl bg-surface p-4 text-left ring-1 ring-line transition-[box-shadow,transform] duration-300 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:ring-forest disabled:opacity-50"
            >
              <span aria-hidden="true" className="text-2xl transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-110">
                {s.emoji}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold group-hover:text-forest">{s.title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-muted">{s.text}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {onAuth && (
        <aside className="rise mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl bg-mint/60 px-5 py-4 text-center ring-1 ring-forest/15 sm:flex-row sm:text-left" style={{ ["--i" as string]: 9 }}>
          <p className="text-sm">
            <strong className="font-semibold text-forest">Free account, optional.</strong>{" "}
            <span className="text-muted">Save your chats and get picks based on what you searched before.</span>
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => onAuth("signin")}
              className="h-9 rounded-full border border-line bg-surface px-4 text-sm font-semibold transition-colors hover:border-forest hover:text-forest"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => onAuth("signup")}
              className="h-9 rounded-full bg-forest px-4 text-sm font-semibold text-forest-ink"
            >
              Sign up free
            </button>
          </div>
        </aside>
      )}
    </main>
  );
}
