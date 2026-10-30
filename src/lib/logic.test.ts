// Unit tests for the pure logic: run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanQuery, franchise, CATEGORIES } from "./categories.ts";
import { mentions, outsideFranchise, picks, reasonFor, splitAnswer } from "./answer.ts";
import { readMessage } from "./message.ts";
import type { EntityCard } from "./qloo";

const card = (name: string, affinity = 0.9, type = "movie"): EntityCard => ({ id: name, name, type, affinity, tags: [] });

test("cleanQuery strips sentence filler from a typed favorite", () => {
  assert.equal(cleanQuery("I love 3 idiots movie!"), "3 idiots");
  assert.equal(cleanQuery("my partner loves Barbie"), "Barbie");
  assert.equal(cleanQuery("my best friend likes Morgan Wallen"), "Morgan Wallen");
  assert.equal(cleanQuery("My favourite band is Coldplay"), "Coldplay");
  assert.equal(cleanQuery("my favorite movie is interstellar"), "interstellar");
  assert.equal(cleanQuery("we both love The Office"), "The Office");
  assert.equal(cleanQuery("The Office"), "The Office");
});

test("franchise finds the word that ties a series together", () => {
  assert.equal(franchise("Digimon Adventure 02"), "digimon");
  assert.equal(franchise("The Office"), "office");
  assert.equal(franchise("Oppenheimer"), "oppenheimer");
});

test("mentions matches whole names only", () => {
  assert.ok(mentions("Start with **Pi** tonight", "Pi"));
  assert.ok(!mentions("these picks are great", "Pi"));
  assert.ok(mentions("i loved dune: part two", "Dune: Part Two"));
});

test("picks keeps only bolded names, best match first, one per title", () => {
  const text = [
    "You both like smart blockbusters.",
    "- **Medabots** Robots and friendship.",
    "- **Yu-Gi-Oh!** Like the serious side of Digimon Tamers.",
    "- **Astro Boy** Big heart.",
  ].join("\n");
  const entities = [card("Digimon Tamers", 0.99), card("Yu-Gi-Oh!", 0.9), card("Medabots", 0.95), card("Astro Boy", 0.8), card("Astro Boy", 0.85)];
  const got = picks({ text, entities });
  assert.deepEqual(got.map((e) => e.name), ["Medabots", "Yu-Gi-Oh!", "Astro Boy"]);
  assert.equal(got[2].affinity, 0.85, "keeps the better-matching version");
});

test("picks falls back to plain mentions when nothing is bolded", () => {
  assert.deepEqual(picks({ text: "Try Moon tonight.", entities: [card("Moon"), card("Sun")] }).map((e) => e.name), ["Moon"]);
});

test("outsideFranchise hides the favorite's own series from instant results", () => {
  const list = [card("Digimon Tamers"), card("Monster Rancher"), card("Digimon Frontier")];
  assert.deepEqual(outsideFranchise(list, [card("Digimon Adventure")]).map((e) => e.name), ["Monster Rancher"]);
});

test("splitAnswer and reasonFor separate the summary from per-pick reasons", () => {
  const text = "Your tastes meet in moody pop.\n- **The Weeknd**: late-night R&B for you, hooks for her.\nStart with The Weeknd.";
  const { summary, bullets } = splitAnswer(text);
  assert.equal(summary, "Your tastes meet in moody pop.\nStart with The Weeknd.");
  assert.equal(reasonFor(bullets, "The Weeknd"), "late-night R&B for you, hooks for her.");
});

test("readMessage reads favorites, category and city from a typed message", () => {
  const two = readMessage("I love Oppenheimer and my partner loves Barbie. What should we watch tonight?");
  assert.deepEqual(two.names, ["Oppenheimer", "Barbie"]);
  assert.equal(two.want?.type, "movie");

  const food = readMessage("I love The Office. Where should we eat in New York?");
  assert.deepEqual(food.names, ["The Office"]);
  assert.equal(food.want?.type, "place");
  assert.equal(food.location, "New York");

  const comma = readMessage("My wife loves Taylor Swift and I like Drake, which artists would we both like?");
  assert.deepEqual(comma.names, ["Taylor Swift", "Drake"]);
  assert.equal(comma.want?.type, "artist");

  const tv = readMessage("I love 3 idiots movie suggest me tv shows");
  assert.deepEqual(tv.names, ["3 idiots"]);
  assert.equal(tv.want?.type, "tv_show");
});

test("readMessage: a picked category wins over words in the message", () => {
  const books = CATEGORIES.find((c) => c.key === "books");
  assert.equal(readMessage("I love Interstellar, what should I watch?", books).want?.type, "book");
});

test("readMessage returns nothing usable for unclear messages", () => {
  const r = readMessage("hello there");
  assert.deepEqual(r.names, []);
  assert.equal(r.want, undefined);
});
