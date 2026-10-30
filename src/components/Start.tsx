"use client";

import { useEffect, useState } from "react";
import type { EntityCard } from "@/lib/qloo";
import { CATEGORIES, cleanQuery, qlooImage } from "@/lib/categories";
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

// What they want, read from the message. Order matters: "where should we eat" beats "watch".
const WANTS: [RegExp, string][] = [
  [/\b(restaurants?|eat|food|dinner|lunch|brunch|caf[eé]s?)\b/i, "food"],
  [/\bpodcasts?\b/i, "podcasts"],
  [/\b(books?|read|novels?)\b/i, "books"],
  [/\b(tv|shows?|series|binge)\b/i, "tv"],
  [/\b(movies?|films?|watch)\b/i, "movies"],
  [/\b(music|artists?|singers?|bands?|songs?|listen|playlist)\b/i, "music"],
  [/\b(travel|trip|visit|destinations?|vacation|holiday)\b/i, "travel"],
  [/\b(brands?|shop|shopping|wear|clothes)\b/i, "brands"],
];
// Each "loves X" in the message, for one person or several: "I love X and my partner loves Y".
const FAVORITES =
  /\b(?:loves?|loved|likes?|liked|enjoys?|enjoyed|adores?|fan of|into|similar to|such as)\s+(.+?)(?=[.?!;]|,?\s+(?:what|which|where|so|recommend|suggest|find|give|show me)\b|$)/gi;

/**
 * Best-effort read of a typed message into a direct Qloo query. If any part is unclear it
 * returns nothing and the agent alone answers.
 */
async function quickFromText(text: string): Promise<Quick | undefined> {
  const found = [...text.matchAll(FAVORITES)].map((m) => m[1]);
  if (!found.length) return;
  const rest = found.reduce((t, f) => t.replace(f, " "), text);
  const want = CATEGORIES.find((c) => c.key === WANTS.find(([re]) => re.test(rest))?.[1]);
  if (!want) return;
  const location = want.place ? text.match(/\bin\s+([A-Z][\w.' -]{1,40}?)\s*[?.!]*$/)?.[1] : undefined;
  if (want.place && !location) return;

  const names = [...new Set(found.flatMap((f) => f.split(/\s+and\s+|\s*&\s*|,\s*/)).map(cleanQuery).filter(Boolean))].slice(0, 4);
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
  "I love Oppenheimer, my partner loves Barbie. What should we watch?",
  "I love Drake and my friend loves Morgan Wallen. Road trip music?",
  "We both love The Office. Where should we eat in Toronto?",
  "I loved Atomic Habits. Which podcasts would I like?",
];

/** ChatGPT-style start: one box to type in, a few ready-made questions. */
export function Start({ busy, onAsk }: { busy: boolean; onAsk: Ask }) {
  const [input, setInput] = useState("");
  const [example, setExample] = useState(0);

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
    <main id="main" className="mx-auto flex min-h-[calc(100dvh-65px)] w-full max-w-3xl flex-col justify-center px-4 pb-16 pt-8 sm:px-6">
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
          value={input}
          onChange={setInput}
          busy={busy}
          onSend={(t) => onAsk(t, undefined, [], quickFromText(t))}
          placeholder={`e.g. ${EXAMPLES[example]}`}
          label="Tell me what you and others love, and what you want"
        />
        <p className="mt-2 text-center text-sm text-muted">Just you? Tell me one thing you love, that works too.</p>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((s, i) => (
          <li key={s.title} className="rise" style={{ ["--i" as string]: 3 + i }}>
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
    </main>
  );
}
