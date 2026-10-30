// End-to-end checks against a running app: API smoke tests, then real agent answers to varied
// prompts, each scored automatically. Usage: node scripts/eval.mjs [baseUrl] [--api-only]
// Default baseUrl is http://localhost:3000. Agent cases call Qloo and Claude, so they take a few minutes.

const BASE = (process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3000").replace(/\/$/, "");
const API_ONLY = process.argv.includes("--api-only");
// --only=word runs just the agent cases whose name contains that word (and skips the API checks).
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7).toLowerCase();
const FOOD = /restaurant|caf[eé]|\bbar\b|bistro|diner|pizz|kitchen|eatery|grill|bakery|coffee|food|dining|brunch|tavern|pub\b/i;

const OPPENHEIMER = "470553FA-42AD-435D-94BE-1078AFD6A2FD";
const BARBIE = "BAF6FB9E-7E2E-4008-944B-97C0CF430D41";
const OFFICE = "E5AE1F26-04CB-4CDD-BBA4-87FB6541F848";
const RESTAURANT = "urn:tag:genre:place:restaurant";

let failed = 0;
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? "  ✔" : "  ✖"} ${name}${detail ? `  (${detail})` : ""}`);
}

async function getJson(path) {
  const res = await fetch(BASE + path);
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ---------- API smoke tests ----------
async function apiTests() {
  console.log("\nAPI");
  const health = await getJson("/api/health");
  check("health: Qloo and Anthropic configured", health.status === 200 && /^ok/.test(health.body?.qloo) && health.body?.anthropic === "configured");

  const search = await getJson(`/api/search?q=${encodeURIComponent("I love 3 idiot")}`);
  check("search: sentence 'I love 3 idiot' finds the movie first", search.body?.results?.[0]?.name === "3 Idiots", search.body?.results?.[0]?.name);

  const taylor = await getJson("/api/search?q=taylor");
  check("search: 'taylor' ranks Taylor Swift first", taylor.body?.results?.[0]?.name === "Taylor Swift", taylor.body?.results?.[0]?.name);

  const long = await getJson(`/api/search?q=${"x".repeat(81)}`);
  check("search: rejects queries over 80 characters", long.status === 400);

  const movies = await getJson(`/api/explore?type=movie&ids=${OPPENHEIMER},${BARBIE}`);
  const list = movies.body?.results ?? [];
  check("explore: blended movies come back", list.length >= 5, `${list.length} results`);
  check("explore: never returns the favorites themselves", !list.some((e) => e.id === OPPENHEIMER || e.id === BARBIE));
  check("explore: explainability splits each match across both favorites", list.every((e) => (e.explain ?? []).length === 2));

  const ny = await getJson(`/api/explore?type=place&ids=${OFFICE}&loc=New%20York&tag=${encodeURIComponent(RESTAURANT)}`);
  const places = ny.body?.results ?? [];
  check(
    "explore: 'New York' restaurants are in New York City, not the state",
    places.length > 0 && places.every((p) => /New York|Brooklyn|Queens|Bronx|Staten Island|, NY 1[01]\d{3}/.test(`${p.city} ${p.address}`)),
    places.map((p) => p.city).join(", "),
  );
  check("explore: places carry a Google place ID for exact map links", places.every((p) => p.placeId));

  const bad = await getJson("/api/explore?type=spaceship&ids=nope");
  check("explore: rejects unknown types and malformed ids", bad.status === 400);

  const common = await getJson(`/api/common?a=${OPPENHEIMER}&b=${BARBIE}`);
  check("common: shared tastes for two favorites", Array.isArray(common.body?.tags) && common.body.tags.length > 0, common.body?.tags?.join(", "));
  const same = await getJson(`/api/common?a=${OPPENHEIMER}&b=${OPPENHEIMER}`);
  check("common: rejects comparing a favorite with itself", same.status === 400);
}

// ---------- Agent answers ----------
async function ask(messages) {
  const started = Date.now();
  const res = await fetch(BASE + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  const run = { text: "", calls: [], entities: [], error: res.ok ? undefined : `HTTP ${res.status}` };
  if (!res.ok) return run;
  const raw = await res.text();
  for (const line of raw.split("\n").filter(Boolean)) {
    const e = JSON.parse(line);
    // Like the UI: text written before a tool call is a working note, so only the last stretch is the answer.
    if (e.type === "text") run.text += e.delta;
    else if (e.type === "tool_call") {
      run.calls.push(e);
      run.text = "";
    } else if (e.type === "tool_result" && e.name === "get_recommendations") run.entities.push(...(e.entities ?? []));
    else if (e.type === "error") run.error = e.message;
  }
  run.seconds = Math.round((Date.now() - started) / 1000);
  // Same rule as the app: bolded names that match recommended entities.
  const bold = [...run.text.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1].toLowerCase());
  const seen = new Set();
  run.picks = run.entities.filter((e) => bold.some((b) => b.includes(e.name.toLowerCase())) && !seen.has(e.name) && seen.add(e.name));
  return run;
}

async function agentCase(c, history = []) {
  console.log(`\n${c.name}\n  “${c.prompt}”`);
  const run = await ask([...history, { role: "user", content: c.prompt }]);
  const names = run.picks.map((p) => p.name);
  check("answers without errors", !run.error && run.text.length > 40, run.error ?? `${run.seconds}s`);
  if (c.expectPicks !== false) check("recommends at least 3 Qloo titles", run.picks.length >= 3, names.join(" | "));
  if (c.type) check(`every pick is a ${c.type}`, run.picks.every((p) => c.type.includes(p.type)), [...new Set(run.picks.map((p) => p.type))].join(", "));
  if (c.banned)
    check(
      `leaves out ${c.banned.join(", ")}`,
      !run.picks.some((p) => c.banned.some((b) => p.name.toLowerCase().includes(b.toLowerCase()))),
      names.filter((n) => c.banned.some((b) => n.toLowerCase().includes(b.toLowerCase()))).join(", "),
    );
  if (c.food) {
    const notFood = run.picks.filter((p) => !FOOD.test(`${p.name} ${p.description ?? ""} ${p.tags.join(" ")}`));
    check("every place serves food or drinks", notFood.length === 0, notFood.map((p) => p.name).join(", "));
  }
  if (c.city) check(`places are in ${c.city.source}`, run.picks.every((p) => c.city.test(`${p.city} ${p.address}`)), run.picks.map((p) => p.city).join(", "));
  if (c.blend) {
    const most = Math.max(0, ...run.calls.filter((t) => t.name === "get_recommendations").map((t) => t.input?.seed_entity_ids?.length ?? 0));
    check("blends both people's favorites in one Qloo query", most >= 2, `${most} seeds`);
  }
  if (c.popularityCap)
    check("uses Qloo's popularity cap", run.calls.some((t) => t.name === "get_recommendations" && t.input?.max_popularity !== undefined));
  check("answers in under 45 seconds", (run.seconds ?? 99) < 45, `${run.seconds}s`);
  return run;
}

const CASES = [
  { name: "Single favorite, same category", prompt: "I love Interstellar. What should I watch next?", type: ["movie"], banned: ["Interstellar"] },
  { name: "Typo in the favorite", prompt: "i love intersteller what should i watch", type: ["movie"], banned: ["Interstellar"] },
  {
    name: "Two people, movie night",
    prompt: "I love Oppenheimer and my partner loves Barbie. What should we watch tonight?",
    type: ["movie"],
    banned: ["Oppenheimer", "Barbie"],
    blend: true,
  },
  {
    name: "Two people, less mainstream",
    prompt: "I love Oppenheimer and my partner loves Barbie. Less mainstream movies we would both like?",
    type: ["movie"],
    blend: true,
    popularityCap: true,
  },
  {
    name: "Friends, road trip music (US + Canada)",
    prompt: "I love Drake and my friend loves Morgan Wallen. Which artists would we both like?",
    type: ["artist"],
    banned: ["Drake", "Morgan Wallen"],
    blend: true,
  },
  {
    name: "Cross-domain: music fan wants books",
    prompt: "I love Taylor Swift. Which books would I like?",
    type: ["book"],
    banned: ["Panama Papers", "WeWork", "Enron", "Facebook"],
  },
  { name: "Podcasts", prompt: "I enjoyed Atomic Habits. Which podcasts would I like?", type: ["podcast"] },
  {
    name: "Date night dinner, New York",
    prompt: "I love The Office and my partner loves Taylor Swift. Where should we eat in New York?",
    type: ["place"],
    city: /New York|Brooklyn|Queens|Bronx|, NY 1[01]\d{3}/,
    food: true,
    blend: true,
  },
  { name: "Dinner in Toronto", prompt: "We both love Schitt's Creek. Where should we eat in Toronto?", type: ["place"], city: /Toronto|, ON M/, food: true },
  { name: "Travel", prompt: "We loved Kyoto and Studio Ghibli. Where should we travel next?", type: ["destination", "place"] },
  { name: "Off-topic message stays helpful", prompt: "hi", expectPicks: false },
];

async function main() {
  console.log(`Taste Agent checks against ${BASE}`);
  if (!ONLY) await apiTests();
  if (!API_ONLY) {
    for (const c of CASES) if (!ONLY || c.name.toLowerCase().includes(ONLY)) await agentCase(c);
    if (ONLY && !"franchise follow-up exclusion".includes(ONLY)) return finish();

    // Franchise and follow-up exclusions, as in the bug report video.
    const first = await agentCase({
      name: "Favorite's own franchise is skipped",
      prompt: "i love digimon what can i watch. Show me TV shows.",
      type: ["tv_show"],
      banned: ["Digimon"],
    });
    const excluded = first.picks.slice(0, 2).map((p) => p.name);
    if (excluded.length === 2)
      await agentCase(
        { name: "Follow-up exclusion is respected", prompt: `other than ${excluded.join(" and ")}`, banned: [...excluded, "Digimon"] },
        [
          { role: "user", content: "i love digimon what can i watch. Show me TV shows." },
          { role: "assistant", content: first.text },
        ],
      );
  }
  finish();
}

function finish() {
  const passed = results.length - failed;
  console.log(`\n${passed}/${results.length} checks passed`);
  // exitCode, not exit(): exiting with fetch sockets still open crashes Node on Windows.
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
