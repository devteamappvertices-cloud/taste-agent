import { CATEGORIES, cleanQuery, type Category } from "./categories.ts";

// What they want, read from the message. Order matters: "where should we eat" beats "watch".
const WANTS: [RegExp, string][] = [
  [/\b(restaurants?|eat|food|dinner|lunch|brunch|caf[eé]s?)\b/i, "food"],
  [/\bpodcasts?\b/i, "podcasts"],
  [/\b(books?|read|novels?)\b/i, "books"],
  [/\b(tv|shows?|series|binge)\b/i, "tv"],
  [/\b(movies?|films?|watch)\b/i, "movies"],
  [/\b(music|artists?|singers?|bands?|songs?|listen|playlist)\b/i, "music"],
  [/\b(travel|trip|visit|destinations?|vacation|holiday)\b/i, "travel"],
  [/\b(brands?|shop|shopping|wear|clothes)\b/i, "brands"],
];

// Each "loves X" in the message, for one person or several: "I love X and my partner loves Y".
const FAVORITES =
  /\b(?:loves?|loved|likes?|liked|enjoys?|enjoyed|adores?|fan of|into|similar to|such as)\s+(.+?)(?=[.?!;]|,?\s+(?:what|which|where|so|recommend|suggest|find|give|show me)\b|$)/gi;

/**
 * Best-effort read of a typed message: the favorites named, what they want, and the city for
 * places. Anything unclear comes back empty and the agent alone answers.
 */
export function readMessage(text: string, picked?: Category | null) {
  const found = [...text.matchAll(FAVORITES)].map((m) => m[1]);
  const rest = found.reduce((t, f) => t.replace(f, " "), text);
  const want = picked ?? CATEGORIES.find((c) => c.key === WANTS.find(([re]) => re.test(rest))?.[1]);
  const location = want?.place ? text.match(/\bin\s+([A-Z][\w.' -]{1,40}?)\s*[?.!]*$/)?.[1] : undefined;
  const names = [...new Set(found.flatMap((f) => f.split(/\s+and\s+|\s*&\s*|,\s*/)).map(cleanQuery).filter(Boolean))].slice(0, 4);
  return { names, want, location };
}
