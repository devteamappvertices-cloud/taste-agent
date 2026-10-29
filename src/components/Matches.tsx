"use client";

import { useRef, useState } from "react";
import type { EntityCard } from "@/lib/qloo";
import { useDialog } from "@/lib/useDialog";

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
};

function subtitle(e: EntityCard) {
  const kind = TYPE_LABEL[e.type] ?? e.type;
  return e.city ? `${kind} in ${e.city}` : kind;
}

export function pct(e: EntityCard) {
  return e.affinity !== undefined ? Math.round(e.affinity * 100) : undefined;
}

/** Entity image, or its initial when there is no image or it fails to load. */
export function Thumb({ e, className }: { e: Pick<EntityCard, "name" | "image">; className: string }) {
  const [failed, setFailed] = useState(false);
  return e.image && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={e.image} alt="" className={`object-cover ${className}`} loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <span className={`flex items-center justify-center bg-forest/10 font-display font-semibold text-forest ${className}`}>
      {e.name.slice(0, 1)}
    </span>
  );
}

/** The logo's two taste circles; they overlap more as the match gets stronger. */
export function MatchLens({ value, size = 28 }: { value: number; size?: number }) {
  const t = Math.min(1, Math.max(0, (value - 60) / 40));
  const r = 7;
  const d = 12 - 9 * t;
  const h = Math.sqrt(r * r - (d / 2) ** 2);
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className="shrink-0">
      <path d={`M16 ${16 - h}A${r} ${r} 0 0 1 16 ${16 + h}A${r} ${r} 0 0 1 16 ${16 - h}Z`} fill="var(--marigold)" />
      <circle cx={16 - d / 2} cy="16" r={r} fill="none" stroke="currentColor" strokeWidth="1.75" />
      <circle cx={16 + d / 2} cy="16" r={r} fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function Score({ value, large }: { value: number; large?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="sr-only">{value}% match</span>
      <MatchLens value={value} size={large ? 36 : 28} />
      <span className="leading-none" aria-hidden="true">
        <span className={`block font-display font-bold tabular-nums ${large ? "text-2xl" : "text-lg"}`}>{value}%</span>
        <span className="block text-xs text-muted">match</span>
      </span>
    </span>
  );
}

/** A ranked match. The first (best) one is shown larger, with its description. */
export function MatchCard({
  e,
  rank,
  reason,
  featured,
  onOpen,
}: {
  e: EntityCard;
  rank: number;
  reason?: string;
  featured?: boolean;
  onOpen: () => void;
}) {
  const p = pct(e);
  const why = reason || e.description;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group flex h-full w-full gap-3 rounded-2xl border bg-surface text-left transition-colors hover:border-forest ${
        featured ? "border-forest/40 p-3 sm:gap-4 sm:p-4" : "border-line p-2.5"
      }`}
    >
      <Thumb e={e} className={`shrink-0 rounded-xl ${featured ? "h-24 w-24 text-3xl sm:h-32 sm:w-32" : "h-16 w-16 text-xl"}`} />
      <span className="flex min-w-0 flex-1 flex-col">
        {/* The score drops under the name when the card is too narrow for both side by side. */}
        <span className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
          <span className="min-w-[8rem] flex-1">
            <span className="block text-xs text-muted">
              {featured ? "Best match" : `#${rank}`}
              <span className="sr-only">: </span>
            </span>
            <span
              className={`block font-display font-semibold leading-snug group-hover:text-forest ${
                featured ? "text-xl sm:text-[1.375rem]" : "line-clamp-2 text-[15px]"
              }`}
            >
              {e.name}
            </span>
            <span className="block truncate text-xs text-muted">{subtitle(e)}</span>
          </span>
          {p !== undefined && <Score value={p} large={featured} />}
        </span>
        {why && (
          <span className={`mt-1.5 block leading-snug ${featured ? "text-[15px]" : "line-clamp-3 text-sm"}`}>{why}</span>
        )}
        {featured && reason && e.description && (
          <span className="mt-1.5 line-clamp-2 block text-sm leading-snug text-muted">{e.description}</span>
        )}
      </span>
    </button>
  );
}

export function MatchSkeleton({ featured }: { featured?: boolean }) {
  return (
    <div aria-hidden="true" className={`flex gap-3 rounded-2xl border border-line bg-surface ${featured ? "p-4" : "p-2.5"}`}>
      <div className={`shrink-0 animate-pulse rounded-xl bg-line ${featured ? "h-24 w-24 sm:h-32 sm:w-32" : "h-16 w-16"}`} />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 w-1/4 animate-pulse rounded bg-line" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-line" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-line" />
      </div>
    </div>
  );
}

export function MatchDetail({ e, reason, onClose }: { e: EntityCard; reason?: string; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const p = pct(e);
  const mapsQuery = e.address ?? [e.name, e.city].filter(Boolean).join(", ");
  useDialog(dialog, back, onClose);

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-detail-title"
      className="fixed inset-0 z-40 flex flex-col bg-paper lg:absolute"
    >
      <div className="flex shrink-0 items-center border-b border-line px-4 py-2">
        <button
          ref={back}
          type="button"
          onClick={onClose}
          className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-medium text-forest hover:bg-surface"
        >
          <span aria-hidden="true">‹</span> All matches
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="flex max-w-3xl flex-col gap-5 sm:flex-row">
          <Thumb e={e} className="aspect-square w-full max-w-60 shrink-0 rounded-2xl text-6xl" />
          <div className="min-w-0">
            <h2 id="match-detail-title" className="font-display text-3xl font-bold leading-tight">
              {e.name}
            </h2>
            <p className="mt-1 text-sm text-muted">{subtitle(e)}</p>
            {p !== undefined && (
              <div className="mt-3">
                <Score value={p} large />
              </div>
            )}
            {reason && (
              <div className="mt-4 rounded-xl border-l-4 border-marigold bg-surface px-3.5 py-2.5">
                <p className="text-sm font-semibold">Why it fits you</p>
                <p className="mt-0.5 leading-relaxed">{reason}</p>
              </div>
            )}
            {e.description && <p className="mt-4 max-w-prose leading-relaxed">{e.description}</p>}
            {e.tags.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Qloo tags">
                {e.tags.map((t) => (
                  <li key={t} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
                    {t}
                  </li>
                ))}
              </ul>
            )}
            {e.address && <p className="mt-4 text-sm text-muted">{e.address}</p>}
            {(e.type === "place" || e.type === "destination") && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-forest px-4 text-sm font-medium text-forest-ink"
              >
                Open in Google Maps
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
