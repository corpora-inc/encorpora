/**
 * Course-map matches for Ask: topics, lessons, glossary terms and tools whose
 * names the query's words cover. No answer text is chosen here; each match
 * is a link to the screen that teaches it.
 */
import { tokens } from "../engine/text.ts";

export interface Teachable {
  key: string;
  kind: "topic" | "lesson" | "tool" | "signal" | "term";
  title: string;
  to: string;
  /** Other names that count as this one's title, e.g. "hand signal" for the signal chart. */
  names?: string[];
  /** The topic a lesson belongs to: a lesson also shows when its topic matches. */
  topic?: string;
}

const ORDER: Teachable["kind"][] = ["topic", "lesson", "tool", "signal", "term"];

/**
 * The items whose name is at least half covered by `terms` (index terms from
 * the query), plus the lessons of a matched topic. Best covered first within
 * each kind; kinds in course order.
 */
export function teachableMatches(items: readonly Teachable[], terms: readonly string[], max = 6): Teachable[] {
  const q = new Set(terms);
  if (q.size === 0) return [];
  const cover = (name: string) => {
    const t = new Set(tokens(name));
    if (t.size === 0) return 0;
    const hit = [...t].filter((x) => q.has(x)).length;
    return hit === 0 ? 0 : hit / t.size + hit * 0.01;
  };
  const scored = new Map<string, { item: Teachable; score: number }>();
  for (const item of items) {
    const score = Math.max(...[item.title, ...(item.names ?? [])].map(cover));
    if (score >= 0.5) scored.set(item.key, { item, score });
  }
  const topics = new Set([...scored.values()].filter((x) => x.item.kind === "topic").map((x) => x.item.key));
  for (const item of items)
    if (item.kind === "lesson" && item.topic && topics.has(`topic:${item.topic}`) && !scored.has(item.key)) scored.set(item.key, { item, score: 0.4 });
  const perKind = new Map<string, number>();
  return [...scored.values()]
    .sort((a, b) => ORDER.indexOf(a.item.kind) - ORDER.indexOf(b.item.kind) || b.score - a.score || a.item.title.localeCompare(b.item.title))
    .filter((x) => {
      // At most three of one kind, so a word like "lower" cannot fill the group with signals.
      const n = (perKind.get(x.item.kind) ?? 0) + 1;
      perKind.set(x.item.kind, n);
      return n <= 3;
    })
    .slice(0, max)
    .map((x) => x.item);
}
