# Taste Agent

An AI agent (Claude Opus 5.5) that grounds every recommendation in [Qloo](https://qloo.com)'s cultural taste graph.
It resolves what you love into Qloo entities, then uses Qloo Insights to find cross-domain matches
(music + film taste → restaurants, destinations, podcasts, brands…).

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in QLOO_API_KEY and ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000. `GET /api/health` checks that both keys are configured.

## How it works

- `src/lib/qloo.ts` – Qloo client (`/search`, `/v2/tags`, `/v2/insights`) with in-memory caching.
- `src/lib/agent.ts` – Claude tool-use loop exposing Qloo as four tools; streams events to the UI.
- `src/app/api/chat/route.ts` – streaming NDJSON endpoint with a simple per-IP rate limit.
- `src/app/page.tsx` – chat UI showing each Qloo call and the entities it returned.

## Deploy

Push to GitHub, import the repo in Vercel, and set `QLOO_API_URL`, `QLOO_API_KEY` and `ANTHROPIC_API_KEY`
as environment variables.

## License

MIT
