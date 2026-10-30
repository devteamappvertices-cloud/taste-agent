"use client";

import type { EntityCard } from "@/lib/qloo";
import { Carousel, PosterCard, PosterSkeleton, useInsights } from "@/components/Matches";

type Ask = (text: string, content?: string, known?: EntityCard[], quick?: { type: string; ids: string[] }) => void;

// What each kind of search is called, and how to ask for it.
const KINDS: Record<string, { emoji: string; noun: string; ask: string; more: string }> = {
  movie: { emoji: "🍿", noun: "Movies", ask: "What movies would I like?", more: "What should I watch next?" },
  tv_show: { emoji: "📺", noun: "TV shows", ask: "Which TV shows would I like?", more: "Which TV shows would I like next?" },
  artist: { emoji: "🎧", noun: "Music", ask: "Which artists would I like?", more: "Which artists would I like next?" },
  book: { emoji: "📚", noun: "Books", ask: "What books would I like?", more: "What should I read next?" },
  podcast: { emoji: "🎙️", noun: "Podcasts", ask: "Which podcasts would I like?", more: "Which podcasts would I like next?" },
  destination: { emoji: "🏝️", noun: "Trips", ask: "Where should I travel?", more: "Where should I travel next?" },
};
// Cross-category ideas, in the order they're suggested.
const CROSS = ["artist", "book", "destination", "tv_show", "movie", "podcast"];

/**
 * Returning users: Qloo picks for the taste in their favorites and past chats, plus new searches that carry
 * each favorite into other categories ("Music for Oppenheimer fans").
 */
export function ForYou({
  past,
  busy,
  onAsk,
  onOpen,
  savedIds,
  onSave,
}: {
  past: EntityCard[];
  busy: boolean;
  onAsk: Ask;
  onOpen: (e: EntityCard) => void;
  savedIds: Set<string>;
  onSave: (e: EntityCard) => void;
}) {
  const seen = new Set<string>();
  const seeds = past.filter((e) => KINDS[e.type] && !seen.has(e.id) && !!seen.add(e.id)).slice(0, 3);

  // Rank picks in the category they search most.
  const counts = new Map<string, number>();
  for (const s of seeds) counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
  const type = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const { items, loading } = useInsights(type, seeds.map((s) => s.id));

  const ideas = seeds.slice(0, 2).flatMap((s, i) => {
    const cross = CROSS.filter((t) => t !== s.type).slice(i * 2, i * 2 + 2);
    return [
      { seed: s, type: s.type, title: `More like ${s.name}`, ask: KINDS[s.type].more },
      ...cross.map((t) => ({ seed: s, type: t, title: `${KINDS[t].noun} for ${s.name} fans`, ask: KINDS[t].ask })),
    ];
  });

  if (!seeds.length) return null;
  const names = seeds.map((s) => s.name);
  const because = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];

  return (
    <div className="rise mt-10 space-y-8" style={{ ["--i" as string]: 4 }}>
      {(loading || items.length > 0) && (
        <Carousel title="Picked for you" meta={`Because you like ${because}`}>
          {loading
            ? Array.from({ length: 5 }, (_, i) => <PosterSkeleton key={i} i={i} />)
            : items.map((e, i) => (
                <PosterCard key={e.id} e={e} i={i} seeds={seeds} onOpen={() => onOpen(e)} saved={savedIds.has(e.id)} onSave={() => onSave(e)} />
              ))}
        </Carousel>
      )}

      <section aria-labelledby="try-new">
        <h2 id="try-new" className="font-display text-2xl font-bold tracking-tight">
          Try something new
        </h2>
        <p className="mt-1 text-sm text-muted">Your taste, carried into other categories by Qloo.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {ideas.map((idea) => (
            <li key={`${idea.seed.id}-${idea.type}`}>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  onAsk(`I love ${idea.seed.name}. ${idea.ask}`, `I love ${idea.seed.name} [${idea.seed.id}]. ${idea.ask}`, [idea.seed], {
                    type: idea.type,
                    ids: [idea.seed.id],
                  })
                }
                className="group flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left ring-1 ring-line transition-[box-shadow,transform] duration-300 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:ring-forest disabled:opacity-50"
              >
                <span className="relative shrink-0">
                  {idea.seed.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={idea.seed.image} alt="" className="h-12 w-12 rounded-xl bg-line object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-mint font-display font-bold text-forest">
                      {idea.seed.name.slice(0, 1)}
                    </span>
                  )}
                  <span aria-hidden="true" className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-sm shadow ring-1 ring-line">
                    {KINDS[idea.type].emoji}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold group-hover:text-forest">{idea.title}</span>
                  <span className="block truncate text-sm text-muted">{idea.ask}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
