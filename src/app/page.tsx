"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { AgentEvent } from "@/lib/agent";
import type { EntityCard } from "@/lib/qloo";
import { TYPE_PLURAL } from "@/lib/categories";
import { outsideFranchise, picks, reasonFor, splitAnswer } from "@/lib/answer";
import { Composer } from "@/components/Composer";
import { CommonGround, ExploreBeyond, MatchDetail, PosterCard, PosterSkeleton } from "@/components/Matches";
import { LogoMark } from "@/components/Logo";
import { Start, type Quick } from "@/components/Start";
import { AccountMenu, Sidebar } from "@/components/Sidebar";
import { AuthDialog, type AuthMode } from "@/components/AuthDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteChat, logOut, saveChat, useUser, watchChats, type SavedChat } from "@/lib/firebase";

interface Step {
  id: string;
  name: string;
  input: unknown;
  done: boolean;
  error?: string;
  count?: number;
}

interface Turn {
  role: "user" | "assistant";
  text: string;
  /** What is sent to the agent when it differs from what's shown (e.g. with Qloo IDs). */
  content?: string;
  steps: Step[];
  /** Entities Qloo recommended. */
  entities: EntityCard[];
  /** Entities found by name lookups, keyed by id, used to show the taste profile. */
  lookups: Record<string, EntityCard>;
  /** Entity ids the agent used as taste seeds. */
  seeds: string[];
  /** Direct Qloo matches shown within a second, until the agent's picks arrive. */
  quick?: EntityCard[];
  error?: string;
}

const SAVED = "taste-agent:turns";

/** Matches shown before "Show all": one row on wide screens. */
const FIRST = 5;

const FOLLOW_UPS: Record<string, string[]> = {
  place: ["More like these", "Cheaper options", "Less touristy"],
  destination: ["More like these", "Less touristy", "Closer to home"],
  brand: ["More like these", "More affordable", "Less mainstream"],
  default: ["More like these", "Less mainstream", "Only recent ones"],
};

// Tags too generic to refine by.
const VAGUE_TAG = /^(destination|place|podcasts?|restaurant|bar|hotel|music|movie|book|brand)$/i;

function describe(step: Step) {
  const i = (step.input ?? {}) as Record<string, unknown>;
  switch (step.name) {
    case "search_entities":
      return `Looking up ${i.query}`;
    case "search_tags":
      return `Finding Qloo tags for “${i.query}”`;
    case "get_recommendations": {
      const t = String(i.type ?? "");
      return `Matching ${TYPE_PLURAL[t] ?? t + "s"} to your taste${i.location ? ` in ${i.location}` : ""}`;
    }
    case "get_audience_demographics":
      return "Checking who else shares this taste";
    default:
      return step.name;
  }
}

function profile(t: Turn) {
  return t.seeds.map((id) => t.lookups[id]).filter(Boolean);
}

/** Qloo tags shared by several picks become one-tap refinements. */
function tagChips(list: EntityCard[]) {
  const count = new Map<string, number>();
  for (const e of list) for (const t of e.tags.slice(0, 5)) if (!VAGUE_TAG.test(t)) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => `More “${t}”`);
}

function Spinner() {
  return <span aria-hidden="true" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-forest border-t-transparent" />;
}

export default function Home() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<{ e: EntityCard; reason?: string } | null>(null);
  const savedScroll = useRef(0);
  const user = useUser();
  const [chats, setChats] = useState<SavedChat[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [toDelete, setToDelete] = useState<SavedChat | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Browser back works like the Back buttons: detail -> results -> start. `pushed` counts our history entries.
  const pushed = useRef(0);
  const onBack = useRef(() => {});
  useEffect(() => {
    const pop = () => {
      pushed.current = Math.max(0, pushed.current - 1);
      onBack.current();
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  function push() {
    history.pushState({ tasteAgent: true }, "");
    pushed.current++;
  }
  function goBack() {
    if (pushed.current > 0) history.back();
    else onBack.current();
  }
  const lastSaved = useRef("");

  // Signed-in users get their chats in the sidebar, live from Firestore.
  useEffect(() => {
    if (!user) return setChats([]);
    return watchChats(user.uid, setChats);
  }, [user]);

  // Save each finished answer to the user's chat. Only what the page shows is kept, to stay small.
  useEffect(() => {
    if (busy || !user || !chatId || !turns.length) return;
    const last = turns[turns.length - 1];
    const signature = `${chatId}|${turns.length}|${last.text.length}`;
    if (last.role !== "assistant" || !last.text || lastSaved.current === signature) return;
    lastSaved.current = signature;
    const compact = turns.map((t) =>
      t.role === "user"
        ? t
        : { ...t, quick: undefined, entities: picks(t), lookups: Object.fromEntries(profile(t).map((s) => [s.id, s])) },
    );
    const seen = new Set<string>();
    const seeds = turns
      .flatMap((t) => (t.role === "assistant" ? profile(t) : []))
      .filter((s) => !seen.has(s.id) && !!seen.add(s.id))
      .map(({ id, name, type, image }) => ({ id, name, type, image, tags: [] }));
    saveChat(user.uid, { id: chatId, title: turns[0].text.slice(0, 80), seeds, turns: compact }).catch((err) =>
      console.error("Could not save chat", err),
    );
  }, [busy, user, chatId, turns]);

  // Keep the conversation through a refresh (this tab only). Storage can be blocked; the app works without it.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SAVED);
      if (saved) setTurns(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    if (busy) return;
    try {
      if (turns.length) sessionStorage.setItem(SAVED, JSON.stringify(turns));
      else sessionStorage.removeItem(SAVED);
    } catch {}
  }, [turns, busy]);

  function goHome() {
    if (busy) return;
    setTurns([]);
    setSelected(null);
    setInput("");
    setChatId(null);
    setDrawer(false);
    setExpanded(new Set());
    window.scrollTo({ top: 0 });
  }

  function openChat(c: SavedChat) {
    if (busy) return;
    const restored = c.turns as Turn[];
    lastSaved.current = `${c.id}|${restored.length}|${restored[restored.length - 1]?.text.length ?? 0}`;
    if (!turns.length) push();
    setTurns(restored);
    setChatId(c.id);
    setExpanded(new Set());
    setSelected(null);
    setDrawer(false);
    window.scrollTo({ top: 0 });
  }

  function removeChat(c: SavedChat) {
    if (!user) return;
    deleteChat(user.uid, c.id).catch((err) => console.error("Could not delete chat", err));
    if (c.id === chatId) goHome();
  }

  function openDetail(e: EntityCard, reason?: string) {
    if (!selected) {
      savedScroll.current = window.scrollY;
      push();
    }
    setSelected({ e, reason });
  }

  function closeDetail() {
    setSelected(null);
    requestAnimationFrame(() => window.scrollTo({ top: savedScroll.current }));
  }

  /**
   * `known` pre-fills entities the user already picked, so the taste profile can show them.
   * `quick` asks Qloo directly so matches appear while the agent is still thinking.
   */
  async function send(text: string, content?: string, known: EntityCard[] = [], quick?: Quick | Promise<Quick | undefined>) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setSelected(null);
    if (!chatId) setChatId(crypto.randomUUID());
    if (!turns.length) push();

    const empty = { steps: [], entities: [], lookups: {}, seeds: [] };
    const history: Turn[] = [...turns, { role: "user", text: q, content: content?.trim(), ...empty }];
    const lookups = Object.fromEntries(known.map((k) => [k.id, k]));
    setTurns([...history, { role: "assistant", text: "", ...empty, lookups, seeds: known.map((k) => k.id) }]);
    if (quick) {
      const at = history.length;
      Promise.resolve(quick)
        .then((q) => {
          if (!q?.ids.length) return null;
          // Typed favorites resolve here first, so the taste profile shows before the agent's lookups.
          const found = q.seeds ?? [];
          if (found.length)
            setTurns((prev) =>
              prev.map((t, i) =>
                i === at
                  ? {
                      ...t,
                      lookups: { ...Object.fromEntries(found.map((f) => [f.id, f])), ...t.lookups },
                      seeds: [...new Set([...found.map((f) => f.id), ...t.seeds])],
                    }
                  : t,
              ),
            );
          const qs = new URLSearchParams({
            type: q.type,
            ids: q.ids.join(","),
            ...(q.location && { loc: q.location }),
            ...(q.tag && { tag: q.tag }),
          });
          return fetch(`/api/explore?${qs}`).then((r) => (r.ok ? r.json() : null));
        })
        .then((b) => b && setTurns((prev) => prev.map((t, i) => (i === at ? { ...t, quick: b.results } : t))))
        .catch(() => {});
    }
    setTimeout(() => {
      const users = document.querySelectorAll("[data-user-turn]");
      users[users.length - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);

    const update = (fn: (t: Turn) => Turn) =>
      setTurns((prev) => [...prev.slice(0, -1), fn(prev[prev.length - 1])]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.filter((t) => t.text).map((t) => ({ role: t.role, content: t.content || t.text })),
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `The server returned an error (${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const e = JSON.parse(line) as AgentEvent;
          if (e.type === "text") update((t) => ({ ...t, text: t.text + e.delta }));
          else if (e.type === "tool_call")
            update((t) => {
              const i = (e.input ?? {}) as { seed_entity_ids?: string[] };
              const newSeeds = e.name === "get_recommendations" ? (i.seed_entity_ids ?? []) : [];
              return {
                ...t,
                // Text written before a tool call is a working note ("Need restaurant filter."), not the answer.
                text: "",
                steps: [...t.steps, { id: e.id, name: e.name, input: e.input, done: false }],
                seeds: [...t.seeds, ...newSeeds.filter((s) => !t.seeds.includes(s))],
              };
            });
          else if (e.type === "tool_result")
            update((t) => {
              const found = e.entities ?? [];
              const recs = e.name === "get_recommendations" ? found : [];
              const seen = new Set(t.entities.map((x) => x.id));
              const lookups = { ...t.lookups };
              if (e.name === "search_entities") for (const x of found) lookups[x.id] ??= x;
              return {
                ...t,
                lookups,
                steps: t.steps.map((s) =>
                  s.id === e.id ? { ...s, done: true, error: e.error, count: e.entities?.length } : s,
                ),
                entities: [...t.entities, ...recs.filter((x) => !seen.has(x.id))],
              };
            });
          else if (e.type === "error") update((t) => ({ ...t, error: e.message }));
        }
      }
    } catch (err) {
      update((t) => ({ ...t, error: err instanceof Error ? err.message : "The request failed." }));
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    const lastUser = [...turns].reverse().find((t) => t.role === "user");
    if (!lastUser || busy) return;
    setTurns(turns.slice(0, -2));
    setTimeout(() => send(lastUser.text, lastUser.content), 0);
  }

  const started = turns.length > 0;
  onBack.current = () => (selected ? closeDetail() : started ? goHome() : undefined);
  const active = [...turns].reverse().find((t) => t.role === "assistant");
  const activePicks = active ? picks(active) : [];
  const activeSeeds = active ? profile(active) : [];
  const exploreIds = (activeSeeds.length ? activeSeeds.map((s) => s.id) : activePicks.map((p) => p.id)).slice(0, 3);

  const header = (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/80 backdrop-blur-lg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
        <button type="button" onClick={goHome} className="flex shrink-0 items-center gap-2.5 text-left" aria-label="Taste Agent, home">
          <LogoMark className="h-8 w-8" />
          <span className="font-display text-lg font-bold tracking-tight">Taste Agent</span>
        </button>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span className="hidden text-xs text-muted md:inline">Powered by Qloo</span>
          {started && (
            <button
              type="button"
              onClick={goHome}
              disabled={busy}
              className="h-9 whitespace-nowrap rounded-full border border-forest px-3 text-sm font-semibold text-forest sm:px-4 transition-colors hover:bg-forest hover:text-forest-ink disabled:opacity-40"
            >
              New search
            </button>
          )}
          {user === null && (
            <>
              <button
                type="button"
                onClick={() => setAuthMode("signin")}
                className="h-9 whitespace-nowrap rounded-full border border-line bg-surface px-3 text-sm font-semibold transition-colors hover:border-forest hover:text-forest sm:px-4"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`h-9 whitespace-nowrap rounded-full bg-forest px-3 text-sm font-semibold sm:px-4 text-forest-ink shadow-[0_6px_16px_-8px_var(--forest)] transition-transform duration-300 ease-[var(--ease-out)] hover:scale-105 ${
                  started ? "hidden sm:block" : ""
                }`}
              >
                Sign up<span className="hidden sm:inline"> free</span>
              </button>
            </>
          )}
          {user === undefined && <span aria-hidden="true" className="skeleton h-9 w-24 rounded-full" />}
          {user && (
            <AccountMenu
              user={user}
              onChats={() => setDrawer(true)}
              onSignOut={() => {
                goHome();
                logOut();
              }}
            />
          )}
        </div>
      </div>
    </header>
  );

  // Header, then the sidebar (signed in) beside the page.
  const shell = (body: React.ReactNode) => (
    <div className="min-h-dvh">
      {header}
      {user && (
        <Sidebar
          user={user}
          chats={chats}
          activeId={chatId}
          open={drawer}
          busy={busy}
          onClose={() => setDrawer(false)}
          onNew={goHome}
          onOpen={openChat}
          onDelete={setToDelete}
          onSignOut={() => {
            goHome();
            logOut();
          }}
        />
      )}
      <div className={user ? "lg:pl-72" : ""}>{body}</div>
      {authMode && <AuthDialog mode={authMode} onClose={() => setAuthMode(null)} />}
      {toDelete && (
        <ConfirmDialog
          title="Delete this chat?"
          message={`"${toDelete.title}" will be removed from your chats. This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={() => removeChat(toDelete)}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );

  if (!started)
    return shell(
      <Start
        busy={busy}
        onAsk={send}
        past={chats.flatMap((c) => c.seeds ?? [])}
        onAuth={user === null ? setAuthMode : undefined}
      />,
    );

  if (selected) {
    return shell(
      <main id="main">
          <MatchDetail
            e={selected.e}
            reason={selected.reason}
            seeds={activeSeeds}
            onBack={goBack}
            onOpen={(e) => openDetail(e)}
          onAsk={(t) => send(t)}
        />
      </main>,
    );
  }

  const chips = [...(FOLLOW_UPS[activePicks[0]?.type] ?? FOLLOW_UPS.default), ...tagChips(activePicks)];

  return shell(
    <main id="main" className="mx-auto flex min-h-[calc(100dvh-59px)] w-full max-w-7xl flex-col px-4 pt-4 sm:px-6">
      <button type="button" onClick={goBack} disabled={busy} className="mb-3 self-start rounded-full px-2 py-1 text-sm font-medium text-muted hover:text-forest disabled:opacity-40">
        ← Back
      </button>
        <div aria-live="polite" className="space-y-6 pb-8">
          {turns.map((t, idx) => {
            const last = idx === turns.length - 1;
            if (t.role === "user") {
              return (
                <div key={idx} data-user-turn className="rise flex scroll-mt-24 items-end justify-end gap-2.5">
                  <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-mint px-5 py-3 font-medium text-[#064d35] sm:max-w-xl">{t.text}</p>
                </div>
              );
            }
            const running = busy && last;
            const current = [...t.steps].reverse().find((s) => !s.done);
            // While the agent works, show instant Qloo matches; its picks and words appear when it's done.
            const list = running ? [] : picks(t);
            const seeds = profile(t);
            const shown = list.length ? list : outsideFranchise(t.quick ?? [], seeds);
            const { summary, bullets } = splitAnswer(t.text);
            return (
              <section key={idx} aria-label="Agent answer" className="space-y-6">
                <div className="flex items-start gap-3">
                  <LogoMark className="mt-1 h-8 w-8 shrink-0" />
                  <div className="min-w-0 max-w-3xl flex-1 space-y-3">
                    {running && (
                      <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-sm ring-1 ring-line">
                        <Spinner />
                        <span>
                          {current ? describe(current) : t.steps.length ? "Choosing your best matches" : "Reading your taste"}…
                        </span>
                        {t.steps.length > 0 && (
                          <span className="ml-auto shrink-0 rounded-full bg-mint px-2 py-0.5 text-xs font-medium text-forest">
                            {t.steps.length} Qloo {t.steps.length === 1 ? "call" : "calls"}
                          </span>
                        )}
                      </div>
                    )}
                    {!running && (list.length ? summary : t.text) && (
                      <div className="answer rounded-3xl rounded-tl-lg bg-surface px-5 py-3.5 leading-relaxed ring-1 ring-line">
                        <ReactMarkdown>{list.length ? summary : t.text}</ReactMarkdown>
                      </div>
                    )}
                    {seeds.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-sm">
                        <span className="text-muted">Based on</span>
                        {seeds.map((s) => (
                          <span key={s.id} className="flex items-center gap-1.5 rounded-full bg-surface py-0.5 pl-0.5 pr-2.5 ring-1 ring-line">
                            {s.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.image} alt="" className="h-6 w-6 rounded-full object-cover" />
                            ) : (
                              <span className="w-1.5" />
                            )}
                            <span className="font-medium">{s.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {seeds.length >= 2 && <CommonGround a={seeds[0].id} b={seeds[1].id} />}
                    {t.error && (
                      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        {t.error}
                        {last && (
                          <button type="button" onClick={retry} className="ml-2 font-semibold underline">
                            Try again
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {(shown.length > 0 || running) && (
                  <div>
                    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h2 className="font-display text-2xl font-bold tracking-tight">Top matches</h2>
                      {list.length > 0 ? (
                        <span className="text-sm text-muted">{list.length} picks, best first</span>
                      ) : (
                        shown.length > 0 && <span className="text-sm text-muted">Straight from Qloo. The agent is choosing your best ones…</span>
                      )}
                    </div>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
                      {shown.length > 0
                        ? (expanded.has(idx) ? shown : shown.slice(0, FIRST)).map((e, i) => (
                            <li key={e.id}>
                              <PosterCard
                                e={e}
                                i={i}
                                seeds={seeds}
                                reason={reasonFor(bullets, e.name)}
                                onOpen={() => openDetail(e, reasonFor(bullets, e.name))}
                              />
                            </li>
                          ))
                        : Array.from({ length: 5 }, (_, i) => (
                            <li key={i} className={i > 1 ? "hidden sm:block" : ""}>
                              <PosterSkeleton i={i} />
                            </li>
                          ))}
                    </ul>
                    {shown.length > FIRST && (
                      <div className="mt-6 flex justify-center">
                        <button
                          type="button"
                          aria-expanded={expanded.has(idx)}
                          onClick={() => {
                            const next = new Set(expanded);
                            if (next.has(idx)) next.delete(idx);
                            else next.add(idx);
                            setExpanded(next);
                          }}
                          className="rounded-full bg-surface px-5 py-2 text-sm font-semibold ring-1 ring-line transition-colors hover:text-forest hover:ring-forest"
                        >
                          {expanded.has(idx) ? "Show less" : `Show all ${shown.length} matches`}
                        </button>
                      </div>
                    )}
                    {!running && t.steps.length > 0 && (
                      <details className="mt-5 text-sm text-muted">
                        <summary className="cursor-pointer select-none hover:text-ink">How these were found ({t.steps.length} Qloo {t.steps.length === 1 ? "call" : "calls"})</summary>
                        <ol className="mt-2 list-decimal space-y-1 pl-5">
                          {t.steps.map((s) => (
                            <li key={s.id}>
                              {describe(s)}
                              {s.error ? " (failed)" : s.count !== undefined ? `: ${s.count} results` : ""}
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {!busy && activePicks.length > 0 && exploreIds.length > 0 && (
          <div className="mt-12">
            <ExploreBeyond key={exploreIds.join()} ids={exploreIds} current={activePicks[0]?.type} onOpen={(e) => openDetail(e)} />
          </div>
        )}

        <div className="sticky bottom-0 z-30 -mx-4 mt-auto border-t border-line/70 bg-paper/85 px-4 pb-4 pt-3 backdrop-blur-lg sm:-mx-6 sm:px-6">
          {!busy && activePicks.length > 0 && !active?.error && (
            <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {chips.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => send(f)}
                  className="shrink-0 rounded-full bg-surface px-3.5 py-1.5 text-sm ring-1 ring-line transition-colors hover:text-forest hover:ring-forest"
                >
                  {f}
                </button>
              ))}
            </div>
          )}
          <Composer value={input} onChange={setInput} onSend={send} busy={busy} placeholder="Refine your matches…" />
        </div>
    </main>,
  );
}
