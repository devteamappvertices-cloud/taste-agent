"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { AgentEvent } from "@/lib/agent";
import type { EntityCard } from "@/lib/qloo";
import { reasonFor, splitAnswer, type Answer } from "@/lib/answer";
import { Composer } from "@/components/Composer";
import { MatchCard, MatchDetail, MatchLens, MatchSkeleton } from "@/components/Matches";
import { LogoMark } from "@/components/Logo";
import { EMPTY_FORM, TasteBuilder, type Search, type TasteForm } from "@/components/TasteBuilder";

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
  /** Heading for the results of a guided search, e.g. "Movies for you". */
  title?: string;
  /** Favorites the user picked from Qloo autocomplete, so the taste profile can show them. */
  known?: EntityCard[];
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

function mentions(text: string, name: string) {
  // Whole-name match, so a film called "Pi" doesn't match the word "picks".
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(text);
}

// Only show cards for Qloo entities the agent actually recommends in its answer, best match first.
function picks(t: Turn, answer: Answer) {
  return t.entities
    .filter((e) => reasonFor(answer, e.name) !== undefined || mentions(t.text, e.name))
    .sort((a, b) => (b.affinity ?? -1) - (a.affinity ?? -1));
}

function profile(t: Turn) {
  return t.seeds.map((id) => t.lookups[id]).filter(Boolean);
}

function isDemo() {
  return new URLSearchParams(window.location.search).has("demo");
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-forest border-t-transparent"
    />
  );
}

function StepIcon({ s }: { s: Step }) {
  if (!s.done) return <Spinner />;
  return s.error ? (
    <span aria-hidden="true" className="w-3.5 text-center font-bold text-red-700 dark:text-red-400">
      ×
    </span>
  ) : (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="var(--forest)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

/** Live list of the Qloo calls the agent makes for this turn. */
function Progress({ t }: { t: Turn }) {
  const allDone = t.steps.every((s) => s.done);
  return (
    <ol className="space-y-2 rounded-xl border border-line bg-surface p-3 text-sm">
      {t.steps.length === 0 && (
        <li className="flex items-center gap-2.5">
          <Spinner /> Reading your request…
        </li>
      )}
      {t.steps.map((s) => (
        <li key={s.id} className="flex items-center gap-2.5">
          <StepIcon s={s} />
          <span className="min-w-0 flex-1">{describe(s)}</span>
          {s.error ? (
            <span className="text-xs text-red-700 dark:text-red-400">Failed</span>
          ) : (
            s.count !== undefined && <span className="text-xs tabular-nums text-muted">{s.count} found</span>
          )}
        </li>
      ))}
      {t.steps.length > 0 && allDone && (
        <li className="flex items-center gap-2.5">
          <Spinner /> Choosing your best matches…
        </li>
      )}
    </ol>
  );
}

export default function Home() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<EntityCard | null>(null);
  const [mode, setMode] = useState<"guided" | "free">("guided");
  const [form, setForm] = useState<TasteForm>(EMPTY_FORM);
  const bottom = useRef<HTMLDivElement>(null);
  const findButton = useRef<HTMLButtonElement>(null);

  /** Start over with an empty form. */
  function reset() {
    if (busy) return;
    setTurns([]);
    setSelected(null);
    setInput("");
    setForm(EMPTY_FORM);
    setMode("guided");
  }

  /** Go back to the start screen with the last search filled in. */
  function editSearch() {
    if (busy) return;
    const first = turns.find((t) => t.role === "user");
    if (first && !first.title) {
      setMode("free");
      setInput(first.text);
    }
    setTurns([]);
    setSelected(null);
  }

  function applyExample() {
    setMode("guided");
    setForm({
      loves: [{ name: "Radiohead", id: RADIOHEAD_ID, type: "artist", image: RADIOHEAD_IMAGE }],
      want: "movies",
      where: "",
    });
    setTimeout(() => findButton.current?.focus(), 0);
  }

  function prefill(text: string) {
    setInput(text);
    setTimeout(() => document.getElementById("free-ask")?.focus(), 0);
  }

  async function send(text: string, opts: { content?: string; known?: EntityCard[]; title?: string } = {}) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setSelected(null);

    const known = opts.known ?? [];
    const title = opts.title ?? [...turns].reverse().find((t) => t.role === "user")?.title;
    const empty = { steps: [], entities: [], lookups: {}, seeds: [] };
    const history: Turn[] = [...turns, { role: "user", text: q, content: opts.content?.trim(), title, known, ...empty }];
    const lookups = Object.fromEntries(known.map((k) => [k.id, k]));
    setTurns([...history, { role: "assistant", text: "", ...empty, lookups }]);
    setTimeout(() => {
      const smooth = window.matchMedia("(prefers-reduced-motion: no-preference)").matches ? "smooth" : "auto";
      if (window.matchMedia("(min-width: 1024px)").matches) bottom.current?.scrollIntoView({ behavior: smooth, block: "end" });
      else window.scrollTo({ top: 0, behavior: smooth });
    }, 50);

    const update = (fn: (t: Turn) => Turn) =>
      setTurns((prev) => [...prev.slice(0, -1), fn(prev[prev.length - 1])]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(isDemo() ? { "x-demo": "1" } : {}) },
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
      const message =
        err instanceof TypeError
          ? "Couldn't reach the server. Check your connection, then try again."
          : err instanceof Error
            ? err.message
            : "The request failed.";
      update((t) => ({ ...t, error: message }));
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    const lastUser = [...turns].reverse().find((t) => t.role === "user");
    if (!lastUser || busy) return;
    setTurns(turns.slice(0, -2));
    setTimeout(() => send(lastUser.text, lastUser), 0);
  }

  const started = turns.length > 0;
  const active = [...turns].reverse().find((t) => t.role === "assistant");
  const activeUser = [...turns].reverse().find((t) => t.role === "user");
  const activeRunning = busy && active === turns[turns.length - 1];
  const answer = splitAnswer(active?.text ?? "");
  const matches = active ? picks(active, answer) : [];
  const seeds = active ? profile(active) : [];
  const title = activeUser?.title ?? "Your matches";
  const current = active && [...active.steps].reverse().find((s) => !s.done);
  const status = activeRunning
    ? current
      ? describe(current)
      : "Choosing your best matches"
    : active?.error
      ? `Search failed: ${active.error}`
      : matches.length
        ? `${matches.length} matches ready, best first`
        : "";

  const header = (
    <header className="shrink-0 border-b border-line bg-paper">
      <div className={`mx-auto flex items-center justify-between gap-3 px-4 py-2.5 ${started ? "max-w-[90rem]" : "max-w-6xl"}`}>
        <button type="button" onClick={reset} className="flex items-center gap-2 text-left" aria-label="Taste Agent, start over">
          <LogoMark />
          <span className="whitespace-nowrap font-display text-lg font-bold tracking-tight">Taste Agent</span>
          <span className="hidden text-xs text-muted md:inline">Personal recommendations, powered by Qloo</span>
        </button>
        {started && (
          <div className="flex shrink-0 gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={editSearch}
              disabled={busy}
              className="min-h-9 whitespace-nowrap rounded-full border border-line px-3 text-sm hover:border-forest disabled:opacity-40 sm:px-3.5"
            >
              Edit search
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="min-h-9 whitespace-nowrap rounded-full bg-forest px-3 text-sm font-medium text-forest-ink disabled:opacity-40 sm:px-3.5"
            >
              New search
            </button>
          </div>
        )}
      </div>
    </header>
  );

  if (!started) {
    return (
      <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
        {header}
        <main className="mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-x-14 gap-y-8 px-4 py-6 lg:min-h-0 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:overflow-y-auto">
          {/* What this is */}
          <div>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight xl:text-5xl">
              Find movies, music, food and places that fit your taste.
            </h1>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-muted">
              Add a few things you already love. Our AI agent searches Qloo&apos;s taste graph of 250 million titles,
              places and brands, then ranks what fits you, with a reason for each pick.
            </p>

            {/* A real result, so the purpose is obvious at a glance */}
            <figure className="mt-7 max-w-md rounded-2xl border border-line bg-surface p-4">
              <figcaption className="flex items-center gap-2.5 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={RADIOHEAD_IMAGE} alt="" className="h-8 w-8 rounded-full object-cover" />
                <span>
                  Fans of <strong className="font-semibold">Radiohead</strong> get these film matches from Qloo:
                </span>
              </figcaption>
              <ul className="mt-3 space-y-1.5">
                {PREVIEW.map((m) => (
                  <li key={m.name} className="flex items-center gap-2.5 text-sm">
                    <MatchLens value={m.pct} size={22} />
                    <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                    <span className="shrink-0 tabular-nums text-muted">{m.pct}% match</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={applyExample}
                className="mt-3 min-h-9 rounded-lg text-sm font-medium text-forest underline underline-offset-4 hover:text-ink"
              >
                Use this example
              </button>
            </figure>
          </div>

          {/* Start a search */}
          <div className="rounded-3xl border border-line bg-surface p-5 sm:p-7">
            {mode === "guided" ? (
              <>
                <TasteBuilder form={form} onChange={setForm} onSubmit={(s: Search) => send(s.display, s)} busy={busy} findRef={findButton} />
                <p className="mt-6 border-t border-line pt-4 text-sm text-muted">
                  Prefer to type?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("free")}
                    className="font-medium text-forest underline underline-offset-4 hover:text-ink"
                  >
                    Describe what you want in your own words
                  </button>
                </p>
              </>
            ) : (
              <div>
                <h2 className="font-display text-[17px] font-semibold">Describe what you want</h2>
                <p className="mt-0.5 text-sm text-muted">Mention a few things you love and what you want to find.</p>
                <div className="mt-3">
                  <Composer
                    id="free-ask"
                    label="Describe what you want"
                    value={input}
                    onChange={setInput}
                    onSend={(text) => send(text)}
                    busy={busy}
                    placeholder="e.g. I love Wes Anderson films. Which restaurants in Paris would I like?"
                  />
                </div>
                <p className="mt-5 text-sm font-medium">Or start from one of these</p>
                <ul className="mt-2 space-y-1.5">
                  {EXAMPLES.map((ex) => (
                    <li key={ex}>
                      <button
                        type="button"
                        onClick={() => prefill(ex)}
                        className="min-h-10 w-full rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-forest"
                      >
                        {ex}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 border-t border-line pt-4 text-sm">
                  <button
                    type="button"
                    onClick={() => setMode("guided")}
                    className="font-medium text-forest underline underline-offset-4 hover:text-ink"
                  >
                    Back to picking favorites step by step
                  </button>
                </p>
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
      <p role="status" className="sr-only">
        {status}
      </p>
      <main className="mx-auto grid w-full max-w-[90rem] flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* Matches */}
        <section
          aria-labelledby="results-title"
          className="relative order-1 flex flex-col lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-0"
        >
          <div className="shrink-0 px-4 pb-3 pt-5 sm:px-6">
            <h1 id="results-title" className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {title}
            </h1>
            {seeds.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-sm text-muted">Based on</span>
                {seeds.map((s) => (
                  <span
                    key={s.id}
                    className="flex items-center gap-1.5 rounded-full border border-forest/50 bg-surface py-0.5 pl-0.5 pr-2.5"
                  >
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest/10 font-display text-xs text-forest">
                        {s.name.slice(0, 1)}
                      </span>
                    )}
                    <span className="text-sm font-medium">{s.name}</span>
                  </span>
                ))}
              </div>
            )}
            {active && !activeRunning && matches.length > 0 && (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-muted">
                <span>{matches.length} matches, best first. Select one for details.</span>
                {active.steps.length > 0 && (
                  <details className="basis-full sm:basis-auto">
                    <summary className="cursor-pointer select-none hover:text-ink">
                      How these were found ({active.steps.length} Qloo {active.steps.length === 1 ? "call" : "calls"})
                    </summary>
                    <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
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
            )}
          </div>

          <div className="px-4 pb-6 sm:px-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {active?.error && (
              <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
                <p className="font-semibold">{matches.length ? "The search stopped early." : "Couldn't get your matches."}</p>
                <p className="mt-0.5 text-sm">{active.error}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={retry}
                    disabled={busy}
                    className="min-h-9 rounded-lg bg-red-800 px-3.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-red-200 dark:text-red-950"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={editSearch}
                    disabled={busy}
                    className="min-h-9 rounded-lg border border-current px-3.5 text-sm font-medium disabled:opacity-40"
                  >
                    Edit search
                  </button>
                </div>
              </div>
            )}

            {matches.length > 0 ? (
              <ul className="grid gap-3 xl:grid-cols-2">
                {matches.map((e, i) => (
                  <li key={e.id} className={i === 0 ? "xl:col-span-2" : ""}>
                    <MatchCard
                      e={e}
                      rank={i + 1}
                      reason={reasonFor(answer, e.name)}
                      featured={i === 0}
                      onOpen={() => setSelected(e)}
                    />
                  </li>
                ))}
              </ul>
            ) : activeRunning ? (
              <div>
                <p className="mb-3 flex items-center gap-2 text-sm text-muted">
                  <Spinner /> Searching Qloo. This usually takes 10–20 seconds.
                </p>
                <div className="grid gap-3 xl:grid-cols-2">
                  <div className="xl:col-span-2">
                    <MatchSkeleton featured />
                  </div>
                  <MatchSkeleton />
                  <MatchSkeleton />
                  <MatchSkeleton />
                  <MatchSkeleton />
                </div>
              </div>
            ) : (
              !active?.error && (
                <div className="rounded-2xl border border-dashed border-line p-6 text-center">
                  <p className="font-semibold">No matches came back for this search.</p>
                  <p className="mt-1 text-sm text-muted">Try fewer favorites, a different category, or leave out the city.</p>
                  <button
                    type="button"
                    onClick={editSearch}
                    className="mt-3 min-h-9 rounded-lg border border-line px-3.5 text-sm font-medium hover:border-forest"
                  >
                    Edit search
                  </button>
                </div>
              )
            )}
          </div>

          {selected && <MatchDetail e={selected} reason={reasonFor(answer, selected.name)} onClose={() => setSelected(null)} />}
        </section>

        {/* Conversation */}
        <section
          aria-label="Your search"
          className="order-2 space-y-4 border-t border-line px-4 py-4 text-[15px] lg:col-start-1 lg:row-start-1 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-t-0"
        >
          {turns.map((t, idx) => {
            if (t.role === "user") {
              return (
                <div key={idx} className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-forest px-4 py-2.5 text-forest-ink">
                  {t.text}
                </div>
              );
            }
            const latest = t === active;
            const running = latest && activeRunning;
            // The latest answer's picks are on the cards, so only its summary is shown here.
            const text = latest && answer.reasons.size > 0 ? answer.summary : t.text;
            return (
              <div key={idx} className="space-y-3">
                {running && <Progress t={t} />}
                {text && (
                  <div className="answer leading-6">
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                )}
                {!latest && t.error && <p className="text-sm text-muted">This search failed: {t.error}</p>}
              </div>
            );
          })}
          <div ref={bottom} />
        </section>

        {/* Refine */}
        <div className="sticky bottom-0 order-3 border-t border-line bg-paper px-4 py-3 lg:static lg:col-start-1 lg:row-start-2 lg:border-r">
          {!busy && active?.text && !active.error && (
            <div className="-mx-4 mb-2.5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {FOLLOW_UPS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => send(f)}
                  className="min-h-9 shrink-0 whitespace-nowrap rounded-full border border-line bg-surface px-3 text-sm hover:border-forest"
                >
                  {f}
                </button>
              ))}
            </div>
          )}
          <Composer
            label="Refine your matches"
            value={input}
            onChange={setInput}
            onSend={(text) => send(text)}
            busy={busy}
            placeholder="Refine it: cheaper, closer, more like the second one…"
          />
        </div>
      </main>
    </div>
  );
}
