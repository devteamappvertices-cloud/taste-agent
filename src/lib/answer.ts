import type { EntityCard } from "./qloo";
import { franchise } from "./categories.ts";

/** Whole-name match, so a film called "Pi" doesn't match the word "picks". */
export function mentions(text: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(text);
}

/**
 * Qloo entities the agent recommends, best match first. The agent bolds each pick's exact name, so
 * only bolded names count: a title named inside another pick's reason ("like the serious side of
 * Digimon Tamers") is not a pick. Two versions of one title (Astro Boy 1963 and 2003) show once.
 */
export function picks(t: { text: string; entities: EntityCard[] }) {
  const bold = [...t.text.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]);
  const seen = new Set<string>();
  return t.entities
    .filter((e) => (bold.length ? bold.some((b) => mentions(b, e.name)) : mentions(t.text, e.name)))
    .sort((a, b) => (b.affinity ?? -1) - (a.affinity ?? -1))
    .filter((e) => !seen.has(e.name.toLowerCase()) && !!seen.add(e.name.toLowerCase()));
}

/** Instant results skip the favorite's own franchise, which they already know. */
export function outsideFranchise(list: EntityCard[], seeds: EntityCard[]) {
  const keys = seeds.map((s) => franchise(s.name)).filter((k): k is string => !!k);
  return list.filter((e) => !keys.some((k) => mentions(e.name, k)));
}

const BULLET = /^\s*(?:[-*•]|\d+\.)\s+/;

/** The agent answers "one sentence, then `- **Name** reason` bullets"; cards carry the bullets. */
export function splitAnswer(text: string) {
  const lines = text.split("\n");
  const bullets = lines.filter((l) => BULLET.test(l)).map((l) => l.replace(BULLET, ""));
  const summary = lines.filter((l) => !BULLET.test(l)).join("\n").trim();
  return { summary, bullets };
}

/** The agent's one-line reason for a pick, without the bold name. */
export function reasonFor(bullets: string[], name: string) {
  const line = bullets.find((b) => mentions(b.match(/\*\*(.+?)\*\*/)?.[1] ?? b, name));
  return line
    ?.replace(/\*\*(.+?)\*\*/, "")
    .replace(/^[\s:,.\-–—]+/, "")
    .replace(/\*/g, "")
    .trim();
}
