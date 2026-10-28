import { searchEntities } from "@/lib/qloo";
import { clientIp, rateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Autocomplete for "What do you love?": Qloo entities matching a typed name.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ results: [] });
  if (q.length > 80) return Response.json({ error: "Query too long." }, { status: 400 });
  if (rateLimited(`search:${clientIp(req)}`, 90)) {
    return Response.json({ error: "Too many requests, try again in a minute." }, { status: 429 });
  }
  try {
    const found = await searchEntities(q, undefined, 10);
    // Qloo can return the same entity, or same-named variants, more than once.
    const seen = new Set<string>();
    const results = found
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
