# Taste Agent

**Live demo: https://taste-agent-omega.vercel.app** (no login needed)

Find movies, music, food and places that fit your taste. Tell Taste Agent a few things you already love;
an AI agent (Claude Opus 5.5) searches [Qloo](https://qloo.com)'s taste graph of 250 million titles,
places and brands, and ranks what matches you in any category, with a match score and a reason for each pick.

## What makes it Qloo-powered

- **Every pick comes from Qloo, not the model's memory.** The agent resolves your favorites to Qloo entities,
  then calls Qloo Insights to rank matches by taste affinity. The UI shows each Qloo call and its results.
- **Cross-domain taste.** Music and film favorites predict restaurants, destinations, podcasts and brands.
- **Autocomplete from Qloo search**, so favorites map to exact Qloo entity IDs and the agent can skip lookups.
- **Constraints the way Qloo models them:** tag filters (cuisine, ambience, genre) and location for places.

## Features

- Guided search (pick favorites + a category) or free-text questions, with voice input
- Taste profile chips showing which Qloo entities the picks are based on
- Ranked matches with Qloo affinity, descriptions, tags and a Google Maps link for places
- Follow-ups to refine ("More like these", "Less mainstream") and a one-screen layout on desktop

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
- `src/app/api/search/route.ts` – Qloo-backed autocomplete for favorites.
- `src/app/page.tsx`, `src/components/` – start screen, conversation and match panes.

## Deploy

The Vercel project is connected to this GitHub repo, so every push to `main` deploys to production.
To deploy your own copy, import the repo in Vercel and set `QLOO_API_URL`, `QLOO_API_KEY` and
`ANTHROPIC_API_KEY` as environment variables.

## License

MIT
