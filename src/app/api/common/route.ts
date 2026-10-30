import { compareTastes } from "@/lib/qloo";
import { clientIp, rateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";

const ID = /^[0-9A-F-]{36}$/i;

// "What you have in common": Qloo compare between two people's favorites.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const a = params.get("a") ?? "";
  const b = params.get("b") ?? "";
  if (!ID.test(a) || !ID.test(b) || a === b) return Response.json({ error: "Invalid ids." }, { status: 400 });
  if (rateLimited(`common:${clientIp(req)}`, 30)) {
    return Response.json({ error: "Too many requests, try again in a minute." }, { status: 429 });
  }
  try {
    return Response.json({ tags: (await compareTastes([a], [b])).slice(0, 5) });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Qloo is unavailable right now." }, { status: 502 });
  }
}
