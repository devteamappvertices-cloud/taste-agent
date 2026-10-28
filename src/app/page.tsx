"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { AgentEvent } from "@/lib/agent";
import type { EntityCard } from "@/lib/qloo";
import { Composer } from "@/components/Composer";
import { MatchDetail, MatchRow } from "@/components/Matches";
import { TasteBuilder } from "@/components/TasteBuilder";

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
  error?: string;
}

const EXAMPLES = [
  "My dad loves Johnny Cash and westerns. What podcasts would he enjoy?",
  "I loved Dune and Interstellar. What should I read next?",
  "I love Radiohead and Blade Runner 2049. Where should I eat in Lisbon?",
];

// Real Qloo Insights result for Radiohead -> movies, shown as a preview of what the app does.
const RADIOHEAD_ID = "70CAE5BF-2F4C-445C-A3E5-4EDACFC3591C";
const RADIOHEAD_IMAGE = `https://images.qloo.com/i/${RADIOHEAD_ID}-420x-auto.jpg`;
const PREVIEW = [
  { name: "Children of Men", pct: 94 },
  { name: "Being John Malkovich", pct: 94 },
  { name: "Moon", pct: 93 },
];

const STEPS = ["Add favorites", "Pick a category", "Get ranked matches"];

const FOLLOW_UPS = ["More like these", "Less mainstream", "Why these match me"];

const TYPE_PLURAL: Record<string, string> = {
  place: "places",
  tv_show: "TV shows",
  video_game: "video games",
  destination: "destinations",
  person: "people",
};

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

function picks(t: Turn) {
  return t.entities
    .filter((e) => mentions(t.text, e.name))
    .sort((a, b) => (b.affinity ?? -1) - (a.affinity ?? -1));
}

function profile(t: Turn) {
  return t.seeds.map((id) => t.lookups[id]).filter(Boolean);
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-forest border-t-transparent"
    />
  );
}

export default function Home() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<EntityCard | null>(null);
  const [mode, setMode] = useState<"guided" | "free">("guided");
  const bottom = useRef<HTMLDivElement>(null);

  function reset() {
    if (busy) return;
    setTurns([]);
    setSelected(null);
    setInput("");
  }

  /** `known` pre-fills entities the user already picked, so the taste profile can show them. */
  async function send(text: string, content?: string, known: EntityCard[] = []) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setSelected(null);

    const empty = { steps: [], entities: [], lookups: {}, seeds: [] };
    const history: Turn[] = [...turns, { role: "user", text: q, content: content?.trim(), ...empty }];
    const lookups = Object.fromEntries(known.map((k) => [k.id, k]));
    setTurns([...history, { role: "assistant", text: "", ...empty, lookups }]);
    setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 50);

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
  const activeRunning = busy && active === turns[turns.length - 1];
  const matches = active ? picks(active) : [];
  const seeds = active ? profile(active) : [];

  const header = (
    <header className="shrink-0 border-b border-line bg-paper">
      <div className={`mx-auto flex items-center justify-between px-4 py-2.5 ${started ? "max-w-7xl" : "max-w-6xl"}`}>
        <button type="button" onClick={reset} className="text-left" aria-label="Taste Agent, start over">
          <span className="font-display text-lg font-bold tracking-tight">Taste Agent</span>
          <span className="ml-2 hidden text-xs text-muted sm:inline">Personal recommendations, powered by Qloo</span>
        </button>
        {started && (
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-forest disabled:opacity-40"
          >
            New search
          </button>
        )}
      </div>
    </header>
  );

  if (!started) {
    return (
      <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
        {header}
        <main className="mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-x-14 gap-y-8 px-4 py-6 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:overflow-y-auto">
          {/* What this is */}
          <div>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight xl:text-[3.25rem]">
              Find movies, music, food and places that fit your taste.
            </h1>
            <p className="mt-4 max-w-md text-muted">
              Tell us a few things you already love. Our AI agent searches Qloo&apos;s taste graph of 250
              million titles, places and brands, and ranks what matches you, in any category.
            </p>

            <ol className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-5">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-2 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-semibold text-forest-ink">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>

            {/* A real result, so the purpose is obvious at a glance */}
            <figure className="mt-7 max-w-md rounded-2xl border border-line bg-surface p-4">
              <figcaption className="flex items-center gap-2 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={RADIOHEAD_IMAGE}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                />
                <span>
                  Love <strong className="font-semibold">Radiohead</strong>? Qloo matches these films:
                </span>
              </figcaption>
              <ul className="mt-3 space-y-2">
                {PREVIEW.map((m) => (
                  <li key={m.name} className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line" aria-hidden="true">
                      <span className="block h-full rounded-full bg-marigold" style={{ width: `${m.pct}%` }} />
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-right tabular-nums text-muted">{m.pct}% match</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() =>
                  send(
                    "I love Radiohead. Recommend movies that match my taste.",
                    `I love Radiohead [${RADIOHEAD_ID}]. Recommend movies that match my taste.`,
                    [{ id: RADIOHEAD_ID, name: "Radiohead", type: "artist", image: RADIOHEAD_IMAGE, tags: [] }],
                  )
                }
                className="mt-3 text-sm font-medium text-forest underline underline-offset-4"
              >
                Try this example
              </button>
            </figure>
          </div>

          {/* Start a search */}
          <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
            <div role="tablist" aria-label="How to search" className="mb-5 inline-flex rounded-full bg-paper p-1">
              {(
                [
                  ["guided", "Pick favorites"],
                  ["free", "Describe it"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => setMode(key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                    mode === key ? "bg-forest text-forest-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "guided" ? (
              <TasteBuilder onSubmit={send} busy={busy} />
            ) : (
              <div>
                <label htmlFor="free-ask" className="block font-display text-base font-semibold">
                  Describe what you&apos;re looking for
                </label>
                <p className="text-sm text-muted">Mention a few things you love and what you want to find.</p>
                <div className="mt-2">
                  <Composer
                    id="free-ask"
                    value={input}
                    onChange={setInput}
                    onSend={send}
                    busy={busy}
                    placeholder="e.g. I love Wes Anderson films. Which restaurants in Paris would I like?"
                  />
                </div>
                <p className="mt-5 text-sm font-medium">Or try one of these</p>
                <ul className="mt-2 space-y-1.5">
                  {EXAMPLES.map((ex) => (
                    <li key={ex}>
                      <button
                        type="button"
                        onClick={() => send(ex)}
                        className="w-full rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-forest"
                      >
                        {ex}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      {header}
      <main className="mx-auto grid w-full max-w-7xl flex-1 lg:min-h-0 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)_auto]">
        {/* Conversation */}
        <section
          aria-label="Conversation"
          aria-live="polite"
          className="order-1 space-y-5 px-4 py-4 text-[15px] lg:col-start-1 lg:row-start-1 lg:overflow-y-auto lg:border-r lg:border-line"
        >
          {turns.map((t, idx) => {
            const last = idx === turns.length - 1;
            if (t.role === "user") {
              return (
                <div key={idx} className="ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-forest px-4 py-2.5 text-forest-ink">
                  {t.text}
                </div>
              );
            }
            const running = busy && last;
            const current = [...t.steps].reverse().find((s) => !s.done);
            return (
              <div key={idx} className="space-y-4">
                {running && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-surface px-3.5 py-2.5 text-sm">
                    <Spinner />
                    <span>
                      {current
                        ? describe(current)
                        : t.steps.length
                          ? "Choosing your best matches"
                          : "Reading your request"}
                      …
                    </span>
                    {t.steps.length > 0 && <span className="ml-auto text-xs text-muted">{t.steps.length} Qloo calls</span>}
                  </div>
                )}

                {t.text && (
                  <div className="answer leading-6">
                    <ReactMarkdown>{t.text}</ReactMarkdown>
                  </div>
                )}

                {t.error && (
                  <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {t.error}
                    {last && (
                      <button type="button" onClick={retry} className="ml-2 font-medium underline">
                        Try again
                      </button>
                    )}
                  </div>
                )}

              </div>
            );
          })}
          <div ref={bottom} />
        </section>

        {/* Matches */}
        <aside
          aria-label="Your matches"
          className="relative order-2 flex flex-col border-t border-line lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-0 lg:border-t-0"
        >
          <div className="shrink-0 px-4 pb-3 pt-5">
            <h2 className="font-display text-xl font-semibold">
              Your matches
              {matches.length > 0 && <span className="ml-2 text-sm font-normal text-muted">{matches.length}, best first</span>}
            </h2>
            {seeds.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-sm text-muted">Based on</span>
                {seeds.map((s) => (
                  <span
                    key={s.id}
                    className="flex items-center gap-1.5 rounded-full border-2 border-forest bg-surface py-0.5 pl-0.5 pr-2.5"
                  >
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-paper font-display text-xs">
                        {s.name.slice(0, 1)}
                      </span>
                    )}
                    <span className="text-sm font-medium">{s.name}</span>
                  </span>
                ))}
              </div>
            )}
            {active && !activeRunning && active.steps.length > 0 && (
              <details className="mt-2 text-sm text-muted">
                <summary className="cursor-pointer select-none hover:text-ink">
                  How these were found ({active.steps.length} Qloo calls)
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  {active.steps.map((s) => (
                    <li key={s.id}>
                      {describe(s)}
                      {s.error ? " (failed)" : s.count !== undefined ? `: ${s.count} results` : ""}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>

          <div className="px-4 pb-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {matches.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {matches.map((e) => (
                  <li key={e.id}>
                    <MatchRow e={e} roomy={matches.length <= 8} onOpen={() => setSelected(e)} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex h-full min-h-40 items-center justify-center rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
                {activeRunning ? (
                  <span className="flex items-center gap-2">
                    <Spinner /> Matches appear here as Qloo finds them
                  </span>
                ) : (
                  "No matches for this request. Try loosening it, or name a few more things you love."
                )}
              </div>
            )}
          </div>

          {selected && <MatchDetail e={selected} onClose={() => setSelected(null)} />}
        </aside>

        {/* Composer */}
        <div className="sticky bottom-0 order-3 border-t border-line bg-paper px-4 py-3 lg:static lg:col-start-1 lg:row-start-2 lg:border-r">
          {!busy && active?.text && !active.error && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {FOLLOW_UPS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => send(f)}
                  className="rounded-full border border-line bg-surface px-3 py-1 text-sm hover:border-forest"
                >
                  {f}
                </button>
              ))}
            </div>
          )}
          <Composer
            value={input}
            onChange={setInput}
            onSend={send}
            busy={busy}
            placeholder="Refine it: cheaper, closer, more like the second one…"
          />
        </div>
      </main>
    </div>
  );
}
