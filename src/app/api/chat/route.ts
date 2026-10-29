import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { runAgent, type AgentEvent } from "@/lib/agent";
import { runDemo } from "@/lib/demo";
import { clientIp, rateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(30),
});

export async function POST(req: Request) {
  // Local UI testing only: replays made-up results without calling Claude or Qloo.
  const demo = process.env.NODE_ENV !== "production" && req.headers.get("x-demo") === "1";
  if (!demo && !process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not configured on the server." }, { status: 503 });
  }
  if (rateLimited(`chat:${clientIp(req)}`, 12)) {
    return Response.json({ error: "Too many searches in a minute. Wait a moment, then try again." }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request body." }, { status: 400 });

  const history: Anthropic.Beta.BetaMessageParam[] = parsed.data.messages;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        if (demo) await runDemo(parsed.data.messages.at(-1)!.content, emit);
        else await runAgent(history, emit);
      } catch (err) {
        const message =
          err instanceof Anthropic.APIError ? `Model API error (${err.status})` : err instanceof Error ? err.message : "Unknown error";
        console.error(err);
        emit({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
