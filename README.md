<img src="public/logo-512.png" alt="" width="72" align="left">

# Taste Agent

**Live demo: https://taste-agent-omega.vercel.app** (no login needed; an optional free account saves your chats)

**Find what you'll both love.** Taste Agent helps couples, friends and families with different tastes agree on
what to watch, where to eat, what to play on a road trip and where to travel. Tell it what each of you likes,
in your own words ("I love Oppenheimer, my partner loves Barbie. What should we watch?"). An AI agent
(Claude Opus 5.5) resolves every person's favorites in [Qloo](https://qloo.com)'s taste graph of 250 million
titles, places and brands, and ranks picks where your tastes overlap, with a match score and a reason it
works for each of you. It works for one person too.

## The problem

"What should we watch?" and "where should we eat?" are the questions two people with different tastes argue
about every week. Streaming and review apps recommend for one profile at a time, and a plain chatbot answers
from memory: it lists the same famous titles for everyone and invents places. Groups end up scrolling,
compromising on something neither person loves, or giving up.

Taste Agent answers from real taste data instead. Qloo knows which movies, shows, artists, restaurants and
destinations are loved by people who like *both* of your favorites, even across categories: a movie lover
and a Taylor Swift fan can get a dinner spot in New York that suits them both.

## What makes it Qloo-powered

- **Every pick comes from Qloo, not the model's memory.** The agent resolves your favorites to Qloo entities,
  then calls Qloo Insights to rank matches by taste affinity. Cards only show Qloo entities, and
  "How these were found" lists every Qloo call.
- **Results in about a second.** The app reads the favorite and category from your message, resolves it with
  Qloo search and shows Qloo Insights matches straight away, while the agent picks and explains the best ones.
- **Blended taste.** Every person's favorites go to Qloo Insights together as signals, so the ranking favors
  what sits where your tastes overlap, not what suits only one of you.
- **Shows how each pick balances your tastes.** Qloo explainability scores how much each person's favorite drove
  a match, so every card shows a split such as "Oppenheimer 49% · Barbie 51%".
- **What you have in common.** Qloo's compare analysis lists the tastes your favorites share, right above the picks.
- **Less mainstream, for real.** "Less mainstream" and "hidden gems" set Qloo's popularity cap instead of
  relying on the model's guess.
- **Cross-domain taste.** A movie or artist you love predicts restaurants, destinations, podcasts and brands.
  "Explore beyond" carries the same taste profile into every other category.
- **Constraints the way Qloo models them:** tag filters (for example restaurants only), location for places,
  and Qloo tags shared by your matches become one-tap refinements.
- **Exact places.** Restaurant links open the right spot in Google Maps using Qloo's Google place ID and
  coordinates, and city names like "New York" resolve to the city, not the state.

## Features

- Chat-style start: type what each of you loves and what you want, or tap an example (movie night for two,
  date night dinner in New York, a show to binge together, road trip music for friends); voice input works too
- Taste profile chips showing which Qloo entities the picks are based on
- Poster grid of ranked matches with Qloo affinity, year, tags and the agent's one-line reason
- Detail page with "Why this matches you", a trailer, Spotify or Maps link, and "You might also like" from Qloo
- Optional "What should I find?" chips (movies, music, food, travel, TV, books, podcasts, brands) and a city box for food
- Follow-ups to refine ("More like these", "Less mainstream", "Cheaper options", "other than X") in the same conversation;
  the agent skips your favorites' own franchise and anything you exclude
- Show all / show less for results, Back buttons, and the browser's Back button steps detail, results, start
- Optional account (Google, or email and password with password reset): chats save to Firestore and appear in a
  sidebar, a heart on any match saves it to your favorites (signed-out users are asked to log in first), and the
  start screen suggests "More like ..." from your past searches
- Works on phones and desktops; keyboard and screen-reader friendly

## Try it in 30 seconds

1. Open the live demo and tap **Movie night for two**.
2. Matches appear within seconds; each card shows how it balances both favorites ("Oppenheimer 49% · Barbie 51%").
3. Tap **Less mainstream**, then open a card for "Why this matches you" and "You might also like".
4. Go back and try **Date night dinner in New York**: every place opens at its exact Google Maps location.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in QLOO_API_KEY and ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000. `GET /api/health` checks that both keys are configured.

## Tests

```bash
npm test             # unit tests: message parsing, pick selection, franchise and exclusion rules
npm run eval         # end-to-end: API checks, then real agent answers to 13 varied prompts, scored
npm run eval -- https://taste-agent-omega.vercel.app --api-only   # quick check of the live site
```

The end-to-end run checks, among other things, that picks are real Qloo entities of the requested type,
favorites and excluded titles never come back, two people's favorites are blended in one Qloo query,
"less mainstream" uses Qloo's popularity cap, and restaurants are in the city asked for.

## How it works

- `src/lib/qloo.ts` – Qloo client (`/search`, `/v2/tags`, `/v2/insights` with explainability, `/v2/analysis/compare`)
  with in-memory caching and retries that honor `Retry-After` on rate limits.
- `src/lib/agent.ts` – Claude tool-use loop exposing Qloo as four tools; streams events to the UI.
- `src/app/api/chat/route.ts` – streaming NDJSON endpoint with a simple per-IP rate limit.
- `src/app/api/search/route.ts` – Qloo search that turns typed text ("I love 3 idiots") into the right entity.
- `src/app/api/common/route.ts` – "What you have in common" via Qloo compare.
- `src/app/api/explore/route.ts` – direct Qloo Insights for instant results, "Explore beyond" and "You might also like".
- `src/lib/message.ts`, `src/lib/answer.ts` – reading a typed message, and choosing which titles in the answer are picks.
- `src/lib/firebase.ts` – optional sign-in (Google, email and password) and saved chats in Firestore.
- `src/app/page.tsx`, `src/components/` – chat start screen, conversation, match cards, detail page and sidebar.

## Deploy

The Vercel project is connected to this GitHub repo, so every push to `main` deploys to production.
To deploy your own copy, import the repo in Vercel and set `QLOO_API_URL`, `QLOO_API_KEY` and
`ANTHROPIC_API_KEY` as environment variables.

## License

MIT
