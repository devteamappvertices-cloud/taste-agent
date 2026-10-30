import type { EntityType } from "./qloo";

export interface Category {
  key: string;
  label: string;
  type: EntityType;
  /** How a request names it: "Recommend music artists". */
  phrase: string;
  emoji: string;
  /** Places need a city to make sense. */
  place?: boolean;
  /** Qloo tag that narrows the type, e.g. places to restaurants. */
  tag?: string;
}

export const CATEGORIES: Category[] = [
  { key: "movies", label: "Movies", type: "movie", phrase: "movies", emoji: "🍿" },
  { key: "music", label: "Music", type: "artist", phrase: "music artists", emoji: "🎧" },
  { key: "food", label: "Food", type: "place", phrase: "restaurants", emoji: "🍜", place: true, tag: "urn:tag:genre:place:restaurant" },
  { key: "travel", label: "Travel", type: "destination", phrase: "travel destinations", emoji: "🏝️" },
  { key: "tv", label: "TV shows", type: "tv_show", phrase: "TV shows", emoji: "📺" },
  { key: "books", label: "Books", type: "book", phrase: "books", emoji: "📚" },
  { key: "podcasts", label: "Podcasts", type: "podcast", phrase: "podcasts", emoji: "🎙️" },
  { key: "brands", label: "Brands", type: "brand", phrase: "brands", emoji: "🛍️" },
];

export const TYPE_LABEL: Record<string, string> = {
  tv_show: "TV show",
  video_game: "Video game",
  videogame: "Video game",
  place: "Place",
  artist: "Artist",
  movie: "Movie",
  book: "Book",
  podcast: "Podcast",
  destination: "Destination",
  brand: "Brand",
  person: "Person",
  author: "Author",
  album: "Album",
};

export const TYPE_PLURAL: Record<string, string> = {
  movie: "movies",
  artist: "music",
  place: "places",
  destination: "destinations",
  tv_show: "TV shows",
  book: "books",
  podcast: "podcasts",
  brand: "brands",
  video_game: "video games",
  person: "people",
};

/** Qloo serves entity images at a predictable URL. */
export const qlooImage = (id: string) => `https://images.qloo.com/i/${id}-420x-auto.jpg`;

// "I love 3 idiots movie!" -> "3 idiots", "my wife loves Barbie" -> "Barbie": people type sentences, Qloo wants a name.
const LIKES = String.raw`(?:really\s+|just\s+|both\s+)?(?:loves?|loved|likes?|liked|enjoys?|enjoyed|adores?|(?:is|are)\s+into)`;
const LEAD = new RegExp(
  String.raw`^\s*(?:(?:i|we|he|she|they)\s+${LIKES}|(?:my|our)\s+[\w']+(?:\s+[\w']+)?\s+${LIKES}|i'?m\s+(?:into|a\s+fan\s+of)|i\s+am\s+(?:into|a\s+fan\s+of)|(?:my|our)\s+favou?rite(?:\s+\w+)?\s+is|fan\s+of)\s+`,
  "i",
);
const TAIL = /\s+(?:movie|film|tv\s+show|show|series|song|band|singer|book|novel|podcast)$/i;

export function cleanQuery(text: string) {
  return text.replace(LEAD, "").replace(/[.!?,]+$/, "").replace(TAIL, "").trim();
}

// "Digimon Adventure 02" -> "digimon": the word that ties entries of one franchise together.
const STOP = new Set(["the", "and", "of", "a", "an", "my", "our", "in", "on"]);
export function franchise(name: string) {
  return name.toLowerCase().split(/[^\p{L}\p{N}]+/u).find((w) => w.length >= 4 && !STOP.has(w));
}
