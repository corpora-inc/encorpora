/**
 * Lexical hits and nearest neighbours as one ranking per result group
 * (Lessons, Skills, Glossary), the way the results are shown. Within a
 * group each half is scaled to its own best result, so neither dominates by
 * units and a short glossary entry's lexical score never squeezes a
 * lesson's. A neighbour counts only above the floor, so a nonsense query
 * finds nothing.
 */
import { groupOf, type SearchGroupId, type SearchKind } from "./corpus";
import type { LexicalHit } from "./lexical";

/** Cosine below this is no evidence of relatedness for this model. */
export const NEIGHBOUR_FLOOR = 0.35;
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

/** Best first within each group; groups in display order, at most
 * `perGroup` results each. */
export function blend(
  lexical: readonly LexicalHit[],
  neighbours: readonly { id: string; similarity: number }[],
  perGroup = 20,
): BlendedHit[] {
  const lexicalTop = new Map<SearchGroupId, number>();
  for (const hit of lexical) {
    const group = groupOfId(hit.id);
    lexicalTop.set(group, Math.max(lexicalTop.get(group) ?? 0, hit.score));
  }
  const vectorTop = new Map<SearchGroupId, number>();
  for (const { id, similarity } of neighbours) {
    const group = groupOfId(id);
    vectorTop.set(group, Math.max(vectorTop.get(group) ?? 0, similarity));
  }
  const merged = new Map<string, BlendedHit>();
  for (const hit of lexical)
    merged.set(hit.id, {
      id: hit.id,
      terms: hit.terms,
      score: LEXICAL_WEIGHT * (hit.score / lexicalTop.get(groupOfId(hit.id))!),
    });
  for (const { id, similarity } of neighbours) {
    const best = vectorTop.get(groupOfId(id))!;
    const near =
      similarity <= NEIGHBOUR_FLOOR
        ? 0
        : best - NEIGHBOUR_FLOOR < 1e-6
          ? 1
          : (similarity - NEIGHBOUR_FLOOR) / (best - NEIGHBOUR_FLOOR);
    const hit = merged.get(id);
    if (hit) {
      hit.score += VECTOR_WEIGHT * near;
      hit.similarity = similarity;
    } else if (near > 0)
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
  return ranked.filter((hit) => {
    const group = groupOfId(hit.id);
    const count = counts.get(group) ?? 0;
    counts.set(group, count + 1);
    return count < perGroup;
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
