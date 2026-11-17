/**
 * Lexical hits and nearest neighbours as one ranking per result group
 * (Lessons, Skills, Glossary), the way the results are shown.
 *
 * The lexical half is scaled to its group's best hit: a word that matched
 * is evidence, and the best match in a group leads it. The vector half is
 * not scaled per group. A neighbour counts only when it is near the query's
 * best neighbour anywhere (within NEIGHBOUR_MARGIN) and above the absolute
 * floor: a group whose documents are all far from the query (Skills for
 * "logic", before skills read their strand) shows nothing from vectors,
 * rather than promoting its least-bad document to the top. A nonsense
 * query finds nothing.
 */
import { groupOf, type SearchGroupId, type SearchKind } from "./corpus";
import type { LexicalHit } from "./lexical";

/** Cosine below this is no evidence of relatedness for this model. */
export const NEIGHBOUR_FLOOR = 0.4;
/** How far below the query's best neighbour a neighbour may be and still
 * count: further is another topic that happens to share a word or a shape. */
export const NEIGHBOUR_MARGIN = 0.16;
/** A result scoring under this share of its group's best is a stray word
 * match ("time" in "times"), not an answer: the group ends before it. */
export const GROUP_FLOOR = 0.1;
const LEXICAL_WEIGHT = 0.6;
const VECTOR_WEIGHT = 0.4;

export type BlendedHit = {
  id: string;
  score: number;
  /** Matched document words (stems), for highlighting. */
  terms: string[];
  /** Cosine similarity to the query, when vectors were compared. */
  similarity?: number;
};

const groupOfId = (id: string) =>
  groupOf(id.slice(0, id.indexOf(":")) as SearchKind);

/** The most results a group holds: enough to scan, never a dump. */
export const GROUP_LIMIT: Record<SearchGroupId, number> = {
  lessons: 20,
  skills: 20,
  glossary: 6,
};

/** Best first within each group, at most its GROUP_LIMIT. */
export function blend(
  lexical: readonly LexicalHit[],
  neighbours: readonly { id: string; similarity: number }[],
): BlendedHit[] {
  const lexicalTop = new Map<SearchGroupId, number>();
  for (const hit of lexical) {
    const group = groupOfId(hit.id);
    lexicalTop.set(group, Math.max(lexicalTop.get(group) ?? 0, hit.score));
  }
  const best = Math.max(0, ...neighbours.map((n) => n.similarity));
  const cut = Math.max(NEIGHBOUR_FLOOR, best - NEIGHBOUR_MARGIN);
  const merged = new Map<string, BlendedHit>();
  for (const hit of lexical)
    merged.set(hit.id, {
      id: hit.id,
      terms: hit.terms,
      score: LEXICAL_WEIGHT * (hit.score / lexicalTop.get(groupOfId(hit.id))!),
    });
  for (const { id, similarity } of neighbours) {
    if (similarity < cut) continue;
    // At the cut a neighbour still counts for a quarter: it is related.
    const near =
      best - cut < 1e-6 ? 1 : 0.25 + (0.75 * (similarity - cut)) / (best - cut);
    const hit = merged.get(id);
    if (hit) {
      hit.score += VECTOR_WEIGHT * near;
      hit.similarity = similarity;
    } else
      merged.set(id, {
        id,
        terms: [],
        score: VECTOR_WEIGHT * near,
        similarity,
      });
  }
  const ranked = [...merged.values()].sort(
    (a, b) => b.score - a.score || a.id.localeCompare(b.id),
  );
  const counts = new Map<SearchGroupId, number>();
  const tops = new Map<SearchGroupId, number>();
  return ranked.filter((hit) => {
    const group = groupOfId(hit.id);
    const top = tops.get(group) ?? hit.score;
    tops.set(group, top);
    const count = counts.get(group) ?? 0;
    counts.set(group, count + 1);
    return count < GROUP_LIMIT[group] && hit.score >= GROUP_FLOOR * top;
  });
}

/** Ids ranked best first, as the groups show them: the first `n` of each. */
export function groupTops(ids: readonly string[], n = 3) {
  const counts = new Map<SearchGroupId, number>();
  return ids.filter((id) => {
    const group = groupOfId(id);
    const count = counts.get(group) ?? 0;
    counts.set(group, count + 1);
    return count < n;
  });
}
