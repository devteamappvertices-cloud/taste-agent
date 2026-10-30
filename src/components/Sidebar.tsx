"use client";

import type { User } from "firebase/auth";
import type { SavedChat } from "@/lib/firebase";

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
}) {
  const panel = (
    <nav aria-label="Your chats" className="flex h-full flex-col bg-surface">
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
      <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted">Your chats</p>
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
      <div className="flex items-center gap-2.5 border-t border-line p-3">
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint font-semibold text-forest">
            {(user.displayName ?? user.email ?? "?").slice(0, 1)}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-sm">{user.displayName ?? user.email}</span>
        <button type="button" onClick={onSignOut} className="rounded-full px-2.5 py-1 text-xs font-medium text-muted hover:bg-paper hover:text-ink">
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="fixed bottom-0 left-0 top-[59px] z-30 hidden w-72 border-r border-line lg:block">{panel}</aside>
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
