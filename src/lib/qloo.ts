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
  year?: number;
  lat?: number;
  lon?: number;
  /** Google Maps place ID, for an exact map link. */
  placeId?: string;
  /** Qloo explainability: how much each seed entity contributed to this match (scores sum to 1). */
  explain?: { id: string; score: number }[];
  tags: string[];
}

// Readable tags first (Qloo's own, genres, cuisines), plot keywords after; drop
// Wikipedia categories and bare numbers/age bands.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanTags(tags: any[]) {
  const rank = (type: string) => (String(type).endsWith(":media") ? 1 : 0);
  const names = tags
    .filter((t) => !String(t.type).endsWith("wikipedia_category") && !/^[\d\s+-]+$/.test(t.name))
    .sort((a, b) => rank(a.type) - rank(b.type))
    .map((t) => String(t.name));
  return [...new Set(names)].slice(0, 8);
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

  // Rate limits and blips: honor Retry-After, else back off 0.5s, 1s with jitter. Capped so a
  // request still fits the serverless time limit.
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(url, { headers: { "X-Api-Key": key } });
    const retryable = res.status === 429 || res.status === 502 || res.status === 503;
    if (!retryable || attempt === 2) break;
    const after = Number(res.headers.get("retry-after"));
    const wait = after > 0 ? Math.min(after * 1000, 5000) : 500 * 2 ** attempt + Math.random() * 300;
    await new Promise((r) => setTimeout(r, wait));
  }
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
    year: p.release_year ?? p.publication_year,
    lat: e.location?.lat,
    lon: e.location?.lon,
    placeId: (e.external ?? p.external)?.google_place?.[0]?.place_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    explain: e.query?.explainability?.["signal.interests.entities"]?.map((x: any) => ({ id: x.entity_id, score: x.score })),
    tags: cleanTags(e.tags ?? []),
  };
}

export async function searchEntities(query: string, type?: EntityType | EntityType[], take = 5) {
  const types = [type ?? []].flat();
  const data = (await qlooGet("/search", {
    query,
    types: types.map((t) => `urn:entity:${t}`).join(",") || undefined,
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

// Qloo reads "New York" as the state, so restaurants came back from Oswego and Gerry, NY.
const CITY_ALIASES: Record<string, string> = {
  "new york": "New York City",
  "new york, ny": "New York City",
  nyc: "New York City",
  ny: "New York City",
  la: "Los Angeles",
  sf: "San Francisco",
  dc: "Washington DC",
  washington: "Washington DC",
  "washington, dc": "Washington DC",
};

export interface InsightsQuery {
  type: EntityType;
  seedEntityIds?: string[];
  seedTagIds?: string[];
  requiredTagIds?: string[];
  location?: string;
  /** 0-1 popularity percentile cap, for "less mainstream" picks. */
  maxPopularity?: number;
  take?: number;
}

export async function getRecommendations(q: InsightsQuery) {
  const data = (await qlooGet("/v2/insights", {
    "filter.type": `urn:entity:${q.type}`,
    "signal.interests.entities": q.seedEntityIds?.join(","),
    "signal.interests.tags": q.seedTagIds?.join(","),
    "filter.tags": q.requiredTagIds?.join(","),
    "filter.location.query": q.location && (CITY_ALIASES[q.location.trim().toLowerCase()] ?? q.location),
    "filter.popularity.max": q.maxPopularity,
    "feature.explainability": "true",
    take: q.take ?? 6,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any[] = data.results?.entities ?? [];
  const cards = raw.map(toCard);
  if (q.type !== "destination") return cards;
  // Qloo has no photos for destinations; borrow each one's lead photo from Wikipedia.
  return Promise.all(
    cards.map(async (c, i) => (c.image ? c : { ...c, image: await destinationPhoto(c.name, raw[i].properties?.geocode?.admin1_region) })),
  );
}

const photos = new Map<string, Promise<string | undefined>>();
// Lead images that are flags, seals or maps make poor travel photos.
const NOT_A_PHOTO = /\.svg$|flag|seal|coat_of_arms|locator|map/i;

function destinationPhoto(name: string, region?: string) {
  const key = `${name}|${region ?? ""}`;
  if (!photos.has(key)) {
    const qs = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: `${name} ${region ?? ""}`.trim(),
      gsrlimit: "1",
      prop: "pageimages",
      piprop: "thumbnail|name",
      pithumbsize: "640",
    });
    photos.set(
      key,
      fetch(`https://en.wikipedia.org/w/api.php?${qs}`, {
        headers: { "User-Agent": "TasteAgent/1.0 (https://taste-agent-omega.vercel.app)" },
        signal: AbortSignal.timeout(3000),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => {
          const page = Object.values(body?.query?.pages ?? {})[0] as { pageimage?: string; thumbnail?: { source?: string } } | undefined;
          return page?.pageimage && !NOT_A_PHOTO.test(page.pageimage) ? page.thumbnail?.source : undefined;
        })
        .catch(() => undefined),
    );
  }
  return photos.get(key)!;
}

export async function getAudienceDemographics(entityIds: string[]) {
  const data = (await qlooGet("/v2/insights", {
    "filter.type": "urn:demographics",
    "signal.interests.entities": entityIds.join(","),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;
  return data.results?.demographics ?? [];
}

/** Qloo's compare: tastes two sets of favorites share, strongest first. */
export async function compareTastes(a: string[], b: string[], take = 20) {
  const data = (await qlooGet("/v2/analysis/compare", {
    "a.signal.interests.entities": a.join(","),
    "b.signal.interests.entities": b.join(","),
    take,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return [...new Set<string>((data.results?.tags ?? []).map((t: any) => String(t.name).replace(/[,.;]+$/, "")))];
}
