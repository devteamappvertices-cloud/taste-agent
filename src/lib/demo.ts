import type { AgentEvent } from "./agent";
import type { EntityCard } from "./qloo";

// Made-up results for testing the UI locally without calling Claude or Qloo (no cost).
// Only used in development, when the page is opened with ?demo.

const PICKS: [name: string, affinity: number, reason: string, description: string][] = [
  ["The Quiet Orbit", 0.95, "Slow, lonely sci-fi with the same melancholy as your favorites.", "An astronaut alone on a mining station starts to doubt what she remembers."],
  ["Northern Static", 0.93, "Moody atmosphere and a restless, experimental score.", "A radio engineer chases a signal that seems to answer back."],
  ["Paper Lanterns", 0.92, "Gentle, handmade worlds that reward patient viewers.", "Two siblings spend a summer repairing their grandmother's lantern shop."],
  ["Glass Harbor", 0.9, "A cerebral mystery that leaves room for interpretation.", "A harbor town where the tide brings back things that were never lost."],
  ["Low Tide Radio", 0.88, "Dry humor and outsider characters you'll root for.", "A failing pirate radio station gets one last summer on air."],
  ["Saltwater Hymns", 0.86, "A warmer, slower pick for a quiet evening.", "A choir director returns to the island she left twenty years ago."],
];

function kind(message: string) {
  if (/restaurant|eat|food|bar|caf/i.test(message)) return "place";
  if (/book|read/i.test(message)) return "book";
  if (/podcast/i.test(message)) return "podcast";
  return "movie";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runDemo(message: string, emit: (e: AgentEvent) => void) {
  if (/demo error/i.test(message)) {
    await sleep(800);
    emit({ type: "error", message: "Demo error: the recommendation service didn't respond." });
    return;
  }

  const type = kind(message);
  const city = /\bin ([A-Z][\p{L} ]+?)(?: that|\.|$)/u.exec(message)?.[1];
  const seeds = [...message.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);

  // Favorites without IDs are looked up first, like the real agent does.
  const named = /I love (.+?)\./.exec(message)?.[1].split(", ").filter((n) => !n.includes("[")) ?? [];
  for (const [i, query] of named.entries()) {
    const id = `demo-lookup-${i}`;
    emit({ type: "tool_call", id, name: "search_entities", input: { query } });
    await sleep(700);
    const found: EntityCard = { id: `demo-seed-${i}`, name: query, type: "artist", tags: [] };
    emit({ type: "tool_result", id, name: "search_entities", entities: [found] });
    seeds.push(found.id);
  }

  emit({ type: "tool_call", id: "demo-recs", name: "get_recommendations", input: { type, seed_entity_ids: seeds, location: city } });
  await sleep(1500);
  const entities: EntityCard[] = PICKS.map(([name, affinity, , description], i) => ({
    id: `demo-${i}`,
    name,
    type,
    affinity,
    description,
    city: type === "place" ? city : undefined,
    // One broken image, to check the fallback.
    image: i === 1 ? "/demo-missing-image.jpg" : undefined,
    tags: ["Atmospheric", "Slow burn", "Cult favorite"],
  }));
  emit({ type: "tool_result", id: "demo-recs", name: "get_recommendations", entities });

  const answer = [
    "You like atmospheric, slightly melancholy work, so these lean moody and thoughtful.",
    "",
    ...PICKS.map(([name, , reason]) => `- **${name}** — ${reason}`),
    "",
    `Start with **${PICKS[0][0]}**.`,
  ].join("\n");
  for (const word of answer.split(/(?<= )/)) {
    emit({ type: "text", delta: word });
    await sleep(18);
  }
  emit({ type: "done" });
}
