"use client";

import { useEffect, useRef, useState } from "react";
import type { EntityCard } from "@/lib/qloo";
import { CATEGORIES, TYPE_LABEL, TYPE_PLURAL, franchise } from "@/lib/categories";

export function pct(e: EntityCard) {
  return e.affinity !== undefined ? Math.round(e.affinity * 100) : undefined;
}

const SHARE_COLORS = ["var(--forest)", "var(--marigold)", "#7c6cf0", "#3b9bd9"];

/**
 * Qloo explainability: each favorite's share in this match, when two or more different favorites drove
 * it. Seeds from one franchise (Digimon Adventure, Digimon Adventure 02) are one taste, so no split.
 */
function balance(e: EntityCard, seeds: EntityCard[]) {
  if (new Set(seeds.map((s) => franchise(s.name) ?? s.name)).size < 2) return [];
  const parts = seeds
    .map((s) => ({ name: s.name, score: e.explain?.find((x) => x.id === s.id)?.score ?? 0 }))
    .filter((x) => x.score > 0);
  const total = parts.reduce((t, x) => t + x.score, 0);
  return parts.length >= 2 ? parts.map((x, i) => ({ ...x, pct: Math.round((x.score / total) * 100), color: SHARE_COLORS[i % 4] })) : [];
}

function BalanceBar({ e, seeds }: { e: EntityCard; seeds: EntityCard[] }) {
  const parts = balance(e, seeds);
  if (!parts.length) return null;
  const label = parts.map((x) => `${x.name} ${x.pct}%`).join(", ");
  return (
    <span className="mt-2 block" role="img" aria-label={`Fits your favorites: ${label}`} title={`Fits your favorites: ${label}`}>
      <span className="flex h-1.5 overflow-hidden rounded-full bg-line">
        {parts.map((x) => (
          <span key={x.name} style={{ width: `${x.pct}%`, background: x.color }} />
        ))}
      </span>
      <span className="mt-1 flex justify-between gap-2 text-[11px] leading-tight text-muted">
        {parts.slice(0, 2).map((x) => (
          <span key={x.name} className="truncate">
            {x.name} {x.pct}%
          </span>
        ))}
      </span>
    </span>
  );
}

/** "What you have in common": tastes Qloo finds in both favorites. */
export function CommonGround({ a, b }: { a: string; b: string }) {
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/common?a=${a}&b=${b}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setTags(body?.tags ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [a, b]);
  if (!tags.length) return null;
  return (
    <div className="rise flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-muted">In common</span>
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-mint px-2.5 py-0.5 font-medium text-forest">
          {t}
        </span>
      ))}
    </div>
  );
}

const TINTS = ["var(--tint-rose)", "var(--tint-lilac)", "var(--tint-peach)", "var(--tint-sky)", "var(--tint-lime)"];

function Thumb({ e, className }: { e: EntityCard; className: string }) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (e.image && !broken) {
    // Shimmer until the picture arrives, then fade it in; a failed image falls back to the name tile.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={e.image}
        alt=""
        loading="lazy"
        ref={(img) => {
          if (img?.complete && img.naturalWidth && !loaded) setLoaded(true);
        }}
        onLoad={() => setLoaded(true)}
        onError={() => setBroken(true)}
        className={`object-cover ${loaded ? "fade-in" : "skeleton"} ${className}`}
      />
    );
  }
  return (
    <span
      className={`flex items-center justify-center p-3 text-center font-display font-bold leading-tight text-ink/70 ${className}`}
      style={{ background: TINTS[e.name.length % TINTS.length] }}
    >
      {e.name}
    </span>
  );
}

function MatchPill({ p, className = "" }: { p: number; className?: string }) {
  return (
    <span className={`rounded-full bg-forest px-2.5 py-1 text-xs font-semibold tabular-nums text-forest-ink ${className}`}>
      {p}% match
    </span>
  );
}

/** Ranked match: poster, Qloo affinity, year, tags and the agent's one-line reason. */
export function PosterCard({
  e,
  reason,
  seeds = [],
  onOpen,
  i = 0,
}: {
  e: EntityCard;
  reason?: string;
  seeds?: EntityCard[];
  onOpen: () => void;
  i?: number;
}) {
  const p = pct(e);
  return (
    <button type="button" onClick={onOpen} className="rise group block w-full text-left" style={{ ["--i" as string]: i }}>
      <span className="relative block overflow-hidden rounded-2xl bg-line shadow-[0_14px_30px_-20px_rgba(13,20,36,0.6)]">
        <Thumb e={e} className="aspect-[3/4] w-full text-lg transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-105" />
        {p !== undefined && <MatchPill p={p} className="absolute bottom-2.5 left-2.5 shadow-md" />}
      </span>
      <span className="mt-3 block font-display font-semibold leading-snug group-hover:text-forest">{e.name}</span>
      <span className="block text-sm text-muted">{e.year ?? (e.city ? `${TYPE_LABEL[e.type] ?? e.type}, ${e.city}` : TYPE_LABEL[e.type] ?? e.type)}</span>
      {e.tags.length > 0 && (
        <span className="mt-2 flex flex-wrap gap-1">
          {e.tags.slice(0, 2).map((t) => (
            <span key={t} className="rounded-full bg-paper px-2 py-0.5 text-xs text-muted ring-1 ring-line">
              {t}
            </span>
          ))}
        </span>
      )}
      <BalanceBar e={e} seeds={seeds} />
      {reason && <span className="mt-2 line-clamp-2 block text-sm leading-snug text-muted">{reason}</span>}
    </button>
  );
}

function Arrow({ dir, disabled, onClick }: { dir: -1 | 1; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir < 0 ? "Previous matches" : "Next matches"}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-surface ring-1 ring-line transition-colors hover:text-forest hover:ring-forest disabled:opacity-35 disabled:hover:text-ink disabled:hover:ring-line"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir < 0 ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}

/**
 * One row of cards that scrolls sideways: swipe on phones, arrow buttons beside the title elsewhere.
 * Shows 2 cards (plus a peek) on phones, 3 on tablets and 5 on wide screens.
 */
export function Carousel({ title, meta, children }: { title: string; meta?: React.ReactNode; children: React.ReactNode[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  function update() {
    const el = track.current;
    if (el) setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }
  useEffect(() => {
    update();
    const ro = new ResizeObserver(update);
    if (track.current) ro.observe(track.current);
    return () => ro.disconnect();
  }, [children.length]);

  const page = (dir: -1 | 1) => track.current?.scrollBy({ left: dir * track.current.clientWidth, behavior: "smooth" });

  return (
    <section aria-label={title}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
          {meta && <span className="text-sm text-muted">{meta}</span>}
        </div>
        {!(edge.start && edge.end) && (
          <div className="hidden shrink-0 gap-2 sm:flex">
            <Arrow dir={-1} disabled={edge.start} onClick={() => page(-1)} />
            <Arrow dir={1} disabled={edge.end} onClick={() => page(1)} />
          </div>
        )}
      </div>
      <ul
        ref={track}
        onScroll={update}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0"
      >
        {children.map((child, i) => (
          <li key={i} className="w-[42%] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-4rem)/5)]">
            {child}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PosterSkeleton({ i = 0 }: { i?: number }) {
  return (
    <div className="rise" style={{ ["--i" as string]: i }} aria-hidden="true">
      <div className="skeleton aspect-[3/4] rounded-2xl" />
      <div className="skeleton mt-3 h-4 w-3/4 rounded" />
      <div className="skeleton mt-2 h-3 w-1/3 rounded" />
    </div>
  );
}

/** Small card for rows of extra picks. */
function MiniCard({ e, onOpen, round, i }: { e: EntityCard; onOpen: () => void; round: boolean; i: number }) {
  const p = pct(e);
  return (
    <li className="min-w-0">
      <button type="button" onClick={onOpen} className="rise group block w-full text-left" style={{ ["--i" as string]: i }}>
        <span className="block overflow-hidden rounded-2xl">
          <Thumb
            e={e}
            className={`w-full text-sm transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-105 ${round ? "aspect-square rounded-full" : "aspect-[3/4]"}`}
          />
        </span>
        <span className="mt-2 block truncate text-sm font-semibold group-hover:text-forest">{e.name}</span>
        {p !== undefined && <span className="block text-xs font-medium text-forest">{p}% match</span>}
      </button>
    </li>
  );
}

/** Direct Qloo Insights call (no LLM), for cross-category and "more like this" rows. */
function useInsights(type: string | undefined, ids: string[]) {
  const key = type && ids.length ? `${type}|${ids.join(",")}` : "";
  const [state, setState] = useState<{ key: string; items: EntityCard[]; failed: boolean }>({ key: "", items: [], failed: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!key) return;
    const [t, list] = key.split("|");
    const ctrl = new AbortController();
    const load = () => fetch(`/api/explore?type=${t}&ids=${list}`, { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : Promise.reject(r)));
    // One quiet retry covers a rate limit or a network blip before showing an error.
    load()
      .catch(() => new Promise((r) => setTimeout(r, 1500)).then(load))
      .then((b) => setState({ key, items: b.results ?? [], failed: false }))
      .catch(() => !ctrl.signal.aborted && setState({ key, items: [], failed: true }));
    return () => ctrl.abort();
  }, [key, attempt]);

  const ready = state.key === key;
  const retry = () => {
    setState({ key: "", items: [], failed: false });
    setAttempt((n) => n + 1);
  };
  return { items: ready ? state.items : [], loading: !!key && !ready, failed: ready && state.failed, retry };
}

function Row({ type, ids, onOpen }: { type: string; ids: string[]; onOpen: (e: EntityCard) => void }) {
  const { items, loading, failed, retry } = useInsights(type, ids);
  const round = type === "artist" || type === "person";
  if (failed)
    return (
      <p role="alert" className="flex items-center gap-3 py-6 text-sm text-muted">
        These picks didn&apos;t load.
        <button type="button" onClick={retry} className="rounded-full bg-paper px-3.5 py-1.5 font-semibold text-forest ring-1 ring-line hover:ring-forest">
          Try again
        </button>
      </p>
    );
  if (!loading && items.length === 0) return <p className="py-6 text-sm text-muted">No matches in this category yet.</p>;
  return (
    <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-8" aria-busy={loading}>
      {loading
        ? Array.from({ length: 8 }, (_, i) => (
            <li key={i} aria-hidden="true">
              <div className={`skeleton ${round ? "aspect-square rounded-full" : "aspect-[3/4] rounded-2xl"}`} />
              <div className="skeleton mt-2 h-3.5 w-3/4 rounded" />
            </li>
          ))
        : items.map((e, i) => <MiniCard key={e.id} e={e} i={i} round={round} onOpen={() => onOpen(e)} />)}
    </ul>
  );
}

/** Screen 6: the same taste, carried into other categories. */
export function ExploreBeyond({ ids, current, onOpen }: { ids: string[]; current?: string; onOpen: (e: EntityCard) => void }) {
  const tabs = CATEGORIES.filter((c) => !c.place);
  const [tab, setTab] = useState(() => (tabs.find((c) => c.type !== current) ?? tabs[0]).key);
  const active = tabs.find((c) => c.key === tab)!;

  return (
    <section aria-labelledby="explore-h" className="rounded-3xl border border-line bg-surface p-5 sm:p-7">
      <h2 id="explore-h" className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        Explore beyond {current ? TYPE_PLURAL[current] ?? "this" : "this"}
      </h2>
      <p className="mt-1 text-muted">The same blended taste, carried into other categories by Qloo&apos;s taste graph.</p>
      <div role="tablist" aria-label="Categories" className="mt-5 flex flex-wrap gap-2">
        {tabs.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={tab === c.key}
            onClick={() => setTab(c.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === c.key ? "bg-forest text-forest-ink" : "bg-paper ring-1 ring-line hover:ring-forest"
            }`}
          >
            <span aria-hidden="true">{c.emoji}</span>
            {c.label}
          </button>
        ))}
      </div>
      <h3 className="mb-3 mt-6 font-display text-lg font-semibold">{active.label} picks for you</h3>
      <div role="tabpanel">
        <Row key={tab} type={active.type} ids={ids} onOpen={onOpen} />
      </div>
    </section>
  );
}

function externalAction(e: EntityCard) {
  const q = encodeURIComponent;
  switch (e.type) {
    case "movie":
    case "tv_show":
      return { label: "Watch trailer", href: `https://www.youtube.com/results?search_query=${q(`${e.name} ${e.year ?? ""} trailer`)}` };
    case "artist":
    case "podcast":
      return { label: "Listen on Spotify", href: `https://open.spotify.com/search/${q(e.name)}` };
    case "book":
      return { label: "Find the book", href: `https://www.google.com/search?tbm=bks&q=${q(e.name)}` };
    case "place":
    case "destination": {
      // Exact place when Qloo has its Google place ID, else its coordinates, else name and address.
      const query = e.placeId || e.lat === undefined ? [e.name, e.address ?? e.city].filter(Boolean).join(", ") : `${e.lat},${e.lon}`;
      const exact = e.placeId ? `&query_place_id=${q(e.placeId)}` : "";
      return { label: "Open in Google Maps", href: `https://www.google.com/maps/search/?api=1&query=${q(query)}${exact}` };
    }
    default:
      return { label: "Search the web", href: `https://www.google.com/search?q=${q(e.name)}` };
  }
}

/** Long descriptions start folded to four lines. */
function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 280;
  return (
    <div className="mt-5 max-w-prose">
      <p className={`text-[17px] leading-relaxed ${long && !open ? "line-clamp-4" : ""}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-1 text-sm font-semibold text-forest hover:underline">
          {open ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}

function Check() {
  return (
    <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-bold text-forest">
      ✓
    </span>
  );
}

/** Screen 4: one match, why it fits, and more like it. */
export function MatchDetail({
  e,
  reason,
  seeds,
  onBack,
  onOpen,
  onAsk,
}: {
  e: EntityCard;
  reason?: string;
  seeds: EntityCard[];
  onBack: () => void;
  onOpen: (e: EntityCard) => void;
  onAsk: (text: string) => void;
}) {
  const back = useRef<HTMLButtonElement>(null);
  const p = pct(e);
  const action = externalAction(e);
  const pop = e.popularity !== undefined ? Math.round(e.popularity * 100) : undefined;

  const backRef = useRef(onBack);
  backRef.current = onBack;

  // Fresh page per entity; Escape goes back.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    back.current?.focus({ preventScroll: true });
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && backRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [e.id]);

  const why = [
    reason,
    seeds.length > 0 && `Picked from the favorites you shared: ${seeds.map((s) => s.name).join(", ")}`,
    p !== undefined && `${p}% taste affinity in Qloo's graph`,
    balance(e, seeds).length > 0 &&
      `Balanced across your favorites: ${balance(e, seeds).map((x) => `${x.name} ${x.pct}%`).join(", ")}`,
    e.tags.length > 0 && `Shares themes like ${e.tags.slice(0, 3).join(", ")}`,
    pop !== undefined && (pop >= 90 ? `A crowd favourite: more popular than ${pop}% of Qloo ${TYPE_PLURAL[e.type] ?? "entities"}` : pop < 50 ? "A lesser-known pick, off the beaten path" : null),
  ].filter(Boolean) as string[];

  return (
    <article key={e.id} className="mx-auto w-full max-w-6xl px-4 pb-16 pt-5 sm:px-6">
      <button ref={back} type="button" onClick={onBack} className="rounded-full px-2 py-1 text-sm font-medium text-muted hover:text-forest">
        ← Back to results
      </button>

      <div className="mt-4 grid gap-8 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        <div className="rise mx-auto h-fit w-full max-w-[260px] self-start overflow-hidden rounded-3xl md:max-w-none shadow-[0_30px_60px_-30px_rgba(13,20,36,0.6)]">
          <Thumb e={e} className="aspect-[3/4] w-full text-3xl" />
        </div>

        <div className="rise min-w-0" style={{ ["--i" as string]: 1 }}>
          <p className="text-sm font-medium uppercase tracking-wider text-forest">{TYPE_LABEL[e.type] ?? e.type}</p>
          <h1 className="mt-1 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">{e.name}</h1>
          <p className="mt-2 text-muted">{[e.year, e.city, e.address && e.address !== e.city ? e.address : null].filter(Boolean).join(" · ")}</p>
          {e.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Qloo tags">
              {e.tags.slice(0, 6).map((t) => (
                <li key={t} className="rounded-full bg-surface px-3 py-1 text-sm text-muted ring-1 ring-line">
                  {t}
                </li>
              ))}
            </ul>
          )}
          {p !== undefined && <MatchPill p={p} className="mt-5 inline-block px-3.5 py-1.5 text-sm" />}
          {e.description && <Description key={e.id} text={e.description} />}
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href={action.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-forest px-6 py-3 font-semibold text-forest-ink shadow-[0_10px_24px_-10px_var(--forest)] transition-transform duration-300 ease-[var(--ease-out)] hover:scale-[1.03]"
            >
              {action.label} ↗
            </a>
            <button
              type="button"
              onClick={() => onAsk(`More like ${e.name}`)}
              className="rounded-full border border-line bg-surface px-6 py-3 font-semibold transition-colors hover:border-forest hover:text-forest"
            >
              More like this
            </button>
          </div>
        </div>

        <aside className="rise h-fit rounded-3xl bg-surface p-6 ring-1 ring-line md:col-span-2 lg:col-span-1" style={{ ["--i" as string]: 2 }}>
          <h2 className="font-display text-lg font-semibold">Why this matches you</h2>
          <ul className="mt-4 space-y-3.5">
            {why.map((w) => (
              <li key={w} className="flex gap-3 text-[15px] leading-snug">
                <Check />
                {w}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {TYPE_PLURAL[e.type] && (
      <section className="mt-14" aria-labelledby="also-h">
        <h2 id="also-h" className="mb-4 font-display text-2xl font-bold tracking-tight">
          You might also like
        </h2>
        <Row type={e.type} ids={[e.id]} onOpen={onOpen} />
      </section>
      )}
    </article>
  );
}
