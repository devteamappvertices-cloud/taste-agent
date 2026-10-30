import { searchEntities, type EntityCard, type EntityType } from "@/lib/qloo";
import { cleanQuery } from "@/lib/categories";
import { clientIp, rateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Things people name as favorites; places, albums and localities mostly add noise here.
const FAVORITE_TYPES: EntityType[] = ["movie", "tv_show", "artist", "book", "podcast", "brand", "destination"];

const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Keep results where every typed word starts a word in the name ("3 idiot" -> "3 Idiots"), most popular first. */
function rank(found: EntityCard[], q: string) {
  const typed = words(q);
  const matches = found.filter((e) => {
    const name = words(e.name);
    return typed.every((t) => name.some((n) => n.startsWith(t)));
  });
  return (matches.length ? matches : found).sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}

// Autocomplete for "Type a favorite": Qloo entities matching a typed name.
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (raw.length > 80) return Response.json({ error: "Query too long." }, { status: 400 });
  const q = cleanQuery(raw);
  if (q.length < 2) return Response.json({ results: [] });
  if (rateLimited(`search:${clientIp(req)}`, 90)) {
    return Response.json({ error: "Too many requests, try again in a minute." }, { status: 429 });
  }
  try {
    const found = await searchEntities(q, FAVORITE_TYPES, 20);
    // Qloo can return the same entity, or same-named variants, more than once.
    const seen = new Set<string>();
    const results = rank(found, q)
      .filter((e) => {
        const key = `${e.name.toLowerCase()}|${e.type}`;
        if (seen.has(e.id) || seen.has(key)) return false;
        seen.add(e.id).add(key);
        return true;
      })
      .slice(0, 6)
      .map(({ id, name, type, image, city }) => ({ id, name, type, image, city }));
    return Response.json({ results });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Search is unavailable right now." }, { status: 502 });
  }
}
