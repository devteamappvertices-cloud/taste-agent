import { searchEntities } from "@/lib/qloo";

export const runtime = "nodejs";

// Confirms both keys are configured and Qloo is reachable.
export async function GET() {
  let qloo: string;
  try {
    const r = await searchEntities("Radiohead", "artist", 1);
    qloo = r.length ? `ok (${r[0].name})` : "ok (no results)";
  } catch (err) {
    qloo = err instanceof Error ? err.message : "error";
  }
  return Response.json({ qloo, anthropic: process.env.ANTHROPIC_API_KEY ? "configured" : "missing" });
}
