import { ENTITY_TYPES, getRecommendations, type EntityType } from "@/lib/qloo";
import { clientIp, rateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";

const ID = /^[0-9A-F-]{36}$/i;
const TAG = /^urn:tag:[\w:.-]{1,120}$/;

// Direct Qloo Insights for instant first results, "Explore beyond" and "You might also like":
// no LLM in the loop, so these load in about a second.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const type = params.get("type") as EntityType;
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean);
  const location = params.get("loc")?.trim() || undefined;
  const tag = params.get("tag") || undefined;
  if (
    !ENTITY_TYPES.includes(type) ||
    ids.length === 0 ||
    ids.length > 5 ||
    !ids.every((i) => ID.test(i)) ||
    (location?.length ?? 0) > 80 ||
    (tag !== undefined && !TAG.test(tag))
  ) {
    return Response.json({ error: "Invalid type or ids." }, { status: 400 });
  }
  if (rateLimited(`explore:${clientIp(req)}`, 60)) {
    return Response.json({ error: "Too many requests, try again in a minute." }, { status: 429 });
  }
  try {
    const found = await getRecommendations({ type, seedEntityIds: ids, location, requiredTagIds: tag ? [tag] : undefined, take: 10 });
    return Response.json({ results: found.filter((e) => !ids.includes(e.id)).slice(0, 8) });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Qloo is unavailable right now." }, { status: 502 });
  }
}
