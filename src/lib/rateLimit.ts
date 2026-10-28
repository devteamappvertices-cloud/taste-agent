// Naive in-memory per-IP limiter so a public demo can't drain the API budget.
const buckets = new Map<string, number[]>();

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export function rateLimited(key: string, perMinute: number) {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  buckets.set(key, recent);
  return recent.length > perMinute;
}
