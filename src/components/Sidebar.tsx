"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import type { SavedChat } from "@/lib/firebase";
import type { EntityCard } from "@/lib/qloo";
import { TYPE_LABEL } from "@/lib/categories";
import { LogoMark } from "@/components/Logo";

/** Profile photo, or the first letter of the name when there is none or it fails to load. */
export function Avatar({ user, size = "h-8 w-8" }: { user: User; size?: string }) {
  const [broken, setBroken] = useState(false);
  const name = user.displayName || user.email || "?";
  return user.photoURL && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span aria-hidden="true" className={`${size} flex shrink-0 items-center justify-center rounded-full bg-forest text-sm font-semibold uppercase text-forest-ink`}>
      {name.slice(0, 1)}
    </span>
  );
}

/** Header account button: photo and first name, with a menu for chats (phones) and sign out. */
export function AccountMenu({ user, onChats, onSignOut }: { user: User; onChats: () => void; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const name = user.displayName || user.email || "Account";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account: ${name}`}
        className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface py-0.5 pl-0.5 pr-2.5 transition-colors hover:border-forest sm:pr-3"
      >
        <Avatar user={user} />
        <span className="hidden max-w-32 truncate text-sm font-semibold sm:inline">{name.split(/[\s@]/)[0]}</span>
        <span aria-hidden="true" className="text-xs text-muted">▾</span>
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
          <div role="menu" className="rise absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-2xl bg-surface shadow-xl ring-1 ring-line">
            <div className="flex items-center gap-3 border-b border-line p-3.5">
              <Avatar user={user} size="h-10 w-10" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.displayName || "Signed in"}</p>
                {user.email && <p className="truncate text-xs text-muted">{user.email}</p>}
              </div>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onChats();
              }}
              className="block w-full px-4 py-2.5 text-left text-sm hover:bg-paper lg:hidden"
            >
              Your chats
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-red-700 hover:bg-paper"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function when(c: SavedChat) {
  const ms = c.updatedAt?.toMillis();
  if (!ms) return "Just now";
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Saved chats for a signed-in user: fixed on wide screens, a drawer on phones. */
export function Sidebar({
  user,
  chats,
  activeId,
  open,
  busy,
  onClose,
  onNew,
  onOpen,
  onDelete,
  onSignOut,
  favorites,
  onOpenFavorite,
  onRemoveFavorite,
}: {
  user: User;
  chats: SavedChat[];
  activeId: string | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onNew: () => void;
  onOpen: (c: SavedChat) => void;
  onDelete: (c: SavedChat) => void;
  onSignOut: () => void;
  favorites: EntityCard[];
  onOpenFavorite: (e: EntityCard) => void;
  onRemoveFavorite: (e: EntityCard) => void;
}) {
  const [tab, setTab] = useState<"chats" | "saved">("chats");
  const panel = (
    <nav aria-label="Your chats" className="flex h-full flex-col bg-surface">
      {/* Same height as the page header (60px + its border), so the two line up. */}
      <button
        type="button"
        onClick={onNew}
        disabled={busy}
        aria-label="Taste Agent, home"
        className="flex h-[61px] shrink-0 items-center gap-2.5 border-b border-line px-4 text-left"
      >
        <LogoMark className="h-8 w-8" />
        <span className="font-display text-lg font-bold tracking-tight">Taste Agent</span>
      </button>
      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest transition-colors hover:bg-forest hover:text-forest-ink disabled:opacity-40"
        >
          <span aria-hidden="true">＋</span> New chat
        </button>
      </div>
      <div role="tablist" aria-label="Your library" className="mx-3 mb-2 grid grid-cols-2 rounded-full bg-paper p-1 text-sm font-semibold">
        {(
          [
            ["chats", "Chats", chats.length],
            ["saved", "Saved", favorites.length],
          ] as const
        ).map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-full py-1.5 transition-colors ${tab === key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {label}
            {n > 0 && <span className="ml-1 text-xs font-medium text-muted">{n}</span>}
          </button>
        ))}
      </div>
      {tab === "saved" ? (
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
          {favorites.length === 0 && (
            <li className="px-2 py-3 text-sm text-muted">Tap the heart on any match to save it here.</li>
          )}
          {favorites.map((f) => (
            <li key={f.id} className="group relative">
              <button
                type="button"
                onClick={() => onOpenFavorite(f)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 pr-9 text-left hover:bg-paper"
              >
                {f.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.image} alt="" className="h-11 w-9 shrink-0 rounded-lg bg-line object-cover" />
                ) : (
                  <span className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg bg-mint text-sm font-semibold text-forest">
                    {f.name.slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{f.name}</span>
                  <span className="block text-xs text-muted">{[TYPE_LABEL[f.type] ?? f.type, f.year ?? f.city].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onRemoveFavorite(f)}
                aria-label={`Remove ${f.name} from favorites`}
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-red-600 opacity-0 transition-opacity hover:bg-red-50 focus-visible:opacity-100 group-hover:opacity-100 max-lg:opacity-100"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
                  <path d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.7 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.5 0 5.5 3.5 4.4 6.7C19.5 15.9 12 20.5 12 20.5z" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : (
      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        {chats.length === 0 && <li className="px-2 py-3 text-sm text-muted">Your searches will show up here.</li>}
        {chats.map((c) => (
          <li key={c.id} className="group relative">
            <button
              type="button"
              onClick={() => onOpen(c)}
              disabled={busy}
              aria-current={c.id === activeId ? "true" : undefined}
              className={`block w-full rounded-xl px-3 py-2 pr-9 text-left transition-colors disabled:opacity-50 ${
                c.id === activeId ? "bg-mint" : "hover:bg-paper"
              }`}
            >
              <span className="block truncate text-sm font-medium">{c.title}</span>
              <span className="block text-xs text-muted">{when(c)}</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(c)}
              disabled={busy}
              aria-label={`Delete chat: ${c.title}`}
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted opacity-0 transition-opacity hover:bg-line hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 max-lg:opacity-100"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      )}
      <div className="flex items-center gap-2.5 border-t border-line p-3">
        <Avatar user={user} />
        <span className="min-w-0 flex-1 truncate text-sm">{user.displayName ?? user.email}</span>
        <button
          type="button"
          onClick={onSignOut}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-50"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="fixed bottom-0 left-0 top-0 z-30 hidden w-72 border-r border-line lg:block">{panel}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Your chats">
          <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40" />
          <div className="rise absolute bottom-0 left-0 top-0 w-80 max-w-[85vw] shadow-2xl">{panel}</div>
        </div>
      )}
    </>
  );
}

/** Google "G" for the sign-in button. */
export function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
