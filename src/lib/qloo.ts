// Thin client for the Qloo hackathon API. Responses are cached in memory
// (allowed by Qloo's hackathon terms) and trimmed before reaching the model.

const BASE = process.env.QLOO_API_URL ?? "https://hackathon.api.qloo.com";

export const ENTITY_TYPES = [
  "artist",
  "book",
  "brand",
  "destination",
  "movie",
  "person",
  "place",
  "podcast",
  "tv_show",
  "video_game",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export interface EntityCard {
  id: string;
  name: string;
  type: string;
  affinity?: number;
  popularity?: number;
  description?: string;
  address?: string;
  city?: string;
  image?: string;
  tags: string[];
}

const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_MS = 60 * 60 * 1000;

async function qlooGet(path: string, params: Record<string, string | number | undefined>) {
  const key = process.env.QLOO_API_KEY;
  if (!key) throw new Error("QLOO_API_KEY is not set");

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const url = `${BASE}${path}?${qs}`;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const res = await fetch(url, { headers: { "X-Api-Key": key } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Qloo ${path} returned ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  cache.set(url, { at: Date.now(), data });
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCard(e: any): EntityCard {
  const p = e.properties ?? {};
  return {
    id: e.entity_id,
    name: e.name,
    type: (e.subtype ?? e.types?.[0] ?? e.type ?? "").replace("urn:entity:", ""),
    affinity: e.query?.affinity,
    popularity: e.popularity,
    description: p.short_description ?? p.description,
    address: p.address,
    city: p.geocode?.city,
    image: p.image?.url ?? p.images?.[0]?.url,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tags: (e.tags ?? []).slice(0, 8).map((t: any) => t.name),
  };
}

export async function searchEntities(query: string, type?: EntityType, take = 5) {
  const data = (await qlooGet("/search", {
    query,
    types: type ? `urn:entity:${type}` : undefined,
    take,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;
  return (data.results ?? []).map(toCard) as EntityCard[];
}

export async function searchTags(query: string, take = 8) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await qlooGet("/v2/tags", { "filter.query": query, take })) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results?.tags ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    applies_to: (t.parents ?? []).map((p: { type: string }) => p.type.replace("urn:entity:", "")),
  }));
}

export interface InsightsQuery {
  type: EntityType;
  seedEntityIds?: string[];
  seedTagIds?: string[];
  requiredTagIds?: string[];
  location?: string;
  take?: number;
}

export async function getRecommendations(q: InsightsQuery) {
  const data = (await qlooGet("/v2/insights", {
    "filter.type": `urn:entity:${q.type}`,
    "signal.interests.entities": q.seedEntityIds?.join(","),
    "signal.interests.tags": q.seedTagIds?.join(","),
    "filter.tags": q.requiredTagIds?.join(","),
    "filter.location.query": q.location,
    take: q.take ?? 6,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;
  return (data.results?.entities ?? []).map(toCard) as EntityCard[];
}

export async function getAudienceDemographics(entityIds: string[]) {
  const data = (await qlooGet("/v2/insights", {
    "filter.type": "urn:demographics",
    "signal.interests.entities": entityIds.join(","),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;
  return data.results?.demographics ?? [];
}
