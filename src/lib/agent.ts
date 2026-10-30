import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  ENTITY_TYPES,
  getAudienceDemographics,
  getRecommendations,
  searchEntities,
  searchTags,
  type EntityCard,
} from "./qloo";

export const MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 10;

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; entities?: EntityCard[]; error?: string }
  | { type: "done" }
  | { type: "error"; message: string };

const SYSTEM = `You are a taste-aware concierge powered by Qloo's cultural taste graph (250M+ entities across music, film, TV, books, podcasts, games, brands, places and travel).
Your specialty is helping couples, friends and families with different tastes find something they will all enjoy: what to watch together, where to eat, what to play on a road trip, where to travel. It works for one person too.

How to work:
- Never recommend from memory alone. Ground every recommendation in Qloo tool results.
- First resolve what the person likes into Qloo entity IDs with search_entities (and tag IDs with search_tags for moods, cuisines, styles). If the message already gives Qloo entity IDs in square brackets, use those directly as seeds and don't search for them again.
- Then call get_recommendations with those IDs as seeds. Cross-domain is the superpower: a person's music and film taste predicts restaurants, destinations and brands.
- When the message describes several people ("I love X, my partner loves Y"), resolve every person's favorites and pass all of them together as seeds, so Qloo ranks what sits where their tastes overlap. Prefer picks that fit everyone over picks that suit only one person.
- Use filter tags and location to respect hard constraints; use seed tags for softer preferences.
- When they ask for less mainstream picks, hidden gems or something new, set max_popularity instead of guessing.
- Never recommend the favorites themselves, and skip other entries from the same franchise (sequels, spin-offs, other seasons) unless they ask for more of it: they already know it.
- In follow-ups, respect every exclusion they state ("not X", "other than X", "no X"): leave out anything from X, and don't bold or name X anywhere in the answer.
- If a call returns nothing, loosen one constraint and try again rather than guessing.
- Be efficient: batch independent lookups in parallel, and aim to answer within 3-4 rounds of tool calls.
- Keep the final answer short; it sits beside a list of match cards. Bold only the names of your picks, never other titles. Write one sentence on how you read their taste (for several people: what their tastes have in common), then 4-8 picks as a bullet list: the entity's exact Qloo name in bold, then why it fits in under 15 words (for several people: why it works for each of them). End with one short line suggesting where to start. No headings, no addresses, no long descriptions: the cards already show those.
- Don't narrate your tool calls; the UI shows progress.`;

const SearchEntitiesInput = z.object({
  query: z.string().min(1),
  type: z.enum(ENTITY_TYPES).optional(),
});
const SearchTagsInput = z.object({ query: z.string().min(1) });
const RecommendationsInput = z.object({
  type: z.enum(ENTITY_TYPES),
  seed_entity_ids: z.array(z.string()).optional(),
  seed_tag_ids: z.array(z.string()).optional(),
  required_tag_ids: z.array(z.string()).optional(),
  location: z.string().optional(),
  max_popularity: z.number().min(0).max(1).optional(),
  take: z.number().int().min(1).max(15).optional(),
});
const DemographicsInput = z.object({ entity_ids: z.array(z.string()).min(1) });

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_entities",
    description:
      "Look up Qloo entities (artists, movies, places, brands, etc.) by name to get their entity IDs. Use this before get_recommendations.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name to search, e.g. 'Radiohead' or 'Wes Anderson'" },
        type: { type: "string", enum: [...ENTITY_TYPES] },
      },
      required: ["query"],
    },
  },
  {
    name: "search_tags",
    description:
      "Find Qloo tag IDs for moods, genres, cuisines, ambience or styles (e.g. 'cozy', 'vegan', 'jazz'). The result says which entity types each tag applies to.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "get_recommendations",
    description:
      "Qloo Insights: return entities of `type` ranked by taste affinity to the seed entities and/or seed tags. Supports cross-domain (e.g. seed artists -> recommend places). `required_tag_ids` hard-filters results; `location` (free text like 'Brooklyn' or 'Lisbon') applies to places and destinations.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: [...ENTITY_TYPES] },
        seed_entity_ids: { type: "array", items: { type: "string" } },
        seed_tag_ids: { type: "array", items: { type: "string" } },
        required_tag_ids: { type: "array", items: { type: "string" } },
        location: { type: "string" },
        max_popularity: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Popularity percentile cap. Use about 0.8 for less mainstream picks and 0.6 for hidden gems.",
        },
        take: { type: "integer", minimum: 1, maximum: 15 },
      },
      required: ["type"],
    },
  },
  {
    name: "get_audience_demographics",
    description:
      "Qloo's age and gender affinity for the audience of the given entities (positive = over-indexed). Useful to understand who a taste profile resembles.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { entity_ids: { type: "array", items: { type: "string" } } },
      required: ["entity_ids"],
    },
  },
];

async function runTool(name: string, input: unknown): Promise<{ result: unknown; entities?: EntityCard[] }> {
  switch (name) {
    case "search_entities": {
      const i = SearchEntitiesInput.parse(input);
      const entities = await searchEntities(i.query, i.type);
      return { result: entities, entities };
    }
    case "search_tags": {
      const i = SearchTagsInput.parse(input);
      return { result: await searchTags(i.query) };
    }
    case "get_recommendations": {
      const i = RecommendationsInput.parse(input);
      const entities = await getRecommendations({
        type: i.type,
        seedEntityIds: i.seed_entity_ids,
        seedTagIds: i.seed_tag_ids,
        requiredTagIds: i.required_tag_ids,
        location: i.location,
        maxPopularity: i.max_popularity,
        take: i.take,
      });
      return { result: entities, entities };
    }
    case "get_audience_demographics": {
      const i = DemographicsInput.parse(input);
      return { result: await getAudienceDemographics(i.entity_ids) };
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

export async function runAgent(
  history: Anthropic.Beta.BetaMessageParam[],
  emit: (e: AgentEvent) => void,
) {
  const client = new Anthropic();
  const messages = [...history];
  let jsonRetries = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // On the last round, disallow tools so the agent always ends with an answer.
    const lastRound = round === MAX_TOOL_ROUNDS - 1;
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      tools,
      tool_choice: lastRound ? { type: "none" } : { type: "auto" },
      messages,
      // Low effort keeps replies fast enough for a live demo; Qloo does the heavy lifting.
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    stream.on("text", (delta) => emit({ type: "text", delta }));

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
      continue; // tool input was not parseable JSON; re-issue the turn
    }

    if (message.stop_reason === "refusal") {
      emit({ type: "text", delta: "\n\nSorry, I can't help with that request." });
      break;
    }
    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }

    const toolUses = message.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) break;

    messages.push({ role: "assistant", content: message.content });

    const results = await Promise.all(
      toolUses.map(async (t): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        emit({ type: "tool_call", id: t.id, name: t.name, input: t.input });
        try {
          const { result, entities } = await runTool(t.name, t.input);
          emit({ type: "tool_result", id: t.id, name: t.name, entities });
          return { type: "tool_result", tool_use_id: t.id, content: JSON.stringify(result) };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          emit({ type: "tool_result", id: t.id, name: t.name, error: msg });
          return { type: "tool_result", tool_use_id: t.id, is_error: true, content: msg };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }
  emit({ type: "done" });
}
