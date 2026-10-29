// The agent answers with one sentence, a bullet per pick ("- **Exact Qloo name** why it fits"),
// and a closing line. The UI shows each reason on its match card and the rest as a summary.

const BULLET = /^\s*(?:[-*•]|\d+\.)\s/;
const PICK = /^\s*(?:[-*•]|\d+\.)\s+\*\*(.+?)\*\*\s*(.*)$/;

export function norm(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export interface Answer {
  /** Reason per pick, keyed by the normalized bold name. */
  reasons: Map<string, string>;
  /** Everything except the pick bullets. */
  summary: string;
}

export function splitAnswer(text: string): Answer {
  const reasons = new Map<string, string>();
  const rest: string[] = [];
  for (const line of text.split("\n")) {
    const m = PICK.exec(line);
    if (m) reasons.set(norm(m[1]), m[2].replace(/^[\s—–:,.-]+/, "").replace(/\*\*/g, "").trim());
    else if (!BULLET.test(line)) rest.push(line);
  }
  return { reasons, summary: rest.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}

/** The reason given for an entity, matching "Moon" to a bullet like "**Moon (2009)**". */
export function reasonFor(answer: Answer, name: string): string | undefined {
  const n = norm(name);
  for (const [key, reason] of answer.reasons) {
    if (key === n || key.startsWith(n + " ")) return reason;
  }
  return undefined;
}
