"use client";

import { useEffect, useRef } from "react";
import type { EntityCard } from "@/lib/qloo";

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
  return e.city ? `${kind}, ${e.city}` : kind;
}

function pct(e: EntityCard) {
  return e.affinity !== undefined ? Math.round(e.affinity * 100) : undefined;
}

function Thumb({ e, className }: { e: EntityCard; className: string }) {
  return e.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={e.image} alt="" className={`object-cover ${className}`} loading="lazy" />
  ) : (
    <span className={`flex items-center justify-center bg-paper font-display text-muted ${className}`}>
      {e.name.slice(0, 1)}
    </span>
  );
}

/** `roomy` shows a short description when there are few matches and space to spare. */
export function MatchRow({ e, roomy, onOpen }: { e: EntityCard; roomy: boolean; onOpen: () => void }) {
  const p = pct(e);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full items-center gap-3 rounded-xl border border-line bg-surface p-2 text-left hover:border-forest"
    >
      <Thumb e={e} className={`shrink-0 rounded-lg text-lg ${roomy ? "h-20 w-20" : "h-12 w-12"}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-sm font-semibold">{e.name}</span>
        <span className="block truncate text-xs text-muted">{subtitle(e)}</span>
        {roomy && e.description && (
          <span className="mt-1 line-clamp-2 text-xs leading-snug">{e.description}</span>
        )}
      </span>
      {p !== undefined && (
        <span className="flex shrink-0 flex-col items-end gap-1 pr-1" aria-label={`${p}% match`}>
          <span className="text-sm font-semibold tabular-nums">{p}%</span>
          <span className="h-1 w-10 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <span className="block h-full rounded-full bg-marigold" style={{ width: `${p}%` }} />
          </span>
        </span>
      )}
    </button>
  );
}

export function MatchDetail({ e, onClose }: { e: EntityCard; onClose: () => void }) {
  const back = useRef<HTMLButtonElement>(null);
  const p = pct(e);
  const mapsQuery = e.address ?? [e.name, e.city].filter(Boolean).join(", ");

  useEffect(() => {
    back.current?.focus();
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-label={e.name} className="absolute inset-0 z-20 flex flex-col bg-paper">
      <div className="flex shrink-0 items-center border-b border-line px-4 py-2.5">
        <button ref={back} type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm font-medium text-forest hover:bg-surface">
          ‹ All matches
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row">
          <Thumb e={e} className="aspect-square w-full max-w-56 shrink-0 rounded-2xl text-5xl" />
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold leading-tight">{e.name}</h2>
            <p className="mt-1 text-sm text-muted">{subtitle(e)}</p>
            {p !== undefined && (
              <p className="mt-3 inline-block rounded-full bg-marigold px-2.5 py-0.5 text-sm font-semibold text-[#2b1d05]">
                {p}% match to your taste
              </p>
            )}
            {e.description && <p className="mt-3 max-w-prose leading-relaxed">{e.description}</p>}
            {e.tags.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Qloo tags">
                {e.tags.map((t) => (
                  <li key={t} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
                    {t}
                  </li>
                ))}
              </ul>
            )}
            {e.address && <p className="mt-3 text-sm text-muted">{e.address}</p>}
            {(e.type === "place" || e.type === "destination") && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block rounded-lg bg-forest px-3 py-1.5 text-sm font-medium text-forest-ink"
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
