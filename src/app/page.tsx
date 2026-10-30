"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { AgentEvent } from "@/lib/agent";
import type { EntityCard } from "@/lib/qloo";
import { TYPE_PLURAL, franchise } from "@/lib/categories";
import { Composer } from "@/components/Composer";
import { CommonGround, ExploreBeyond, MatchDetail, PosterCard, PosterSkeleton } from "@/components/Matches";
import { LogoMark } from "@/components/Logo";
import { Start, type Quick } from "@/components/Start";

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

// Only show cards for Qloo entities the agent actually recommends in its answer,
// best match first.
function mentions(text: string, name: string) {
  // Whole-name match, so a film called "Pi" doesn't match the word "picks".
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(text);
}

// The agent bolds each pick's exact name. Only bolded names count: a title named inside another
// pick's reason ("like the serious side of Digimon Tamers") is not a pick.
function picks(t: Turn) {
  const bold = [...t.text.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]);
  const seen = new Set<string>();
  return t.entities
    .filter((e) => (bold.length ? bold.some((b) => mentions(b, e.name)) : mentions(t.text, e.name)))
    .sort((a, b) => (b.affinity ?? -1) - (a.affinity ?? -1))
    .filter((e) => !seen.has(e.name.toLowerCase()) && !!seen.add(e.name.toLowerCase())); // same title, two versions: keep the best
}

// Instant results skip the favorite's own franchise, which they already know.
function outsideFranchise(list: EntityCard[], seeds: EntityCard[]) {
  const keys = seeds.map((s) => franchise(s.name)).filter((k): k is string => !!k);
  return list.filter((e) => !keys.some((k) => mentions(e.name, k)));
}

function profile(t: Turn) {
  return t.seeds.map((id) => t.lookups[id]).filter(Boolean);
}

const BULLET = /^\s*(?:[-*•]|\d+\.)\s+/;

/** The agent answers "one sentence, then `- **Name** reason` bullets"; cards carry the bullets. */
function splitAnswer(text: string) {
  const lines = text.split("\n");
  const bullets = lines.filter((l) => BULLET.test(l)).map((l) => l.replace(BULLET, ""));
  const summary = lines.filter((l) => !BULLET.test(l)).join("\n").trim();
  return { summary, bullets };
}

function reasonFor(bullets: string[], name: string) {
  const line = bullets.find((b) => mentions(b.match(/\*\*(.+?)\*\*/)?.[1] ?? b, name));
  return line
    ?.replace(/\*\*(.+?)\*\*/, "")
    .replace(/^[\s:,.\-–—]+/, "")
    .replace(/\*/g, "")
    .trim();
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
    window.scrollTo({ top: 0 });
  }

  function openDetail(e: EntityCard, reason?: string) {
    if (!selected) savedScroll.current = window.scrollY;
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
                // keep text from separate agent rounds in separate paragraphs
                text: t.text && !t.text.endsWith("\n\n") ? t.text + "\n\n" : t.text,
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
  const active = [...turns].reverse().find((t) => t.role === "assistant");
  const activePicks = active ? picks(active) : [];
  const activeSeeds = active ? profile(active) : [];
  const exploreIds = (activeSeeds.length ? activeSeeds.map((s) => s.id) : activePicks.map((p) => p.id)).slice(0, 3);

  const header = (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/80 backdrop-blur-lg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6">
        <button type="button" onClick={goHome} className="flex shrink-0 items-center gap-2.5 text-left" aria-label="Taste Agent, home">
          <LogoMark className="h-8 w-8" />
          <span className="font-display text-lg font-bold tracking-tight">Taste Agent</span>
        </button>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-xs text-muted sm:inline">Powered by Qloo</span>
          {started && (
            <button
              type="button"
              onClick={goHome}
              disabled={busy}
              className="rounded-full border border-forest px-4 py-1.5 text-sm font-semibold text-forest transition-colors hover:bg-forest hover:text-forest-ink disabled:opacity-40"
            >
              New search
            </button>
          )}
        </div>
      </div>
    </header>
  );

  if (!started) {
    return (
      <div className="min-h-dvh">
        {header}
        <Start busy={busy} onAsk={send} />
      </div>
    );
  }

  if (selected) {
    return (
      <div className="min-h-dvh">
        {header}
        <main id="main">
          <MatchDetail
            e={selected.e}
            reason={selected.reason}
            seeds={activeSeeds}
            onBack={closeDetail}
            onOpen={(e) => openDetail(e)}
            onAsk={(t) => send(t)}
          />
        </main>
      </div>
    );
  }

  const chips = [...(FOLLOW_UPS[activePicks[0]?.type] ?? FOLLOW_UPS.default), ...tagChips(activePicks)];

  return (
    <div className="min-h-dvh">
      {header}
      <main id="main" className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
        <div aria-live="polite" className="space-y-6">
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
            const list = picks(t);
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
                    {(list.length ? summary : t.text) && (
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
                        ? shown.map((e, i) => (
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

        <div className="sticky bottom-0 z-30 -mx-4 mt-8 border-t border-line/70 bg-paper/85 px-4 pb-4 pt-3 backdrop-blur-lg sm:-mx-6 sm:px-6">
          {!busy && active?.text && !active.error && (
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
      </main>
    </div>
  );
}
